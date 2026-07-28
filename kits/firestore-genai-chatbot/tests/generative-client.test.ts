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
