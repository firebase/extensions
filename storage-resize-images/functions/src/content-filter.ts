import vertexAI, { gemini20Flash001 } from "@genkit-ai/vertexai";
import { HarmCategory, HarmBlockThreshold } from "@google-cloud/vertexai";
import { genkit, z } from "genkit";
import * as fs from "fs";
import * as path from "path";
import * as functions from "firebase-functions/v1";
import { v4 as uuidv4 } from "uuid";
import * as os from "os";
import { Bucket } from "@google-cloud/storage";
import { ObjectMetadata } from "firebase-functions/v1/storage";
import type { Config } from "./config";
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

// OFF - no filter applied
// BLOCK_NONE - no blocking
// BLOCK_ONLY_HIGH - only block high severity content
// BLOCK_MEDIUM_AND_ABOVE - block medium and high severity content
// BLOCK_LOW_AND_ABOVE - block low, medium, and high severity content
// CUSTOM - user provides a prompt (we still enforce the response via structured output) e.g "Does this image contain a cat?"

/**
 * Checks if an image content is appropriate based on the provided filter level and optional custom prompt
 * @param localOriginalFile Path to the local image file
 * @param filterLevel The content filter level to apply ('LOW', 'MEDIUM', 'HIGH', or 'OFF')
 * @param prompt Optional custom prompt to use for content checking
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
  let attempts = 1;
  while (attempts <= maxAttempts) {
    // If filter level is OFF and no custom prompt, skip content checking entirely
    if (filterLevel === null && prompt === null) {
      return true;
    }

    try {
      const dataUrl = createImageDataUrl(localOriginalFile);

      // Initialize Vertex AI client
      const ai = genkit({
        plugins: [vertexAI()],
      });

      try {
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
          console.warn("Image content blocked by Custom AI Content filter.");
          return false;
        }

        return true;
      } catch (error) {
        if (error.detail?.response?.finishReason === "blocked") {
          console.warn("Image content blocked by Vertex AI content filters.");
          return false;
        }
        throw error;
      }
    } catch (error) {
      if (attempts < maxAttempts) {
        const backoffTime = Math.min(
          2 ** attempts * 500 + Math.random() * 200,
          5000 // Cap at 5 seconds
        );
        console.warn(
          `Unexpected Error whilst evaluating content of image with Gemini (Attempt ${attempts}/${maxAttempts}). Retrying in ${Math.round(
            backoffTime / 1000
          )}s:`,
          error
        );
        await sleep(backoffTime);
        attempts++;
      } else {
        console.error(
          "Failed to evaluate image content after multiple attempts:",
          error
        );
        throw error;
      }
    }
  }

  // This should never be reached, but as a fallback:
  return false;
}

/**
 * Replaces the original file with configured placeholder
 */
export async function replaceWithConfiguredPlaceholder(
  localFile: string,
  bucket: Bucket,
  placeholderPath: string
): Promise<void> {
  try {
    functions.logger.info(
      `Replacing filtered image with placeholder from ${placeholderPath}`
    );

    const placeholderFile = bucket.file(placeholderPath);
    const tempPlaceholder = path.join(os.tmpdir(), uuidv4());

    await placeholderFile.download({ destination: tempPlaceholder });

    // Swap original with placeholder
    fs.unlinkSync(localFile);
    fs.copyFileSync(tempPlaceholder, localFile);
    fs.unlinkSync(tempPlaceholder);

    functions.logger.info(`Successfully replaced with placeholder image`);
  } catch (err) {
    functions.logger.error(`Error replacing with placeholder:`, err);
    functions.logger.info(`Falling back to default local placeholder.`);

    // Fall back to default placeholder
    await replaceWithDefaultPlaceholder(localFile);
  }
}

/**
 * Replaces the original file with default placeholder
 */
export async function replaceWithDefaultPlaceholder(
  localFile: string
): Promise<void> {
  const localPlaceholderFile = path.join(__dirname, "placeholder.png");

  // Make a copy of the default placeholder instead of using it directly
  const tempPlaceholder = path.join(os.tmpdir(), uuidv4());
  fs.copyFileSync(localPlaceholderFile, tempPlaceholder);

  // Delete the original file
  fs.unlinkSync(localFile);

  // Replace with the placeholder
  fs.renameSync(tempPlaceholder, localFile);
}

/**
 * Processes content filtering and handles placeholder replacement if needed
 */
export async function processContentFilter(
  localFile: string,
  object: ObjectMetadata,
  bucket: Bucket,
  verbose: boolean,
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
    functions.logger.error(`Error during content filtering: ${err}`);
    failed = true; // Set failed flag if content filter throws an error
  }

  // Handle failed content filter
  if (filterResult === false) {
    functions.logger.warn(
      `Image ${object.name} was rejected by the content filter.`
    );

    try {
      if (config.placeholderImagePath) {
        await replaceWithConfiguredPlaceholder(
          localFile,
          bucket,
          config.placeholderImagePath
        );
      } else {
        await replaceWithDefaultPlaceholder(localFile);
      }
    } catch (err) {
      functions.logger.error(`Error replacing with placeholder:`, err);
      failed = true;
    }
  }

  return { passed: filterResult, failed };
}
