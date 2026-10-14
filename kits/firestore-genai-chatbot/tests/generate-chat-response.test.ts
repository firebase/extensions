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

import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchHistory: vi.fn(),
  fetchDiscussionOptions: vi.fn(),
  getGenerativeClient: vi.fn(),
  send: vi.fn(),
}));

vi.mock("../src/firestore", () => ({
  fetchHistory: mocks.fetchHistory,
  fetchDiscussionOptions: mocks.fetchDiscussionOptions,
}));

vi.mock("../src/generative-client", () => ({
  getGenerativeClient: mocks.getGenerativeClient,
}));

import { resolveConfig } from "../src/export-config";
import { createGenerateChatResponse } from "../src/generate-chat-response";

describe("createGenerateChatResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchHistory.mockResolvedValue([]);
    mocks.getGenerativeClient.mockReturnValue({ send: mocks.send });
    mocks.send.mockResolvedValue({
      response: "first",
      candidates: ["first", "second"],
    });
  });

  test("forwards global generation options to provider clients", async () => {
    const config = resolveConfig({
      projectId: "project",
      model: "gemini-2.5-flash",
      apiKey: "test-key",
      temperature: 0.7,
      topP: 0.8,
      topK: 9,
      candidateCount: 2,
      maxOutputTokens: 50,
      safetySettings: [
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
      ],
    });
    const generate = createGenerateChatResponse(config);

    const result = await generate("hello", { ref: {} } as any);

    expect(mocks.send).toHaveBeenCalledWith("hello", {
      history: [],
      context: undefined,
      temperature: 0.7,
      topP: 0.8,
      topK: 9,
      candidateCount: 2,
      maxOutputTokens: 50,
      safetySettings: [
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
      ],
    });
    expect(result).toEqual({
      response: "first",
      candidates: ["first", "second"],
    });
  });
});
