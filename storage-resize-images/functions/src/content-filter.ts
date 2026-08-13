/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import vertexAI, { gemini } from "@genkit-ai/vertexai";
import { genkit, z } from "genkit";
import type { SafetyThreshold } from "./config";
import * as fs from "fs";
import * as log from "./logs";
import { globalRetryQueue } from "./global";

/** Similar price to previous `gemini-2.5-flash`, better quality than 2.5 Flash. Higher Flash/Lite tiers cost more. */
const CONTENT_FILTER_MODEL = "gemini-3.1-flash-lite";

/**
 * Creates a data URL from an image file
 * @param imageBuffer Raw image file contents
 * @param contentType MIME type for the image, for example "image/jpeg"
 * @returns Data URL string
 */
function createImageDataUrl(imageBuffer: Buffer, contentType: string): string {
  const base64Image = imageBuffer.toString("base64");
  return `data:${contentType};base64,${base64Image}`;
}

/**
 * Simple sleep function that returns a promise which resolves after the specified time
 * @param ms Time to sleep in milliseconds
 * @returns Promise that resolves after the specified time
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const HARM_CATEGORIES = [
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  "HARM_CATEGORY_HARASSMENT",
] as const;

/**
 * Creates safety settings based on filter level
 * @param filterLevel The content filter level to apply
 * @returns Array of safety settings
 */
function createSafetySettings(filterLevel: SafetyThreshold) {
  return HARM_CATEGORIES.map((category) => ({
    category,
    threshold: filterLevel,
  }));
}

/**
 * Detects genkit's ValidationError, thrown when Gemini's response can't
 * be parsed against our moderation schema. Observed manifestations on
 * Gemini 2.5 Flash safety refusals: data === null (empty content), data
 * === {} (refusal text that extractJson() coerced to an empty object),
 * and likely other variants future model versions may produce.
 *
 * In this code path we control both the prompt and the schema, so any
 * ValidationError from `ai.generate` originates from the model's
 * response — there is no other validation source. Retrying is useless
 * (deterministic same-input → same-bad-response), and the alternative
 * (propagate as filterErrored) silently fails open on borderline NSFW
 * imagery, which is the original bug. So treat any schema-validation
 * failure here as an implicit block.
 *
 * Two structural signals must hold:
 *  - status === "INVALID_ARGUMENT" (genkit's category for ValidationError)
 *  - detail.errors is a populated array (proves the error came from
 *    parseSchema specifically — see @genkit-ai/core schema.js,
 *    ValidationError ctor populates detail: { errors, schema })
 */
function isModerationSchemaRefusal(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as {
    status?: string;
    detail?: { errors?: unknown };
  };
  if (e.status !== "INVALID_ARGUMENT") return false;
  const errors = e.detail?.errors;
  return Array.isArray(errors) && errors.length > 0;
}

/**
 * Detects Gemini's explicit safety block, surfaced by genkit as a thrown
 * error whose response carries finishReason === "blocked". Narrowed from
 * `unknown` for the same reason as {@link isModerationSchemaRefusal}: the
 * catch variable has no static shape.
 */
function isSafetyBlockedResponse(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as {
    detail?: { response?: { finishReason?: unknown } };
  };
  return e.detail?.response?.finishReason === "blocked";
}

/**
 * Entry point for image moderation: short-circuits when disabled, otherwise runs a single
 * Vertex/Gemini call per attempt with retries and queue-backed backoff on transient errors.
 *
 * @param localOriginalFile Path to the local image file
 * @param filterLevel The content filter level to apply ('LOW', 'MEDIUM', 'HIGH', or null to disable)
 * @param prompt Optional custom prompt to use for content checking
 * @param contentType The content type of the image
 * @param maxAttempts Maximum number of retry attempts in case of errors
 * @returns Promise<boolean> - true if the image passes the filter, false otherwise
 */
export async function checkImageContent(
  localOriginalFile: string,
  filterLevel: SafetyThreshold | null,
  prompt: string | null,
  contentType: string,
  maxAttempts = 3
): Promise<boolean> {
  if (filterLevel === null && prompt === null) {
    return true;
  }

  const imageBuffer = fs.readFileSync(localOriginalFile);
  const dataUrl = createImageDataUrl(imageBuffer, contentType);

  const ai = genkit({
    plugins: [
      vertexAI({
        location: process.env.LOCATION ?? "us-central1",
        models: [CONTENT_FILTER_MODEL],
      }),
    ],
  });

  /** One Gemini moderation call (no retries). */
  async function moderateImageOnce(): Promise<boolean> {
    const effectiveFilterLevel: SafetyThreshold =
      filterLevel === null ? "BLOCK_NONE" : filterLevel;

    const hasCustomPrompt = prompt !== null;

    const effectivePrompt = hasCustomPrompt
      ? prompt +
        '\n\n Please respond in json with either { "response": "yes" } or  { "response": "no" }'
      : "Is this image appropriate?";

    const effectiveOutput = hasCustomPrompt
      ? {
          format: "json",
          schema: z.object({
            response: z.string(),
          }),
        }
      : undefined;

    // 1 token is enough for the default yes/no answer; custom prompts emit a JSON object.
    const maxOutputTokens = hasCustomPrompt ? 100 : 1;

    try {
      const result = await ai.generate({
        model: gemini(CONTENT_FILTER_MODEL),
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

      if (result.output?.response === "yes" && hasCustomPrompt) {
        log.customFilterBlocked();
        return false;
      }

      return true;
    } catch (error) {
      if (isSafetyBlockedResponse(error) || isModerationSchemaRefusal(error)) {
        log.contentFilterBlocked();
        return false;
      }
      throw error;
    }
  }

  const attemptWithRetry = async (attemptNumber: number): Promise<boolean> => {
    try {
      return await moderateImageOnce();
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
        // Higher priority number = higher priority in queue
        return (await globalRetryQueue.add(
          async () => {
            await sleep(backoffTime);
            return attemptWithRetry(attemptNumber + 1);
          },
          { priority: -attemptNumber }
        )) as boolean; // Use attempt number as priority
      }

      log.contentFilterFailed(error);
      throw error;
    }
  };

  // Start the first attempt (not via queue)
  return await attemptWithRetry(1);
}
