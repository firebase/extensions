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

import { declaredParams } from "firebase-functions/params";
import { describe, expect, test } from "vitest";

import "../src/config";
import {
  type EmbeddingProvider,
  resolveVectorSearchConfig,
} from "../src/export-config";

describe("EMBEDDING_PROVIDER", () => {
  test("the provider select does not offer multimodal", () => {
    const param = declaredParams.find((p) => p.name === "EMBEDDING_PROVIDER");
    expect(param).toBeDefined();

    const input = param?.options.input;
    if (!input || !("select" in input)) {
      throw new Error("EMBEDDING_PROVIDER must be a select input");
    }

    const values = input.select.options.map((option) => option.value);
    expect(values).toEqual(["gemini", "openai", "vertex", "custom"]);
  });

  test("resolving a config with the removed multimodal provider throws", () => {
    expect(() =>
      resolveVectorSearchConfig({
        projectId: "demo-project",
        instanceId: "test",
        embeddingProvider: "multimodal" as unknown as EmbeddingProvider,
      })
    ).toThrow(
      'Unsupported embedding provider "multimodal". Supported providers: gemini, openai, vertex, custom.'
    );
  });

  test("every offered provider resolves", () => {
    const providers: ReadonlyArray<EmbeddingProvider> = [
      "gemini",
      "openai",
      "vertex",
      "custom",
    ];
    for (const embeddingProvider of providers) {
      const config = resolveVectorSearchConfig({
        projectId: "demo-project",
        instanceId: "test",
        embeddingProvider,
        customEmbeddingsDimension: 256,
      });
      expect(config.embeddingProvider).toBe(embeddingProvider);
      expect(config.dimension).toBeGreaterThan(0);
    }
  });
});
