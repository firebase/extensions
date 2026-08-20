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

import { describe, expect, test, vi } from "vitest";
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

  test("true when a single candidate is requested", () => {
    const config = resolveConfig({ ...baseInput, candidateCount: 1 });
    expect(GenkitDiscussionClient.shouldUseGenkitClient(config)).toBe(true);
  });
});

describe("GenkitDiscussionClient.createModelReference", () => {
  test("passes any model id through to the plugin", () => {
    expect(
      GenkitDiscussionClient.createModelReference(
        "gemini-3.6-flash",
        "google-ai"
      ).name
    ).toBe("googleai/gemini-3.6-flash");
    expect(
      GenkitDiscussionClient.createModelReference("gemini-9-flash", "google-ai")
        .name
    ).toBe("googleai/gemini-9-flash");
    expect(
      GenkitDiscussionClient.createModelReference("gemini-9-flash", "vertex-ai")
        .name
    ).toBe("vertexai/gemini-9-flash");
  });
});

describe("VertexDiscussionClient", () => {
  test("maps request generation options to the Google Gen AI SDK", async () => {
    const generateContent = vi.fn().mockResolvedValue({
      candidates: [
        { content: { parts: [{ text: "first" }] } },
        { content: { parts: [{ text: "second" }] } },
      ],
    });
    const client = new VertexDiscussionClient({
      modelName: "gemini-2.5-flash",
      projectId: "project",
      modelLocation: "us-central1",
    });
    client.client = { models: { generateContent } } as any;

    const result = await client.send("hello", {
      model: "gemini-2.5-flash",
      projectId: "project",
      location: "us-central1",
      temperature: 0.7,
      topP: 0.8,
      topK: 9,
      candidateCount: 2,
      maxOutputTokens: 50,
      safetySettings: [],
    });

    expect(generateContent).toHaveBeenCalledWith({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: "hello" }] }],
      config: {
        temperature: 0.7,
        topP: 0.8,
        topK: 9,
        candidateCount: 2,
        maxOutputTokens: 50,
        safetySettings: [],
      },
    });
    expect(result.candidates).toEqual(["first", "second"]);
  });
});
