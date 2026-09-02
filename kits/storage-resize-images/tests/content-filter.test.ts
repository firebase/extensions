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

/**
 * Parity with the extension's `__tests__/content-filter.test.ts`. The
 * extension imports `HarmBlockThreshold` from `@google-cloud/vertexai`; the
 * kit's thresholds are plain string literals, so they are written out here.
 */

import * as path from "node:path";

import { ValidationError } from "@genkit-ai/core/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { genkitMock } = vi.hoisted(() => ({ genkitMock: vi.fn() }));

vi.mock("genkit", () => ({
  genkit: genkitMock,
  z: {
    object: vi.fn().mockReturnThis(),
    string: vi.fn().mockReturnThis(),
  },
}));

vi.mock("@genkit-ai/vertexai", () => ({
  __esModule: true,
  default: vi.fn(),
  gemini: vi.fn((version: string) => ({ name: `vertexai/${version}` })),
}));

vi.mock("../src/logs", () => ({
  contentFilterBlocked: vi.fn(),
  customFilterBlocked: vi.fn(),
  contentFilterError: vi.fn(),
  contentFilterFailed: vi.fn(),
  retryScheduled: vi.fn(),
}));

import vertexAI from "@genkit-ai/vertexai";
import { checkImageContent } from "../src/content-filter";
import * as log from "../src/logs";

const imagePath = path.join(__dirname, "fixtures", "gun-image.png");
const LOCATION = "us-central1";

describe("checkImageContent with mocks", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    genkitMock.mockImplementation(() => ({
      generate: vi.fn().mockResolvedValue({ output: { response: "yes" } }),
    }));
  });

  it("should return true when filter level is OFF and no custom prompt", async () => {
    const result = await checkImageContent(
      imagePath,
      null,
      null,
      "image/png",
      LOCATION
    );

    expect(genkitMock).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it("should fall back to us-central1 when no region is available", async () => {
    const result = await checkImageContent(
      imagePath,
      "BLOCK_ONLY_HIGH",
      null,
      "image/png"
    );

    expect(result).toBe(true);
    expect(vi.mocked(vertexAI)).toHaveBeenCalledWith(
      expect.objectContaining({ location: "us-central1" })
    );
  });

  it("should pass an explicit region through to the Vertex AI plugin", async () => {
    await checkImageContent(
      imagePath,
      "BLOCK_ONLY_HIGH",
      null,
      "image/png",
      "europe-west1"
    );

    expect(vi.mocked(vertexAI)).toHaveBeenCalledWith(
      expect.objectContaining({ location: "europe-west1" })
    );
  });

  it("should return true when the API response is positive", async () => {
    const mockGenerate = vi
      .fn()
      .mockResolvedValue({ output: { response: "yes" } });
    genkitMock.mockImplementation(() => ({ generate: mockGenerate }));

    const result = await checkImageContent(
      imagePath,
      "BLOCK_MEDIUM_AND_ABOVE",
      null,
      "image/png",
      LOCATION
    );

    expect(genkitMock).toHaveBeenCalled();
    expect(mockGenerate).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it("should return false when the API response is to filter with custom prompt", async () => {
    const mockGenerate = vi
      .fn()
      .mockResolvedValue({ output: { response: "yes" } });
    genkitMock.mockImplementation(() => ({ generate: mockGenerate }));

    const result = await checkImageContent(
      imagePath,
      "BLOCK_LOW_AND_ABOVE",
      "Is this image containing inappropriate content?",
      "image/png",
      LOCATION
    );

    expect(genkitMock).toHaveBeenCalled();
    expect(mockGenerate).toHaveBeenCalled();
    expect(result).toBe(false);
    expect(log.customFilterBlocked).toHaveBeenCalled();
  });

  it("should return true when the custom prompt answers 'no'", async () => {
    const mockGenerate = vi
      .fn()
      .mockResolvedValue({ output: { response: "no" } });
    genkitMock.mockImplementation(() => ({ generate: mockGenerate }));

    const result = await checkImageContent(
      imagePath,
      "BLOCK_LOW_AND_ABOVE",
      "Is this image containing inappropriate content?",
      "image/png",
      LOCATION
    );

    expect(result).toBe(true);
    expect(log.customFilterBlocked).not.toHaveBeenCalled();
  });

  it("should return false when API throws a 'blocked' finish reason", async () => {
    const mockGenerate = vi.fn().mockRejectedValue({
      detail: { response: { finishReason: "blocked" } },
    });
    genkitMock.mockImplementation(() => ({ generate: mockGenerate }));

    const result = await checkImageContent(
      imagePath,
      "BLOCK_MEDIUM_AND_ABOVE",
      null,
      "image/png",
      LOCATION,
      1
    );

    expect(genkitMock).toHaveBeenCalled();
    expect(mockGenerate).toHaveBeenCalled();
    expect(result).toBe(false);
    expect(log.contentFilterBlocked).toHaveBeenCalled();
  });

  it("should rethrow when error occurs", async () => {
    const mockGenerate = vi.fn().mockRejectedValue(new Error("API failure"));
    genkitMock.mockImplementation(() => ({ generate: mockGenerate }));

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
    expect(log.contentFilterFailed).toHaveBeenCalled();
  }, 60000);

  it("should pass correct parameters to generate for default prompt", async () => {
    const mockGenerate = vi
      .fn()
      .mockResolvedValue({ output: { response: "yes" } });
    genkitMock.mockImplementation(() => ({ generate: mockGenerate }));

    await checkImageContent(
      imagePath,
      "BLOCK_MEDIUM_AND_ABOVE",
      null,
      "image/png",
      LOCATION
    );

    expect(mockGenerate).toHaveBeenCalled();
    const callArgs = mockGenerate.mock.calls[0][0];

    expect(callArgs.model?.name ?? callArgs.model).toBe(
      "vertexai/gemini-2.5-flash"
    );
    expect(callArgs.messages[0].role).toBe("user");
    expect(callArgs.messages[0].content[0].text).toBe(
      "Is this image appropriate?"
    );
    expect(callArgs.messages[0].content[1].media).toBeDefined();
    expect(callArgs.messages[0].content[1].media.url).toMatch(
      /^data:image\/png;base64,/
    );
    expect(callArgs.config.temperature).toBe(0.1);
    expect(callArgs.config.maxOutputTokens).toBe(1);
    expect(callArgs.config.safetySettings).toEqual([
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_MEDIUM_AND_ABOVE",
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE",
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE",
      },
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE",
      },
    ]);
  });

  it("should pass correct parameters to generate for custom prompt", async () => {
    const mockGenerate = vi
      .fn()
      .mockResolvedValue({ output: { response: "yes" } });
    genkitMock.mockImplementation(() => ({ generate: mockGenerate }));

    const customPrompt = "Does this image contain violent content?";

    await checkImageContent(
      imagePath,
      "BLOCK_MEDIUM_AND_ABOVE",
      customPrompt,
      "image/png",
      LOCATION
    );

    expect(mockGenerate).toHaveBeenCalled();
    const callArgs = mockGenerate.mock.calls[0][0];

    expect(callArgs.messages[0].content[0].text).toContain(customPrompt);
    expect(callArgs.config.maxOutputTokens).toBe(100);
    expect(callArgs.output?.format).toBe("json");
  });

  it("uses BLOCK_NONE for a custom-prompt-only configuration", async () => {
    const mockGenerate = vi
      .fn()
      .mockResolvedValue({ output: { response: "no" } });
    genkitMock.mockImplementation(() => ({ generate: mockGenerate }));

    await checkImageContent(
      imagePath,
      null,
      "Does this image contain a weapon?",
      "image/png",
      LOCATION
    );

    const callArgs = mockGenerate.mock.calls[0][0];
    expect(
      callArgs.config.safetySettings.map(
        (setting: { threshold: string }) => setting.threshold
      )
    ).toEqual(["BLOCK_NONE", "BLOCK_NONE", "BLOCK_NONE", "BLOCK_NONE"]);
  });

  it("should test the image using both BLOCK_LOW_AND_ABOVE and BLOCK_ONLY_HIGH filters", async () => {
    let mockGenerate = vi.fn().mockRejectedValue({
      detail: { response: { finishReason: "blocked" } },
    });
    genkitMock.mockImplementation(() => ({ generate: mockGenerate }));

    let result = await checkImageContent(
      imagePath,
      "BLOCK_LOW_AND_ABOVE",
      null,
      "image/png",
      LOCATION
    );

    expect(mockGenerate).toHaveBeenCalled();
    expect(result).toBe(false);

    vi.clearAllMocks();

    mockGenerate = vi.fn().mockResolvedValue({ output: { response: "yes" } });
    genkitMock.mockImplementation(() => ({ generate: mockGenerate }));

    result = await checkImageContent(
      imagePath,
      "BLOCK_ONLY_HIGH",
      null,
      "image/png",
      LOCATION
    );

    expect(mockGenerate).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  // Schema used by checkImageContent's custom-prompt path — the moderation
  // call sets output: { schema: z.object({ response: z.string() }) }. The
  // genkit-emitted JSON schema is replicated here so the real
  // ValidationError ctor receives a faithful `schema` field.
  const moderationSchema = {
    type: "object",
    properties: { response: { type: "string" } },
    required: ["response"],
    additionalProperties: true,
    $schema: "http://json-schema.org/draft-07/schema#",
  };

  it("should return false when genkit throws ValidationError with null-content data (Bug 1)", async () => {
    // Reproduces one failure shape Gemini 2.5 Flash + genkit produces
    // when input-side safety refuses: empty content → parseSchema(null).
    // Instantiated via the real class so the test fails loudly if genkit
    // ever changes the ValidationError contract.
    const validationError = new ValidationError({
      data: null,
      errors: [{ path: "(root)", message: "must be object" }],
      schema: moderationSchema,
    });

    const mockGenerate = vi.fn().mockRejectedValue(validationError);
    genkitMock.mockImplementation(() => ({ generate: mockGenerate }));

    const result = await checkImageContent(
      imagePath,
      "BLOCK_LOW_AND_ABOVE",
      "Is this image inappropriate?",
      "image/png",
      LOCATION
    );

    expect(result).toBe(false);
    expect(log.contentFilterBlocked).toHaveBeenCalled();
    // Deterministic refusal — must not burn retries.
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it("should return false when genkit throws ValidationError with empty-object data (Bug 1 variant)", async () => {
    // The other observed safety-refusal manifestation: extractJson()
    // returns {} when the model emits non-JSON or empty refusal text, and
    // the schema rejects it for missing the required `response` field.
    const validationError = new ValidationError({
      data: {},
      errors: [
        { path: "(root)", message: "must have required property 'response'" },
      ],
      schema: moderationSchema,
    });

    const mockGenerate = vi.fn().mockRejectedValue(validationError);
    genkitMock.mockImplementation(() => ({ generate: mockGenerate }));

    const result = await checkImageContent(
      imagePath,
      "BLOCK_LOW_AND_ABOVE",
      "Is this image inappropriate?",
      "image/png",
      LOCATION
    );

    expect(result).toBe(false);
    expect(log.contentFilterBlocked).toHaveBeenCalled();
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it("should also block on type-mismatch ValidationError (any moderation schema failure → block)", async () => {
    // We control the prompt and schema in this code path, so the only
    // source of ValidationError is the model's response. Failing open is
    // worse than a false-positive block, so the whole class is treated as
    // blocked.
    const validationError = new ValidationError({
      data: { response: 42 },
      errors: [{ path: "response", message: "must be string" }],
      schema: moderationSchema,
    });

    const mockGenerate = vi.fn().mockRejectedValue(validationError);
    genkitMock.mockImplementation(() => ({ generate: mockGenerate }));

    const result = await checkImageContent(
      imagePath,
      "BLOCK_LOW_AND_ABOVE",
      "prompt",
      "image/png",
      LOCATION
    );

    expect(result).toBe(false);
    expect(log.contentFilterBlocked).toHaveBeenCalled();
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it("should still rethrow non-ValidationError errors after exhausting retries", async () => {
    // Sanity check: errors WITHOUT the ValidationError shape (status +
    // detail.errors) still go through the retry path and propagate.
    const networkError = new Error("ECONNRESET");

    const mockGenerate = vi.fn().mockRejectedValue(networkError);
    genkitMock.mockImplementation(() => ({ generate: mockGenerate }));

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

    expect(mockGenerate).toHaveBeenCalledTimes(3);
    expect(log.contentFilterBlocked).not.toHaveBeenCalled();
    expect(log.retryScheduled).toHaveBeenCalledTimes(2);
  }, 30000);
});
