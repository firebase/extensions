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

const { embeddingsCreate, openAiConstructor } = vi.hoisted(() => ({
  embeddingsCreate: vi.fn(),
  openAiConstructor: vi.fn(),
}));

vi.mock("openai", () => ({
  default: class {
    embeddings = { create: embeddingsCreate };
    constructor(options: unknown) {
      openAiConstructor(options);
    }
  },
}));

import { googleAI, vertexAI } from "@genkit-ai/google-genai";
import { genkit } from "genkit";

import { GenkitEmbedClient } from "../src/embeddings/client/genkit";
import { OpenAiEmbedClient } from "../src/embeddings/client/text/open_ai";
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

    test("returns the embeddings as the embedder produced them", async () => {
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

describe("OpenAiEmbedClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function openAiConfig(): ResolvedVectorSearchConfig {
    return config({
      embeddingProvider: "openai",
      openAiApiKey: "test-openai-key",
    });
  }

  describe("constructor", () => {
    test("builds the client with the configured API key", () => {
      new OpenAiEmbedClient(openAiConfig());

      expect(openAiConstructor).toHaveBeenCalledWith({
        apiKey: "test-openai-key",
      });
    });

    test("throws when no API key is configured", () => {
      expect(
        () => new OpenAiEmbedClient(config({ embeddingProvider: "openai" }))
      ).toThrow("OpenAI embeddings require OPENAI_API_KEY");
    });

    test("embeds sixteen inputs per batch", () => {
      expect(new OpenAiEmbedClient(openAiConfig()).batchSize).toBe(16);
    });
  });

  describe("getEmbeddings", () => {
    test("requests text-embedding-ada-002 at its native dimension", async () => {
      const client = new OpenAiEmbedClient(openAiConfig());
      embeddingsCreate.mockResolvedValueOnce({
        data: [{ embedding: [1, 2, 3] }, { embedding: [4, 5, 6] }],
      });

      const inputs = ["input1", "input2"];

      await expect(client.getEmbeddings(inputs)).resolves.toEqual([
        [1, 2, 3],
        [4, 5, 6],
      ]);
      expect(embeddingsCreate).toHaveBeenCalledWith({
        model: "text-embedding-ada-002",
        input: inputs,
      });
    });

    test("throws when embedding fails", async () => {
      const client = new OpenAiEmbedClient(openAiConfig());
      embeddingsCreate.mockRejectedValueOnce(new Error("Embedding failed"));

      await expect(client.getEmbeddings(["input"])).rejects.toThrow(
        "Embedding failed"
      );
    });
  });

  describe("getSingleEmbedding", () => {
    test("returns a single embedding for an input", async () => {
      const client = new OpenAiEmbedClient(openAiConfig());
      embeddingsCreate.mockResolvedValueOnce({
        data: [{ embedding: [7, 8, 9] }],
      });

      await expect(client.getSingleEmbedding("input1")).resolves.toEqual([
        7, 8, 9,
      ]);
      expect(embeddingsCreate).toHaveBeenCalledWith({
        model: "text-embedding-ada-002",
        input: ["input1"],
      });
    });
  });
});
