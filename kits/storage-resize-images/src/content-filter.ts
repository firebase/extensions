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

import * as fs from "node:fs";
import vertexAI, { gemini } from "@genkit-ai/vertexai";
import { genkit, z } from "genkit";
import type { SafetyThreshold } from "./export-config";
import { GLOBAL_RETRY_QUEUE } from "./global";
import * as log from "./logs";

const HARM_CATEGORIES = [
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  "HARM_CATEGORY_HARASSMENT",
] as const;
const CONTENT_FILTER_MODEL = "gemini-3.6-flash";
const RETRY_BASE_MS = 500;
const RETRY_JITTER_MS = 200;
const RETRY_MAX_MS = 5000;
const DEFAULT_MAX_ATTEMPTS = 3;

function createImageDataUrl(imageBuffer: Buffer, contentType: string): string {
  const base64Image = imageBuffer.toString("base64");
  return `data:${contentType};base64,${base64Image}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createSafetySettings(filterLevel: SafetyThreshold) {
  return HARM_CATEGORIES.map((category) => ({
    category,
    threshold: filterLevel,
  }));
}

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

function isSafetyBlockedResponse(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as {
    detail?: { response?: { finishReason?: unknown } };
  };
  return e.detail?.response?.finishReason === "blocked";
}

export async function checkImageContent(
  localOriginalFile: string,
  filterLevel: SafetyThreshold | null,
  prompt: string | null,
  contentType: string,
  location?: string,
  maxAttempts = DEFAULT_MAX_ATTEMPTS
): Promise<boolean> {
  if (filterLevel === null && prompt === null) {
    return true;
  }
  if (!location) {
    throw new Error("FUNCTION_REGION is required for Vertex AI filtering.");
  }

  const imageBuffer = fs.readFileSync(localOriginalFile);
  const dataUrl = createImageDataUrl(imageBuffer, contentType);
  const ai = genkit({
    plugins: [
      vertexAI({
        location,
        models: [CONTENT_FILTER_MODEL],
      }),
    ],
  });

  async function moderateImageOnce(): Promise<boolean> {
    const effectiveFilterLevel: SafetyThreshold =
      filterLevel === null ? "BLOCK_NONE" : filterLevel;
    const hasCustomPrompt = prompt !== null;
    const effectivePrompt = hasCustomPrompt
      ? `${prompt}\n\n Please respond in json with either { "response": "yes" } or  { "response": "no" }`
      : "Is this image appropriate?";
    const effectiveOutput = hasCustomPrompt
      ? {
          format: "json",
          schema: z.object({
            response: z.string(),
          }),
        }
      : undefined;
    const maxOutputTokens = hasCustomPrompt ? 100 : 1;

    try {
      const result = await ai.generate({
        model: gemini(CONTENT_FILTER_MODEL),
        messages: [
          {
            role: "user",
            content: [
              { text: effectivePrompt },
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
      if (attemptNumber < maxAttempts) {
        const backoffTime = Math.min(
          2 ** attemptNumber * RETRY_BASE_MS + Math.random() * RETRY_JITTER_MS,
          RETRY_MAX_MS
        );

        log.contentFilterError(error, attemptNumber, maxAttempts);
        log.retryScheduled(attemptNumber, maxAttempts, backoffTime);

        return (await GLOBAL_RETRY_QUEUE.add(
          async () => {
            await sleep(backoffTime);
            return attemptWithRetry(attemptNumber + 1);
          },
          { priority: -attemptNumber }
        )) as boolean;
      }

      log.contentFilterFailed(error);
      throw error;
    }
  };

  return attemptWithRetry(1);
}
