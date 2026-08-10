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

describe("resolveConfig", () => {
  const base = { projectId: "p", model: "gemini-2.5-flash" };

  test("applies defaults", () => {
    const c = resolveConfig(base);
    expect(c.provider).toBe(GenerativeAIProvider.GOOGLE_AI);
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

  test("keeps the vertex model location optional", () => {
    expect(resolveConfig(base).vertex.modelLocation).toBeUndefined();
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
