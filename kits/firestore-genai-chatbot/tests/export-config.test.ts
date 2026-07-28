import { describe, expect, test } from "vitest";
import { GenerativeAIProvider, resolveConfig } from "../src/export-config";

describe("resolveConfig", () => {
  const base = { projectId: "p", model: "gemini-2.5-flash" };

  test("applies defaults", () => {
    const c = resolveConfig(base);
    expect(c.provider).toBe(GenerativeAIProvider.GOOGLE_AI);
    expect(c.location).toBe("us-central1");
    expect(c.collectionName).toBe("generate");
    expect(c.promptField).toBe("prompt");
    expect(c.responseField).toBe("response");
    expect(c.orderField).toBe("createTime");
    expect(c.candidatesField).toBe("candidates");
    expect(c.candidateCount).toBe(1);
    expect(c.enableDiscussionOptionOverrides).toBe(false);
    expect(c.enableGenkitMonitoring).toBe(false);
    expect(c.safetySettings).toEqual([]);
  });

  test("vertex model location defaults to the function location", () => {
    expect(resolveConfig(base).vertex.modelLocation).toBe("us-central1");
    expect(
      resolveConfig({ ...base, vertexModelLocation: "europe-west2" }).vertex
        .modelLocation
    ).toBe("europe-west2");
  });

  test("nests model and apiKey under provider buckets", () => {
    const c = resolveConfig({ ...base, apiKey: "secret" });
    expect(c.vertex.model).toBe("gemini-2.5-flash");
    expect(c.googleAi.model).toBe("gemini-2.5-flash");
    expect(c.googleAi.apiKey).toBe("secret");
  });

  test("passes through explicit options", () => {
    const c = resolveConfig({
      ...base,
      provider: "vertex-ai",
      enableOverrides: true,
      candidateCount: 3,
      temperature: 0.5,
    });
    expect(c.provider).toBe(GenerativeAIProvider.VERTEX_AI);
    expect(c.enableDiscussionOptionOverrides).toBe(true);
    expect(c.candidateCount).toBe(3);
    expect(c.temperature).toBe(0.5);
  });
});
