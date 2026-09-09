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

import { resolveVectorSearchConfig } from "../src/export-config";

const base = { projectId: "test-project", instanceId: "test-instance" };

describe("resolveVectorSearchConfig", () => {
  test.each(["query", "limit", "prefilters", "result"])(
    "rejects statusFieldName %j",
    (statusFieldName) => {
      expect(() =>
        resolveVectorSearchConfig({ ...base, statusFieldName })
      ).toThrow("would overwrite a query document field");
    }
  );

  test("accepts a non-reserved statusFieldName", () => {
    const config = resolveVectorSearchConfig({
      ...base,
      statusFieldName: "vectorStatus",
    });

    expect(config.statusFieldName).toBe("vectorStatus");
  });

  test("defaults statusFieldName to status", () => {
    expect(resolveVectorSearchConfig(base).statusFieldName).toBe("status");
  });

  test("defaults the queue names to the unprefixed export names", () => {
    expect(resolveVectorSearchConfig(base).queueNames).toEqual({
      updateTrigger: "updateTrigger",
      updateTask: "updateTask",
      backfillTrigger: "backfillTrigger",
      backfillTask: "backfillTask",
    });
  });

  test("keeps an explicitly configured queue name verbatim", () => {
    const config = resolveVectorSearchConfig({
      ...base,
      queueNames: { updateTask: "customUpdateTask" },
    });

    expect(config.queueNames.updateTask).toBe("customUpdateTask");
    expect(config.queueNames.backfillTask).toBe("backfillTask");
  });
});

describe("resolveVectorSearchConfig dimension", () => {
  // `dimension` is what `createIndex` declares the vector index with, so it has
  // to match the vector each provider's client actually writes.
  test("defaults to 768 when no provider is configured", () => {
    expect(resolveVectorSearchConfig(base).dimension).toBe(768);
  });

  test.each([
    ["gemini", 768],
    ["vertex", 768],
    ["multimodal", 1408],
  ] as const)("%s uses %i dimensions", (embeddingProvider, dimension) => {
    expect(
      resolveVectorSearchConfig({ ...base, embeddingProvider }).dimension
    ).toBe(dimension);
  });

  // #3105: the extension declared 512 while writing 1536-dimension
  // `text-embedding-ada-002` vectors, so its index never covered them.
  test("uses 1536 dimensions for openai, matching text-embedding-ada-002", () => {
    expect(
      resolveVectorSearchConfig({ ...base, embeddingProvider: "openai" })
        .dimension
    ).toBe(1536);
  });

  test("uses the configured dimension for custom embeddings", () => {
    expect(
      resolveVectorSearchConfig({
        ...base,
        embeddingProvider: "custom",
        customEmbeddingsDimension: 384,
      }).dimension
    ).toBe(384);
  });

  test("rejects custom embeddings with no dimension", () => {
    expect(() =>
      resolveVectorSearchConfig({ ...base, embeddingProvider: "custom" })
    ).toThrow("Custom embeddings require customEmbeddingsDimension to be set");
  });
});
