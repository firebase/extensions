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

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { embedMany } = vi.hoisted(() => ({ embedMany: vi.fn() }));

vi.mock("genkit", () => ({
  genkit: vi.fn(() => ({ embedMany })),
}));

vi.mock("@genkit-ai/google-genai", () => ({
  googleAI: Object.assign(vi.fn(), {
    embedder: vi.fn(() => "googleai/gemini-embedding-001"),
  }),
  vertexAI: Object.assign(vi.fn(), {
    embedder: vi.fn(() => "vertexai/gemini-embedding-001"),
  }),
}));

import { googleAI, vertexAI } from "@genkit-ai/google-genai";
import { genkit } from "genkit";

import { GenkitEmbedClient } from "../src/embeddings/client/genkit";
import { CustomEndpointClient } from "../src/embeddings/client/text/custom_function";
import {
  type ResolvedVectorSearchConfig,
  resolveVectorSearchConfig,
} from "../src/export-config";

function config(
  overrides: Partial<Parameters<typeof resolveVectorSearchConfig>[0]> = {}
): ResolvedVectorSearchConfig {
  return resolveVectorSearchConfig({
    projectId: "test-project",
    instanceId: "test-instance",
    geminiApiKey: "test-api-key",
    region: "us-central1",
    ...overrides,
  });
}

describe("GenkitEmbedClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    test("initializes with the Vertex AI provider", () => {
      new GenkitEmbedClient(config({ embeddingProvider: "vertex" }));

      expect(vertexAI.embedder).toHaveBeenCalledWith("gemini-embedding-001", {
        outputDimensionality: 768,
      });
      expect(vertexAI).toHaveBeenCalledWith({ location: "us-central1" });
      expect(googleAI).not.toHaveBeenCalled();
      // The plugin mock returns undefined, so the plugin list holds one slot.
      expect(genkit).toHaveBeenCalledWith({ plugins: [undefined] });
    });

    test("omits the location when no region is configured", () => {
      new GenkitEmbedClient(
        config({ embeddingProvider: "vertex", region: undefined })
      );

      expect(vertexAI).toHaveBeenCalledWith({});
    });

    test("initializes with the Google AI provider", () => {
      new GenkitEmbedClient(config({ embeddingProvider: "gemini" }));

      expect(googleAI.embedder).toHaveBeenCalledWith("gemini-embedding-001", {
        outputDimensionality: 768,
      });
      expect(googleAI).toHaveBeenCalledWith({ apiKey: "test-api-key" });
      expect(vertexAI).not.toHaveBeenCalled();
      expect(genkit).toHaveBeenCalledWith({ plugins: [undefined] });
    });

    test("embeds one input per batch", () => {
      expect(new GenkitEmbedClient(config()).batchSize).toBe(1);
    });
  });

  describe("getEmbeddings", () => {
    test("returns embeddings for a batch of inputs", async () => {
      const client = new GenkitEmbedClient(
        config({ embeddingProvider: "vertex" })
      );
      embedMany.mockResolvedValueOnce([
        { embedding: [1, 2, 3] },
        { embedding: [4, 5, 6] },
      ]);

      const inputs = ["input1", "input2"];
      const embeddings = await client.getEmbeddings(inputs);

      expect(embedMany).toHaveBeenCalledWith({
        embedder: "vertexai/gemini-embedding-001",
        content: inputs,
      });
      expect(embeddings).toEqual([
        [1, 2, 3],
        [4, 5, 6],
      ]);
    });

    test("truncates embeddings longer than the configured dimension", async () => {
      const client = new GenkitEmbedClient(
        config({
          embeddingProvider: "custom",
          customEmbeddingsDimension: 2,
        })
      );
      embedMany.mockResolvedValueOnce([{ embedding: [1, 2, 3, 4] }]);

      await expect(client.getEmbeddings(["input"])).resolves.toEqual([[1, 2]]);
    });

    test("leaves embeddings shorter than the dimension untouched", async () => {
      const client = new GenkitEmbedClient(config());
      embedMany.mockResolvedValueOnce([{ embedding: [1, 2, 3] }]);

      await expect(client.getEmbeddings(["input"])).resolves.toEqual([
        [1, 2, 3],
      ]);
    });

    test("throws when embedding fails", async () => {
      const client = new GenkitEmbedClient(config());
      embedMany.mockRejectedValueOnce(new Error("Embedding failed"));

      await expect(client.getEmbeddings(["input"])).rejects.toThrow(
        "Embedding failed"
      );
      expect(embedMany).toHaveBeenCalledWith({
        embedder: "googleai/gemini-embedding-001",
        content: ["input"],
      });
    });
  });

  describe("getSingleEmbedding", () => {
    test("returns a single embedding for an input", async () => {
      const client = new GenkitEmbedClient(config());
      embedMany.mockResolvedValueOnce([{ embedding: [7, 8, 9] }]);

      await expect(client.getSingleEmbedding("input1")).resolves.toEqual([
        7, 8, 9,
      ]);
      expect(embedMany).toHaveBeenCalledWith({
        embedder: "googleai/gemini-embedding-001",
        content: ["input1"],
      });
    });

    test("throws when embedding fails", async () => {
      const client = new GenkitEmbedClient(config());
      embedMany.mockRejectedValueOnce(new Error("Embedding failed"));

      await expect(client.getSingleEmbedding("input")).rejects.toThrow(
        "Embedding failed"
      );
    });
  });
});

describe("CustomEndpointClient", () => {
  const customConfig = () =>
    config({
      embeddingProvider: "custom",
      customEmbeddingsEndpoint: "https://example.com/embed",
      customEmbeddingsBatchSize: 2,
      customEmbeddingsDimension: 3,
    });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("returns embeddings from a JSON response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ embeddings: [[1, 2, 3]] }), {
            headers: { "content-type": "application/json; charset=utf-8" },
          })
      )
    );

    const client = new CustomEndpointClient(customConfig());
    await expect(client.getEmbeddings(["input"])).resolves.toEqual([[1, 2, 3]]);
  });

  test("throws a clear error when the JSON does not match the expected schema", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ foo: "bar" }), {
            headers: { "content-type": "application/json" },
          })
      )
    );

    const client = new CustomEndpointClient(customConfig());
    await expect(client.getEmbeddings(["input"])).rejects.toThrow(
      "Error getting embeddings from custom endpoint: response does not match expected schema"
    );
  });

  test("throws a clear error when embeddings are missing for some inputs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ embeddings: [[1, 2, 3]] }), {
            headers: { "content-type": "application/json" },
          })
      )
    );

    const client = new CustomEndpointClient(customConfig());
    await expect(client.getEmbeddings(["input1", "input2"])).rejects.toThrow(
      /Error getting embeddings from custom endpoint: response does not contain embeddings$/
    );
  });

  test("throws a clear error when the response is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("<html>ok</html>", {
            headers: { "content-type": "text/html" },
          })
      )
    );

    const client = new CustomEndpointClient(customConfig());
    await expect(client.getEmbeddings(["input"])).rejects.toThrow(
      "Error getting embeddings from custom endpoint: response is not JSON"
    );
  });
});
