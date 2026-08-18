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

import * as path from "node:path";
import { ValidationError } from "@genkit-ai/core/schema";
import { beforeEach, describe, expect, test, vi } from "vitest";

const generate = vi.fn();

vi.mock("genkit", () => ({
  genkit: vi.fn(() => ({ generate })),
  z: {
    object: vi.fn().mockReturnThis(),
    string: vi.fn().mockReturnThis(),
  },
}));

vi.mock("@genkit-ai/vertexai", () => ({
  default: vi.fn(),
  gemini: vi.fn((version: string) => ({ name: `vertexai/${version}` })),
}));

vi.mock("../src/logs");

import { genkit } from "genkit";
import { checkImageContent } from "../src/content-filter";
import * as log from "../src/logs";

const imagePath = path.join(__dirname, "test-image.png");
const LOCATION = "us-central1";

/** The JSON schema genkit emits for the custom-prompt output shape. */
const moderationSchema = {
  type: "object",
  properties: { response: { type: "string" } },
  required: ["response"],
  additionalProperties: true,
  $schema: "http://json-schema.org/draft-07/schema#",
};

describe("checkImageContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generate.mockResolvedValue({ output: { response: "yes" } });
  });

  test("returns true when the filter level is off and there is no custom prompt", async () => {
    const result = await checkImageContent(
      imagePath,
      null,
      null,
      "image/png",
      LOCATION
    );

    expect(genkit).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });

  test("throws without a function region to reach Vertex AI in", async () => {
    await expect(
      checkImageContent(
        imagePath,
        "BLOCK_MEDIUM_AND_ABOVE",
        null,
        "image/png",
        undefined
      )
    ).rejects.toThrow("FUNCTION_REGION is required");
  });

  test("returns true when the API response is positive", async () => {
    const result = await checkImageContent(
      imagePath,
      "BLOCK_MEDIUM_AND_ABOVE",
      null,
      "image/png",
      LOCATION
    );

    expect(genkit).toHaveBeenCalled();
    expect(generate).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  test("returns false when a custom prompt answers yes", async () => {
    const result = await checkImageContent(
      imagePath,
      "BLOCK_LOW_AND_ABOVE",
      "Is this image containing inappropriate content?",
      "image/png",
      LOCATION
    );

    expect(log.customFilterBlocked).toHaveBeenCalled();
    expect(result).toBe(false);
  });

  test("returns false when the API throws a blocked finish reason", async () => {
    generate.mockRejectedValue({
      detail: { response: { finishReason: "blocked" } },
    });

    const result = await checkImageContent(
      imagePath,
      "BLOCK_MEDIUM_AND_ABOVE",
      null,
      "image/png",
      LOCATION,
      1
    );

    expect(log.contentFilterBlocked).toHaveBeenCalled();
    expect(result).toBe(false);
  });

  test("rethrows when a generic error occurs", async () => {
    generate.mockRejectedValue(new Error("API failure"));

    await expect(
      checkImageContent(
        imagePath,
        "BLOCK_MEDIUM_AND_ABOVE",
        null,
        "image/png",
        LOCATION,
        1
      )
    ).rejects.toThrow("API failure");
  });

  test("passes the default prompt and the configured threshold to generate", async () => {
    await checkImageContent(
      imagePath,
      "BLOCK_MEDIUM_AND_ABOVE",
      null,
      "image/png",
      LOCATION
    );

    const [callArgs] = generate.mock.calls[0];
    expect(callArgs.model?.name ?? callArgs.model).toBe(
      "vertexai/gemini-2.5-flash"
    );
    expect(callArgs.messages[0].role).toBe("user");
    expect(callArgs.messages[0].content[0].text).toBe(
      "Is this image appropriate?"
    );
    expect(callArgs.messages[0].content[1].media).toBeDefined();
    expect(callArgs.config.temperature).toBe(0.1);
    expect(callArgs.config.maxOutputTokens).toBe(1);
    expect(callArgs.config.safetySettings).toEqual(
      expect.arrayContaining([
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
      ])
    );
  });

  test("passes a custom prompt and a larger token budget to generate", async () => {
    const customPrompt = "Does this image contain violent content?";

    await checkImageContent(
      imagePath,
      "BLOCK_MEDIUM_AND_ABOVE",
      customPrompt,
      "image/png",
      LOCATION
    );

    const [callArgs] = generate.mock.calls[0];
    expect(callArgs.messages[0].content[0].text).toContain(customPrompt);
    expect(callArgs.config.maxOutputTokens).toBe(100);
  });

  test("applies the requested threshold in both directions", async () => {
    generate.mockRejectedValueOnce({
      detail: { response: { finishReason: "blocked" } },
    });

    expect(
      await checkImageContent(
        imagePath,
        "BLOCK_LOW_AND_ABOVE",
        null,
        "image/png",
        LOCATION
      )
    ).toBe(false);

    expect(
      await checkImageContent(
        imagePath,
        "BLOCK_ONLY_HIGH",
        null,
        "image/png",
        LOCATION
      )
    ).toBe(true);
  });

  test.each([
    [
      "null content",
      { data: null, errors: [{ path: "(root)", message: "must be object" }] },
    ],
    [
      "empty object content",
      {
        data: {},
        errors: [
          { path: "(root)", message: "must have required property 'response'" },
        ],
      },
    ],
    [
      "a type mismatch",
      {
        data: { response: 42 },
        errors: [{ path: "response", message: "must be string" }],
      },
    ],
  ])(
    "blocks when genkit rejects the moderation schema with %s",
    async (_desc, details) => {
      // A schema failure means the model produced no usable verdict, which on
      // borderline imagery is almost always an input-side safety refusal.
      // Failing open is worse than a false-positive block.
      generate.mockRejectedValue(
        new ValidationError({ ...details, schema: moderationSchema })
      );

      const result = await checkImageContent(
        imagePath,
        "BLOCK_LOW_AND_ABOVE",
        "Is this image inappropriate?",
        "image/png",
        LOCATION
      );

      expect(result).toBe(false);
      expect(log.contentFilterBlocked).toHaveBeenCalled();
      // A deterministic refusal must not burn retries.
      expect(generate).toHaveBeenCalledTimes(1);
    }
  );

  test("retries and rethrows errors that are not schema refusals", async () => {
    generate.mockRejectedValue(new Error("ECONNRESET"));

    await expect(
      checkImageContent(
        imagePath,
        "BLOCK_LOW_AND_ABOVE",
        "prompt",
        "image/png",
        LOCATION,
        3
      )
    ).rejects.toThrow("ECONNRESET");

    expect(generate).toHaveBeenCalledTimes(3);
    expect(log.contentFilterBlocked).not.toHaveBeenCalled();
  }, 30000);
});
