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

import { describe, expect, test } from "vitest";
import { GenerativeAIProvider, resolveConfig } from "../src/export-config";
import { getGenerativeClient } from "../src/generative-client";
import { GenkitDiscussionClient } from "../src/generative-client/genkit";
import { GeminiDiscussionClient } from "../src/generative-client/google_ai";
import { VertexDiscussionClient } from "../src/generative-client/vertex_ai";

const baseInput = {
  projectId: "p",
  model: "gemini-2.5-flash",
  apiKey: "test-key",
};

describe("getGenerativeClient — provider switch", () => {
  // candidateCount > 1 forces the non-Genkit path (Genkit only serves a single
  // candidate), so the provider switch is exercised directly.
  test("google-ai with multiple candidates -> GeminiDiscussionClient", () => {
    const config = resolveConfig({
      ...baseInput,
      provider: GenerativeAIProvider.GOOGLE_AI,
      candidateCount: 2,
    });
    expect(getGenerativeClient(config)).toBeInstanceOf(GeminiDiscussionClient);
  });

  test("vertex-ai with multiple candidates -> VertexDiscussionClient", () => {
    const config = resolveConfig({
      ...baseInput,
      provider: GenerativeAIProvider.VERTEX_AI,
      candidateCount: 2,
    });
    expect(getGenerativeClient(config)).toBeInstanceOf(VertexDiscussionClient);
  });

  test("google-ai without an API key throws", () => {
    const config = resolveConfig({
      projectId: "p",
      model: "gemini-2.5-flash",
      provider: GenerativeAIProvider.GOOGLE_AI,
      candidateCount: 2,
    });
    expect(() => getGenerativeClient(config)).toThrow();
  });
});

describe("GenkitDiscussionClient.shouldUseGenkitClient", () => {
  test("false when more than one candidate is requested", () => {
    const config = resolveConfig({ ...baseInput, candidateCount: 2 });
    expect(GenkitDiscussionClient.shouldUseGenkitClient(config)).toBe(false);
  });
});
