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
import { z } from "zod";

import { resolveVectorSearchConfig } from "../src/export-config";
import { parseLimit, parseQuerySchema, performTextQuery } from "../src/queries";
import { FirestoreVectorStoreClient } from "../src/vector-store";

describe("parseLimit", () => {
  test("returns the input as is for integers greater than 0", () => {
    expect(parseLimit(5)).toBe(5);
    expect(parseLimit(100)).toBe(100);
  });

  test("returns the parsed value for strings representing integers greater than 0", () => {
    expect(parseLimit("5")).toBe(5);
    expect(parseLimit("100")).toBe(100);
  });

  test("throws for floats or strings representing floats", () => {
    expect(() => parseLimit(5.5)).toThrow(
      "limit must be an integer greater than 0"
    );
    expect(() => parseLimit("5.5")).toThrow(
      "limit must be an integer greater than 0"
    );
  });

  test("throws for values less than 1", () => {
    expect(() => parseLimit(0)).toThrow(
      "limit must be an integer greater than 0"
    );
    expect(() => parseLimit(-5)).toThrow(
      "limit must be an integer greater than 0"
    );
    expect(() => parseLimit("0")).toThrow(
      "limit must be an integer greater than 0"
    );
    expect(() => parseLimit("-5")).toThrow(
      "limit must be an integer greater than 0"
    );
  });

  test("throws for inputs that are neither numbers nor strings", () => {
    expect(() => parseLimit(null)).toThrow(
      "limit must be a string or a number"
    );
    expect(() => parseLimit(undefined)).toThrow(
      "limit must be a string or a number"
    );
    expect(() => parseLimit({})).toThrow("limit must be a string or a number");
    expect(() => parseLimit([])).toThrow("limit must be a string or a number");
  });

  test("throws for strings that are not valid numbers", () => {
    expect(() => parseLimit("abc")).toThrow(
      "limit must be an integer greater than 0"
    );
    expect(() => parseLimit("4.5x")).toThrow(
      "limit must be an integer greater than 0"
    );
  });
});

describe("parseQuerySchema", () => {
  test("parses valid data with query and limit as a string", () => {
    expect(parseQuerySchema({ query: "example query", limit: "10" })).toEqual({
      query: "example query",
      limit: "10",
    });
  });

  test("parses valid data with query and limit as a number", () => {
    expect(parseQuerySchema({ query: "example query", limit: 10 })).toEqual({
      query: "example query",
      limit: 10,
    });
  });

  test("parses valid data with query and prefilters", () => {
    const data = {
      query: "example query",
      prefilters: [{ field: "test", operator: "==", value: "value" }],
    };
    expect(parseQuerySchema(data)).toEqual(data);
  });

  test("parses valid data with only query", () => {
    const data = { query: "example query" };
    expect(parseQuerySchema(data)).toEqual(data);
  });

  test("throws when the query field is missing or undefined", () => {
    expect(() => parseQuerySchema({ limit: "10" })).toThrow(z.ZodError);
    expect(() => parseQuerySchema({})).toThrow(z.ZodError);
    expect(() => parseQuerySchema({ query: undefined })).toThrow(z.ZodError);
  });

  test("throws when limit is neither a string nor a number", () => {
    expect(() =>
      parseQuerySchema({ query: "example query", limit: false })
    ).toThrow(z.ZodError);
  });

  test("drops unknown keys rather than passing them through", () => {
    expect(parseQuerySchema({ query: "q", extra: "nope" })).toEqual({
      query: "q",
    });
  });
});

describe("performTextQuery", () => {
  const config = resolveVectorSearchConfig({
    projectId: "test-project",
    instanceId: "test-instance",
  });

  function fakeVectorStore() {
    const query = vi.fn().mockResolvedValue({ ids: ["doc-1", "doc-2"] });
    return { query } as unknown as FirestoreVectorStoreClient & {
      query: ReturnType<typeof vi.fn>;
    };
  }

  test("embeds the query and forwards the config defaults to the vector store", async () => {
    const embedClient = {
      batchSize: 1,
      getEmbeddings: vi.fn(),
      getSingleEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    };
    const vectorStore = fakeVectorStore();

    const result = await performTextQuery({
      query: "test query",
      embedClient,
      vectorStore,
      config,
    });

    expect(embedClient.getSingleEmbedding).toHaveBeenCalledWith("test query");
    expect(vectorStore.query).toHaveBeenCalledWith(
      [0.1, 0.2, 0.3],
      config.collectionPath,
      [],
      config.defaultQueryLimit,
      config.outputFieldName
    );
    expect(result).toEqual({ result: { ids: ["doc-1", "doc-2"] } });
  });

  test("forwards an explicit limit and prefilters", async () => {
    const embedClient = {
      batchSize: 1,
      getEmbeddings: vi.fn(),
      getSingleEmbedding: vi.fn().mockResolvedValue([1]),
    };
    const vectorStore = fakeVectorStore();
    const prefilters = [{ field: "category", operator: "==", value: "test" }];

    await performTextQuery({
      query: "q",
      limit: 5,
      prefilters,
      embedClient,
      vectorStore,
      config,
    });

    expect(vectorStore.query).toHaveBeenCalledWith(
      [1],
      config.collectionPath,
      prefilters,
      5,
      config.outputFieldName
    );
  });
});
