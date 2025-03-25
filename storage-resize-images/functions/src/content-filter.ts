import vertexAI, { gemini20Flash001 } from "@genkit-ai/vertexai";
import { HarmCategory, HarmBlockThreshold } from "@google-cloud/vertexai";
import { genkit, z } from "genkit";
import * as fs from "fs";
import * as path from "path";
import * as functions from "firebase-functions/v1";
import { Bucket } from "@google-cloud/storage";
import { ObjectMetadata } from "firebase-functions/v1/storage";
import type { Config } from "./config";
import { globalRetryQueue } from "./retry-queue";
import {
  replaceWithConfiguredPlaceholder,
  replaceWithDefaultPlaceholder,
} from "./util";
// Import the logging functions from your log.ts module
import * as log from "./logs";

/**
 * Creates a data URL from an image file
 * @param filePath Path to the image file
 * @returns Data URL string
 */
function createImageDataUrl(filePath: string): string {
  const imageBuffer = fs.readFileSync(filePath);
  const base64Image = imageBuffer.toString("base64");
  const mimeType = getMimeType(filePath);
  return `data:${mimeType};base64,${base64Image}`;
}

/**
 * Determines MIME type based on file extension
 * @param filePath Path to the file
 * @returns MIME type string
 */
function getMimeType(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

/**
 * Simple sleep function that returns a promise which resolves after the specified time
 * @param ms Time to sleep in milliseconds
 * @returns Promise that resolves after the specified time
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates safety settings based on filter level
 * @param filterLevel The content filter level to apply
 * @returns Array of safety settings
 */
function createSafetySettings(filterLevel: HarmBlockThreshold) {
  const categories: HarmCategory[] = [
    HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    HarmCategory.HARM_CATEGORY_UNSPECIFIED,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    HarmCategory.HARM_CATEGORY_HARASSMENT,
  ];
  return categories.map((category) => ({
    category,
    threshold: filterLevel,
  }));
}

/**
 * Performs the actual content check with the AI model
 * @param localOriginalFile Path to the local image file
 * @param filterLevel The content filter level to apply
 * @param prompt Optional custom prompt to use for content checking
 * @param contentType The content type of the image
 * @returns Promise<boolean> - true if the image passes the filter, false otherwise
 */
async function performContentCheck(
  localOriginalFile: string,
  filterLevel: HarmBlockThreshold | null,
  prompt: string | null,
  contentType: string
): Promise<boolean> {
  const dataUrl = createImageDataUrl(localOriginalFile);

  // Initialize Vertex AI client
  const ai = genkit({
    plugins: [vertexAI()],
  });

  // Determine the effective safety settings and prompt to use
  const effectiveFilterLevel =
    filterLevel === null ? HarmBlockThreshold.BLOCK_NONE : filterLevel;
  const effectivePrompt =
    prompt !== null
      ? prompt +
        '\n\n Please respond in json with either { "response": "yes" } or  { "response": "no" }'
      : "Is this image appropriate?";

  const effectiveOutput =
    prompt !== null
      ? {
          format: "json",
          schema: z.object({
            response: z.string(),
          }),
        }
      : undefined;

  // Determine max tokens based on whether we're using custom prompt
  const maxOutputTokens = prompt !== null ? 100 : 1;

  try {
    const result = await ai.generate({
      model: gemini20Flash001,
      messages: [
        {
          role: "user",
          content: [
            {
              text: effectivePrompt,
            },
            {
              media: {
                url: dataUrl,
                contentType,
              },
            },
          ],
        },
      ],
      output: effectiveOutput,
      config: {
        temperature: 0.1,
        maxOutputTokens,
        safetySettings: createSafetySettings(effectiveFilterLevel),
      },
    });

    if (result.output?.response === "yes" && prompt !== null) {
      log.customFilterBlocked();
      return false;
    }

    return true;
  } catch (error) {
    if (error.detail?.response?.finishReason === "blocked") {
      log.contentFilterBlocked();
      return false;
    }
    throw error;
  }
}

/**
 * Checks if an image content is appropriate based on the provided filter level and optional custom prompt
 * @param localOriginalFile Path to the local image file
 * @param filterLevel The content filter level to apply ('LOW', 'MEDIUM', 'HIGH', or null to disable)
 * @param prompt Optional custom prompt to use for content checking
 * @param contentType The content type of the image
 * @param maxAttempts Maximum number of retry attempts in case of errors
 * @returns Promise<boolean> - true if the image passes the filter, false otherwise
 */
export async function checkImageContent(
  localOriginalFile: string,
  filterLevel: HarmBlockThreshold | null,
  prompt: string | null,
  contentType: string,
  maxAttempts = 3
): Promise<boolean> {
  // If filter level is null and no custom prompt, skip content checking entirely
  if (filterLevel === null && prompt === null) {
    return true;
  }

  // Helper function that handles retries using the queue
  const attemptWithRetry = async (attemptNumber: number): Promise<boolean> => {
    try {
      return await performContentCheck(
        localOriginalFile,
        filterLevel,
        prompt,
        contentType
      );
    } catch (error) {
      // If we have attempts left, schedule a retry via the queue
      if (attemptNumber < maxAttempts) {
        const backoffTime = Math.min(
          2 ** attemptNumber * 500 + Math.random() * 200,
          5000 // Cap at 5 seconds
        );

        log.contentFilterError(error, attemptNumber, maxAttempts);
        log.retryScheduled(attemptNumber, maxAttempts, backoffTime);

        // Schedule the retry with backoff via the queue
        // Lower priority number = higher priority in queue
        return await globalRetryQueue.enqueue(async () => {
          await sleep(backoffTime);
          return attemptWithRetry(attemptNumber + 1);
        }, attemptNumber); // Use attempt number as priority
      }

      log.contentFilterFailed(error);
      throw error;
    }
  };

  // Start the first attempt (not via queue)
  return await attemptWithRetry(1);
}

/**
 * Processes content filtering and handles placeholder replacement if needed
 */
export async function processContentFilter(
  localFile: string,
  object: ObjectMetadata,
  bucket: Bucket,
  _verbose: boolean,
  config: Config
): Promise<{ passed: boolean; failed: boolean | null }> {
  let filterResult = true; // Default to true (pass)
  let failed = null; // No failures yet

  try {
    filterResult = await checkImageContent(
      localFile,
      config.contentFilterLevel,
      config.customFilterPrompt,
      object.contentType
    );
  } catch (err) {
    log.contentFilterErrored(err);
    failed = true; // Set failed flag if content filter throws an error
  }

  // Handle failed content filter
  if (filterResult === false) {
    log.contentFilterRejected(object.name);

    try {
      if (config.placeholderImagePath) {
        log.replacingWithConfiguredPlaceholder(config.placeholderImagePath);
        await replaceWithConfiguredPlaceholder(
          localFile,
          bucket,
          config.placeholderImagePath
        );
      } else {
        log.replacingWithDefaultPlaceholder();
        await replaceWithDefaultPlaceholder(localFile);
      }
      log.placeholderReplaceComplete(localFile);
    } catch (err) {
      log.placeholderReplaceError(err);
      failed = true;
    }
  }

  return { passed: filterResult, failed };
}
