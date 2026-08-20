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

const { listIndexes, createIndexRpc, loggerInfo } = vi.hoisted(() => ({
  listIndexes: vi.fn(),
  createIndexRpc: vi.fn(),
  loggerInfo: vi.fn(),
}));

// The admin client is constructed at module scope, so it has to be stubbed
// before `../src/queries/setup` is imported.
vi.mock("@google-cloud/firestore", () => ({
  v1: {
    FirestoreAdminClient: class {
      listIndexes = listIndexes;
      createIndex = createIndexRpc;
    },
  },
}));

vi.mock("firebase-functions", () => ({
  logger: { info: loggerInfo, log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { createIndex } from "../src/queries/setup";

describe("createIndex", () => {
  const options = {
    collectionName: "testCollection",
    dimension: 10,
    projectId: "test-project",
    fieldPath: "testField",
  };
  const parent = `projects/${options.projectId}/databases/(default)/collectionGroups/${options.collectionName}`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates the vector index when it does not exist", async () => {
    listIndexes.mockResolvedValue([[]]);
    createIndexRpc.mockResolvedValue([
      { name: "projects/test-project/operations/123" },
    ]);

    await createIndex(options);

    expect(listIndexes).toHaveBeenCalledWith({ parent });
    expect(createIndexRpc).toHaveBeenCalledWith({
      parent,
      index: {
        queryScope: "COLLECTION",
        fields: [
          {
            fieldPath: options.fieldPath,
            vectorConfig: { dimension: options.dimension, flat: {} },
          },
        ],
      },
    });
    expect(loggerInfo).toHaveBeenCalledWith("Index creation started", {
      operationName: "projects/test-project/operations/123",
    });
  });

  test("skips creation when a matching index already exists", async () => {
    listIndexes.mockResolvedValue([
      [
        {
          name: `${parent}/indexes/123`,
          fields: [{ fieldPath: options.fieldPath }],
        },
      ],
    ]);

    await createIndex(options);

    expect(listIndexes).toHaveBeenCalled();
    expect(createIndexRpc).not.toHaveBeenCalled();
    expect(loggerInfo).toHaveBeenCalledWith(
      "Index already exists, skipping index creation"
    );
  });

  test("creates the index when an existing one covers a different field", async () => {
    listIndexes.mockResolvedValue([
      [
        {
          name: `${parent}/indexes/123`,
          fields: [{ fieldPath: "someOtherField" }],
        },
      ],
    ]);
    createIndexRpc.mockResolvedValue([{ name: "op" }]);

    await createIndex(options);

    expect(createIndexRpc).toHaveBeenCalled();
  });

  test("creates the index when an existing one is on a different collection", async () => {
    listIndexes.mockResolvedValue([
      [
        {
          name: "projects/test-project/databases/(default)/collectionGroups/otherCollection/indexes/123",
          fields: [{ fieldPath: options.fieldPath }],
        },
      ],
    ]);
    createIndexRpc.mockResolvedValue([{ name: "op" }]);

    await createIndex(options);

    expect(createIndexRpc).toHaveBeenCalled();
  });

  test("propagates a listIndexes failure without creating an index", async () => {
    listIndexes.mockRejectedValue(new Error("Failed to list indexes"));

    await expect(createIndex(options)).rejects.toThrow(
      "Failed to list indexes"
    );
    expect(createIndexRpc).not.toHaveBeenCalled();
  });

  test("propagates a createIndex failure", async () => {
    listIndexes.mockResolvedValue([[]]);
    createIndexRpc.mockRejectedValue(new Error("Failed to create index"));

    await expect(createIndex(options)).rejects.toThrow(
      "Failed to create index"
    );
  });
});
