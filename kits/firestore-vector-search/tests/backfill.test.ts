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

import type { Request } from "firebase-functions/v2/tasks";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { getSingleEmbedding, getEmbeddings, batchSize, enqueue } = vi.hoisted(
  () => ({
    getSingleEmbedding: vi.fn(),
    getEmbeddings: vi.fn(),
    batchSize: { value: 2 },
    enqueue: vi.fn(),
  })
);

vi.mock("../src/embeddings", () => ({
  createEmbedClient: vi.fn(() => ({
    get batchSize() {
      return batchSize.value;
    },
    getEmbeddings,
    getSingleEmbedding,
  })),
}));

// `queries/setup` builds a FirestoreAdminClient at module scope; the backfill
// handlers never need it.
vi.mock("../src/queries/setup", () => ({ createIndex: vi.fn() }));

vi.mock("firebase-admin/functions", () => ({
  getFunctions: () => ({ taskQueue: () => ({ enqueue }) }),
}));

vi.mock("firebase-functions", () => ({
  logger: {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  type BackfillProcess,
  type BackfillTaskData,
  chunkArray,
  enqueueTaskThread,
  getNextTaskId,
  getValidDocs,
  updateOrCreateMetadataDoc,
} from "../src/backfill";
import { resolveVectorSearchConfig } from "../src/export-config";
import {
  type HandlerContext,
  handleBackfillTask,
  handleBackfillTrigger,
  handleInit,
  handleUpdateTask,
  handleUpdateTrigger,
} from "../src/handlers";

const config = resolveVectorSearchConfig({
  projectId: "test-project",
  instanceId: "test-instance",
  region: "us-central1",
});

const METADATA_PATH = config.indexMetadataDocumentPath;
const COLLECTION = config.collectionPath;
const EMBEDDING = [0.1, 0.2, 0.3];

const METADATA = {
  collectionName: COLLECTION,
  instanceId: config.instanceId,
  embeddingProvider: config.embeddingProvider,
  dimension: config.dimension,
  inputField: config.inputFieldName,
  outputField: config.outputFieldName,
};

interface Write {
  op: "set" | "update";
  path: string;
  data: Record<string, unknown>;
  merge?: boolean;
}

/**
 * A minimal in-memory Firestore that records every write, so the tests can
 * assert on the exact payloads the backfill writes back onto documents.
 */
function makeFirestore(seed: Record<string, Record<string, unknown>> = {}) {
  const store = new Map(Object.entries(seed));
  const writes: Write[] = [];
  const commits: Write[][] = [];

  const merge = (path: string, data: Record<string, unknown>) => {
    store.set(path, { ...(store.get(path) ?? {}), ...data });
  };

  const ref = (path: string) => ({
    path,
    id: path.split("/").pop() as string,
    get: async () => snapshot(path),
    set: async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
      writes.push({ op: "set", path, data, merge: opts?.merge });
      if (opts?.merge) merge(path, data);
      else store.set(path, data);
    },
    update: async (data: Record<string, unknown>) => {
      writes.push({ op: "update", path, data });
      merge(path, data);
    },
  });

  const snapshot = (path: string) => {
    const data = store.get(path);
    return {
      exists: data !== undefined,
      data: () => data,
      get: (field: string) => data?.[field],
      ref: ref(path),
    };
  };

  const firestore = {
    doc: (path: string) => ref(path),
    collection: (name: string) => ({
      doc: (id: string) => ref(`${name}/${id}`),
      listDocuments: async () =>
        [...store.keys()]
          .filter(
            (key) =>
              key.startsWith(`${name}/`) &&
              key.slice(name.length + 1).includes("/") === false
          )
          .map((key) => ref(key)),
      get: async () => {
        throw new Error("the backfill must not read the whole collection");
      },
    }),
    runTransaction: async <T>(
      fn: (tx: {
        getAll: (
          ...refs: { path: string }[]
        ) => Promise<ReturnType<typeof snapshot>[]>;
      }) => Promise<T>
    ) =>
      fn({
        getAll: async (...refs) => refs.map((r) => snapshot(r.path)),
      }),
    batch: () => {
      const ops: Write[] = [];
      return {
        set: (
          target: { path: string },
          data: Record<string, unknown>,
          opts?: { merge?: boolean }
        ) => {
          ops.push({ op: "set", path: target.path, data, merge: opts?.merge });
        },
        update: (target: { path: string }, data: Record<string, unknown>) => {
          ops.push({ op: "update", path: target.path, data });
        },
        commit: async () => {
          commits.push([...ops]);
          for (const op of ops) {
            writes.push(op);
            merge(op.path, op.data);
          }
          ops.length = 0;
        },
      };
    },
  };

  return { firestore, store, writes, commits };
}

function makeCtx(seed: Record<string, Record<string, unknown>> = {}) {
  const fake = makeFirestore(seed);
  const ctx = {
    firestore: fake.firestore,
    config,
  } as unknown as HandlerContext;
  return { ...fake, ctx };
}

function taskRequest(data: BackfillTaskData) {
  return { data } as unknown as Request<BackfillTaskData>;
}

/** A progress document that still has one chunk outstanding. */
function progress(overrides: Record<string, unknown> = {}) {
  return {
    ...METADATA,
    backfillJobsTotal: 4,
    backfillJobsProcessed: 0,
    backfillJobsSkipped: 0,
    backfillJobsFailed: 0,
    backfillStatus: "RUNNING",
    ...overrides,
  };
}

function docWrites(writes: Write[], id: string) {
  return writes.filter((write) => write.path === `${COLLECTION}/${id}`);
}

function stateOf(writes: Write[], id: string) {
  const last = docWrites(writes, id).at(-1);
  return last?.data[`${config.statusFieldName}.state`];
}

beforeEach(() => {
  vi.clearAllMocks();
  // `clearAllMocks` keeps implementations, and some tests install a rejecting
  // or recording `enqueue`.
  enqueue.mockReset();
  batchSize.value = 2;
  getSingleEmbedding.mockResolvedValue(EMBEDDING);
  getEmbeddings.mockImplementation(async (inputs: string[]) =>
    inputs.map(() => EMBEDDING)
  );
});

describe("chunkArray", () => {
  test("splits into chunks of at most the given size", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  test("returns nothing for an empty array", () => {
    expect(chunkArray([], 2)).toEqual([]);
  });
});

describe("getNextTaskId", () => {
  test("increments the counter", () => {
    expect(getNextTaskId("kit-test-instance-task-1", "test-instance")).toBe(
      "kit-test-instance-task-2"
    );
    expect(getNextTaskId("kit-test-instance-task-49", "test-instance")).toBe(
      "kit-test-instance-task-50"
    );
  });

  test('reads the counter when the instance id itself contains "task-"', () => {
    expect(getNextTaskId("kit-my-task-force-task-3", "my-task-force")).toBe(
      "kit-my-task-force-task-4"
    );
  });

  test("rejects an id that is not part of this instance's thread", () => {
    expect(() => getNextTaskId("task-1", "test-instance")).toThrow(
      "Invalid task ID format: task-1"
    );
    expect(() =>
      getNextTaskId("kit-other-instance-task-1", "test-instance")
    ).toThrow("Invalid task ID format");
  });
});

describe("updateOrCreateMetadataDoc", () => {
  test("creates the metadata document and requires a pass", async () => {
    const { firestore, writes } = makeFirestore();

    const result = await updateOrCreateMetadataDoc(
      firestore as never,
      METADATA_PATH,
      METADATA
    );

    expect(result).toEqual({ path: METADATA_PATH, shouldBackfill: true });
    expect(writes).toHaveLength(1);
    expect(writes[0].merge).toBe(true);
    expect(writes[0].data).toMatchObject(METADATA);
  });

  test("skips the pass when the embedding configuration is unchanged", async () => {
    const { firestore, writes } = makeFirestore({ [METADATA_PATH]: METADATA });

    const result = await updateOrCreateMetadataDoc(
      firestore as never,
      METADATA_PATH,
      METADATA
    );

    expect(result.shouldBackfill).toBe(false);
    expect(writes).toHaveLength(0);
  });

  test.each([
    ["embeddingProvider", { embeddingProvider: "openai" }],
    ["dimension", { dimension: 512 }],
    ["inputField", { inputField: "text" }],
    ["outputField", { outputField: "vector" }],
  ])("requires a pass when %s changed", async (_field, previous) => {
    const { firestore, writes } = makeFirestore({
      [METADATA_PATH]: { ...METADATA, ...previous },
    });

    const result = await updateOrCreateMetadataDoc(
      firestore as never,
      METADATA_PATH,
      METADATA
    );

    expect(result.shouldBackfill).toBe(true);
    expect(writes).toHaveLength(1);
    expect(writes[0].data).toMatchObject(METADATA);
  });

  test("merges so the progress counters do not replace the comparison fields", async () => {
    const { firestore, store } = makeFirestore();

    await updateOrCreateMetadataDoc(
      firestore as never,
      METADATA_PATH,
      METADATA
    );
    await enqueueTaskThread({
      firestore: firestore as never,
      tasksDoc: METADATA_PATH,
      queue: { enqueue } as never,
      taskParams: ["doc-1"],
      instanceId: config.instanceId,
    });

    // The extension replaced the document here, which lost these fields and
    // made every later deploy re-embed the whole collection.
    expect(store.get(METADATA_PATH)).toMatchObject(METADATA);

    const second = await updateOrCreateMetadataDoc(
      firestore as never,
      METADATA_PATH,
      METADATA
    );
    expect(second.shouldBackfill).toBe(false);
  });
});

describe("enqueueTaskThread", () => {
  test("chunks ids, records every chunk, and dispatches only the first task", async () => {
    const { firestore, writes, store } = makeFirestore();
    const ids = Array.from({ length: 120 }, (_, i) => `doc-${i}`);

    await enqueueTaskThread({
      firestore: firestore as never,
      tasksDoc: METADATA_PATH,
      queue: { enqueue } as never,
      taskParams: ids,
      instanceId: config.instanceId,
    });

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith({
      taskId: "kit-test-instance-task-1",
      chunk: ids.slice(0, 50),
      tasksDoc: METADATA_PATH,
    });

    const enqueueDocs = writes.filter((write) =>
      write.path.startsWith(`${METADATA_PATH}/enqueues/`)
    );
    expect(enqueueDocs).toHaveLength(3);
    expect(enqueueDocs[2].data).toEqual({
      taskId: "kit-test-instance-task-3",
      status: "PENDING",
      chunk: ids.slice(100),
    });

    expect(store.get(METADATA_PATH)).toMatchObject({
      backfillJobsTotal: 120,
      backfillJobsProcessed: 0,
      backfillJobsSkipped: 0,
      backfillJobsFailed: 0,
      backfillStatus: "RUNNING",
    });
    expect(writes[0].merge).toBe(true);
  });

  test("records every chunk before dispatching the first task", async () => {
    const { firestore, writes } = makeFirestore();
    const ids = Array.from({ length: 120 }, (_, i) => `doc-${i}`);
    const dispatchedAfter: number[] = [];
    enqueue.mockImplementation(async () => {
      dispatchedAfter.push(
        writes.filter((write) =>
          write.path.startsWith(`${METADATA_PATH}/enqueues/`)
        ).length
      );
    });

    await enqueueTaskThread({
      firestore: firestore as never,
      tasksDoc: METADATA_PATH,
      queue: { enqueue } as never,
      taskParams: ids,
      instanceId: config.instanceId,
    });

    // All three enqueue documents exist by the time task-1 runs, so it can
    // always find its successor.
    expect(dispatchedAfter).toEqual([3]);
  });

  test("commits the trailing chunks when there are more than 50 of them", async () => {
    const { firestore, writes } = makeFirestore();
    const ids = Array.from({ length: 2600 }, (_, i) => `doc-${i}`);

    await enqueueTaskThread({
      firestore: firestore as never,
      tasksDoc: METADATA_PATH,
      queue: { enqueue } as never,
      taskParams: ids,
      instanceId: config.instanceId,
    });

    // 52 chunks. The extension only committed on every 50th, so the last two
    // enqueue documents were never written and the thread stalled on them.
    const enqueueDocs = writes.filter((write) =>
      write.path.startsWith(`${METADATA_PATH}/enqueues/`)
    );
    expect(enqueueDocs).toHaveLength(52);
    expect(enqueueDocs.at(-1)?.data).toMatchObject({
      taskId: "kit-test-instance-task-52",
    });
  });

  test("writes nothing but the progress document for an empty id list", async () => {
    const { firestore, writes } = makeFirestore();

    await enqueueTaskThread({
      firestore: firestore as never,
      tasksDoc: METADATA_PATH,
      queue: { enqueue } as never,
      taskParams: [],
      instanceId: config.instanceId,
    });

    expect(enqueue).not.toHaveBeenCalled();
    expect(writes).toHaveLength(1);
    expect(writes[0].data).toMatchObject({ backfillJobsTotal: 0 });
  });
});

describe("handleBackfillTask", () => {
  const TASK = {
    taskId: "kit-test-instance-task-1",
    chunk: ["doc-1", "doc-2"],
    tasksDoc: METADATA_PATH,
  };

  test("embeds a batch of documents in a single call", async () => {
    const { ctx, writes, commits } = makeCtx({
      [METADATA_PATH]: progress(),
      [`${METADATA_PATH}/enqueues/${TASK.taskId}`]: { chunk: TASK.chunk },
      [`${METADATA_PATH}/enqueues/kit-test-instance-task-2`]: {
        chunk: ["doc-3", "doc-4"],
      },
      [`${COLLECTION}/doc-1`]: { input: "one" },
      [`${COLLECTION}/doc-2`]: { input: "two" },
    });

    await handleBackfillTask(taskRequest(TASK), ctx);

    expect(getEmbeddings).toHaveBeenCalledTimes(1);
    expect(getEmbeddings).toHaveBeenCalledWith(["one", "two"]);
    expect(getSingleEmbedding).not.toHaveBeenCalled();

    expect(stateOf(writes, "doc-1")).toBe("BACKFILLED");
    expect(stateOf(writes, "doc-2")).toBe("BACKFILLED");
    expect(docWrites(writes, "doc-1")[0].data).toHaveProperty(
      config.outputFieldName
    );
    // Both documents are written in one committed batch.
    expect(
      commits.some(
        (ops) =>
          ops.length === 2 && ops.every((op) => op.path.startsWith(COLLECTION))
      )
    ).toBe(true);
  });

  test("marks the enqueue document and dispatches the next task", async () => {
    const { ctx, writes } = makeCtx({
      [METADATA_PATH]: progress(),
      [`${METADATA_PATH}/enqueues/${TASK.taskId}`]: { chunk: TASK.chunk },
      [`${METADATA_PATH}/enqueues/kit-test-instance-task-2`]: {
        chunk: ["doc-3", "doc-4"],
      },
      [`${COLLECTION}/doc-1`]: { input: "one" },
      [`${COLLECTION}/doc-2`]: { input: "two" },
    });

    await handleBackfillTask(taskRequest(TASK), ctx);

    const taskDocWrites = writes.filter(
      (write) => write.path === `${METADATA_PATH}/enqueues/${TASK.taskId}`
    );
    expect(taskDocWrites.map((write) => write.data.status)).toEqual([
      "PROCESSING",
      "DONE",
    ]);
    expect(enqueue).toHaveBeenCalledWith({
      taskId: "kit-test-instance-task-2",
      chunk: ["doc-3", "doc-4"],
      tasksDoc: METADATA_PATH,
    });
    expect(
      writes.find(
        (write) =>
          write.path === METADATA_PATH && "backfillJobsProcessed" in write.data
      )
    ).toBeDefined();
  });

  test("finishes the thread instead of dispatching when every job is accounted for", async () => {
    const { ctx, writes } = makeCtx({
      [METADATA_PATH]: progress({
        backfillJobsTotal: 2,
      }),
      [`${METADATA_PATH}/enqueues/${TASK.taskId}`]: { chunk: TASK.chunk },
      [`${COLLECTION}/doc-1`]: { input: "one" },
      [`${COLLECTION}/doc-2`]: { input: "two" },
    });

    await handleBackfillTask(taskRequest(TASK), ctx);

    expect(enqueue).not.toHaveBeenCalled();
    expect(
      writes.some(
        (write) =>
          write.path === METADATA_PATH && write.data.backfillStatus === "DONE"
      )
    ).toBe(true);
  });

  test("uses the single-document path for a chunk with one eligible document", async () => {
    const { ctx, writes } = makeCtx({
      [METADATA_PATH]: progress({ backfillJobsTotal: 1 }),
      [`${METADATA_PATH}/enqueues/${TASK.taskId}`]: { chunk: ["doc-1"] },
      [`${COLLECTION}/doc-1`]: { input: "one" },
    });

    await handleBackfillTask(taskRequest({ ...TASK, chunk: ["doc-1"] }), ctx);

    expect(getSingleEmbedding).toHaveBeenCalledWith("one");
    expect(getEmbeddings).not.toHaveBeenCalled();
    expect(stateOf(writes, "doc-1")).toBe("BACKFILLED");
  });

  test("skips documents without a usable input string", async () => {
    const { ctx, writes } = makeCtx({
      [METADATA_PATH]: progress({ backfillJobsTotal: 2 }),
      [`${METADATA_PATH}/enqueues/${TASK.taskId}`]: { chunk: TASK.chunk },
      [`${COLLECTION}/doc-1`]: { input: 42 },
      [`${COLLECTION}/doc-2`]: { input: "" },
    });

    await handleBackfillTask(taskRequest(TASK), ctx);

    expect(getEmbeddings).not.toHaveBeenCalled();
    expect(getSingleEmbedding).not.toHaveBeenCalled();
    expect(docWrites(writes, "doc-1")).toHaveLength(0);
    expect(docWrites(writes, "doc-2")).toHaveLength(0);
  });

  test("skips a document that is missing entirely", async () => {
    const { ctx, writes } = makeCtx({
      [METADATA_PATH]: progress({ backfillJobsTotal: 2 }),
      [`${METADATA_PATH}/enqueues/${TASK.taskId}`]: { chunk: TASK.chunk },
    });

    await handleBackfillTask(taskRequest(TASK), ctx);

    expect(getEmbeddings).not.toHaveBeenCalled();
    expect(writes.filter((write) => write.path.startsWith(COLLECTION))).toEqual(
      []
    );
  });

  test("skips documents whose status is already in a non-backfill state", async () => {
    const { ctx, writes } = makeCtx({
      [METADATA_PATH]: progress({ backfillJobsTotal: 2 }),
      [`${METADATA_PATH}/enqueues/${TASK.taskId}`]: { chunk: TASK.chunk },
      [`${COLLECTION}/doc-1`]: { input: "one", status: { state: "COMPLETED" } },
      [`${COLLECTION}/doc-2`]: { input: "two", status: { state: "ERROR" } },
    });

    await handleBackfillTask(taskRequest(TASK), ctx);

    expect(getEmbeddings).not.toHaveBeenCalled();
    expect(getSingleEmbedding).not.toHaveBeenCalled();
    expect(docWrites(writes, "doc-1")).toHaveLength(0);
  });

  test("re-embeds a document that was previously backfilled", async () => {
    const { ctx, writes } = makeCtx({
      [METADATA_PATH]: progress({ backfillJobsTotal: 1 }),
      [`${METADATA_PATH}/enqueues/${TASK.taskId}`]: { chunk: ["doc-1"] },
      [`${COLLECTION}/doc-1`]: {
        input: "one",
        status: { state: "BACKFILLED" },
      },
    });

    await handleBackfillTask(taskRequest({ ...TASK, chunk: ["doc-1"] }), ctx);

    expect(getSingleEmbedding).toHaveBeenCalledWith("one");
    expect(stateOf(writes, "doc-1")).toBe("BACKFILLED");
  });

  test("marks a failed batch as FAILED_BACKFILL without failing the task", async () => {
    const { ctx, writes } = makeCtx({
      [METADATA_PATH]: progress({ backfillJobsTotal: 2 }),
      [`${METADATA_PATH}/enqueues/${TASK.taskId}`]: { chunk: TASK.chunk },
      [`${COLLECTION}/doc-1`]: { input: "one" },
      [`${COLLECTION}/doc-2`]: { input: "two" },
    });
    getEmbeddings.mockRejectedValue(new Error("provider is down"));

    await expect(
      handleBackfillTask(taskRequest(TASK), ctx)
    ).resolves.toBeUndefined();

    expect(stateOf(writes, "doc-1")).toBe("FAILED_BACKFILL");
    expect(stateOf(writes, "doc-2")).toBe("FAILED_BACKFILL");
    expect(docWrites(writes, "doc-1")[0].data).not.toHaveProperty(
      config.outputFieldName
    );
  });

  test("marks a failed single document as FAILED_BACKFILL without failing the task", async () => {
    const { ctx, writes } = makeCtx({
      [METADATA_PATH]: progress({ backfillJobsTotal: 1 }),
      [`${METADATA_PATH}/enqueues/${TASK.taskId}`]: { chunk: ["doc-1"] },
      [`${COLLECTION}/doc-1`]: { input: "one" },
    });
    getSingleEmbedding.mockRejectedValue(new Error("provider is down"));

    await expect(
      handleBackfillTask(taskRequest({ ...TASK, chunk: ["doc-1"] }), ctx)
    ).resolves.toBeUndefined();

    expect(stateOf(writes, "doc-1")).toBe("FAILED_BACKFILL");
  });

  test("splits a chunk into provider-sized embedding calls", async () => {
    batchSize.value = 2;
    const chunk = ["doc-1", "doc-2", "doc-3"];
    const { ctx } = makeCtx({
      [METADATA_PATH]: progress({ backfillJobsTotal: 3 }),
      [`${METADATA_PATH}/enqueues/${TASK.taskId}`]: { chunk },
      [`${COLLECTION}/doc-1`]: { input: "one" },
      [`${COLLECTION}/doc-2`]: { input: "two" },
      [`${COLLECTION}/doc-3`]: { input: "three" },
    });

    await handleBackfillTask(taskRequest({ ...TASK, chunk }), ctx);

    expect(getEmbeddings.mock.calls).toEqual([[["one", "two"]], [["three"]]]);
  });

  test("does nothing for an empty chunk", async () => {
    const { ctx, writes } = makeCtx({ [METADATA_PATH]: progress() });

    await handleBackfillTask(taskRequest({ ...TASK, chunk: [] }), ctx);

    expect(writes).toEqual([]);
    expect(enqueue).not.toHaveBeenCalled();
  });

  test("rejects a progress document without counters", async () => {
    const { ctx } = makeCtx({
      [METADATA_PATH]: { ...METADATA },
      [`${METADATA_PATH}/enqueues/${TASK.taskId}`]: { chunk: TASK.chunk },
      [`${COLLECTION}/doc-1`]: { input: "one" },
      [`${COLLECTION}/doc-2`]: { input: "two" },
    });

    await expect(handleBackfillTask(taskRequest(TASK), ctx)).rejects.toThrow(
      "Invalid task document"
    );
  });

  test("fails when the next enqueue document is missing", async () => {
    const { ctx } = makeCtx({
      [METADATA_PATH]: progress(),
      [`${METADATA_PATH}/enqueues/${TASK.taskId}`]: { chunk: TASK.chunk },
      [`${COLLECTION}/doc-1`]: { input: "one" },
      [`${COLLECTION}/doc-2`]: { input: "two" },
    });

    await expect(handleBackfillTask(taskRequest(TASK), ctx)).rejects.toThrow(
      "Next task document kit-test-instance-task-2 does not exist."
    );
  });
});

describe("handleUpdateTask", () => {
  const TASK = {
    taskId: "kit-test-instance-task-1",
    chunk: ["doc-1", "doc-2"],
    tasksDoc: METADATA_PATH,
  };

  test("only re-embeds documents that already carry an embedding", async () => {
    const { ctx, writes } = makeCtx({
      [METADATA_PATH]: progress({ backfillJobsTotal: 2 }),
      [`${METADATA_PATH}/enqueues/${TASK.taskId}`]: { chunk: TASK.chunk },
      [`${COLLECTION}/doc-1`]: { input: "one", embedding: [0, 0, 0] },
      [`${COLLECTION}/doc-2`]: { input: "two" },
    });

    await handleUpdateTask(taskRequest(TASK), ctx);

    expect(getSingleEmbedding).toHaveBeenCalledTimes(1);
    expect(getSingleEmbedding).toHaveBeenCalledWith("one");
    expect(stateOf(writes, "doc-1")).toBe("BACKFILLED");
    expect(docWrites(writes, "doc-2")).toHaveLength(0);
  });

  test("embeds one document per call and fails only the documents that failed", async () => {
    const { ctx, writes } = makeCtx({
      [METADATA_PATH]: progress({ backfillJobsTotal: 2 }),
      [`${METADATA_PATH}/enqueues/${TASK.taskId}`]: { chunk: TASK.chunk },
      [`${COLLECTION}/doc-1`]: { input: "one", embedding: [0, 0, 0] },
      [`${COLLECTION}/doc-2`]: { input: "two", embedding: [0, 0, 0] },
    });
    getSingleEmbedding.mockImplementation(async (input: string) => {
      if (input === "two") throw new Error("provider is down");
      return EMBEDDING;
    });

    await expect(
      handleUpdateTask(taskRequest(TASK), ctx)
    ).resolves.toBeUndefined();

    expect(getEmbeddings).not.toHaveBeenCalled();
    expect(stateOf(writes, "doc-1")).toBe("BACKFILLED");
    expect(docWrites(writes, "doc-1")[0].data).toHaveProperty(
      config.outputFieldName
    );
    expect(stateOf(writes, "doc-2")).toBe("FAILED_BACKFILL");
    expect(docWrites(writes, "doc-2")[0].data).not.toHaveProperty(
      config.outputFieldName
    );
  });
});

describe.each([
  ["handleBackfillTrigger", handleBackfillTrigger],
  ["handleUpdateTrigger", handleUpdateTrigger],
])("%s", (_name, handler) => {
  const request = {} as Request<unknown>;

  test("enumerates the collection by reference and enqueues the first task", async () => {
    const { ctx, writes } = makeCtx({
      [`${COLLECTION}/doc-1`]: { input: "one" },
      [`${COLLECTION}/doc-2`]: { input: "two" },
    });

    await handler(request, ctx);

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith({
      taskId: "kit-test-instance-task-1",
      chunk: ["doc-1", "doc-2"],
      tasksDoc: METADATA_PATH,
    });
    expect(writes[0].data).toMatchObject(METADATA);
  });

  test("skips the pass when the embedding configuration is unchanged", async () => {
    const { ctx, writes } = makeCtx({
      [METADATA_PATH]: { ...METADATA },
      [`${COLLECTION}/doc-1`]: { input: "one" },
    });

    await handler(request, ctx);

    expect(enqueue).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });

  test("enqueues nothing for an empty collection", async () => {
    const { ctx } = makeCtx();

    await handler(request, ctx);

    expect(enqueue).not.toHaveBeenCalled();
  });

  test("swallows an enqueue failure so the trigger task is not retried", async () => {
    const { ctx } = makeCtx({ [`${COLLECTION}/doc-1`]: { input: "one" } });
    enqueue.mockRejectedValue(new Error("queue not found"));

    await expect(handler(request, ctx)).resolves.toBeUndefined();
  });
});

describe("handleInit", () => {
  function ctxWith(overrides: {
    doBackfill: boolean;
    updateOnConfigure: boolean;
  }) {
    const { firestore } = makeFirestore();
    return {
      firestore,
      config: resolveVectorSearchConfig({
        projectId: "test-project",
        instanceId: "test-instance",
        region: "us-central1",
        ...overrides,
      }),
    } as unknown as HandlerContext;
  }

  test("enqueues only the backfill trigger when both passes are enabled", async () => {
    await handleInit(ctxWith({ doBackfill: true, updateOnConfigure: true }));

    // Both passes share one task thread on the metadata document, so running
    // them together would have them overwrite each other's progress.
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  test("enqueues the backfill trigger on its own", async () => {
    await handleInit(ctxWith({ doBackfill: true, updateOnConfigure: false }));

    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  test("enqueues the update trigger on its own", async () => {
    await handleInit(ctxWith({ doBackfill: false, updateOnConfigure: true }));

    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  test("enqueues nothing when neither pass is enabled", async () => {
    await handleInit(ctxWith({ doBackfill: false, updateOnConfigure: false }));

    expect(enqueue).not.toHaveBeenCalled();
  });
});

describe("getValidDocs", () => {
  const process = {
    id: "test-instance",
    batchSize: 2,
    shouldBackfill: (data: Record<string, unknown>) =>
      typeof data.input === "string" && data.input.length > 0,
    processFn: async () => ({}),
  } satisfies BackfillProcess;

  /** A Firestore whose transaction callback runs twice, as a retry would. */
  function retryingFirestore(seed: Record<string, Record<string, unknown>>) {
    let attempts = 0;
    const snapshot = (path: string) => ({
      exists: seed[path] !== undefined,
      data: () => seed[path],
      ref: { path, id: path.split("/").pop() as string },
    });
    return {
      attempts: () => attempts,
      firestore: {
        collection: (name: string) => ({
          doc: (id: string) => ({ path: `${name}/${id}` }),
        }),
        runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            getAll: async (...refs: { path: string }[]) =>
              refs.map((r) => snapshot(r.path)),
          };
          attempts++;
          await fn(tx);
          attempts++;
          return fn(tx);
        },
      },
    };
  }

  test("does not double-count documents when the transaction retries", async () => {
    const { firestore, attempts } = retryingFirestore({
      [`${COLLECTION}/doc-1`]: { input: "one" },
      [`${COLLECTION}/doc-2`]: { input: "" },
    });

    const result = await getValidDocs(process, ["doc-1", "doc-2"], {
      firestore: firestore as never,
      collectionName: COLLECTION,
      statusField: config.statusFieldName,
    });

    expect(attempts()).toBe(2);
    expect(result.validDocuments.map((d) => d.ref.id)).toEqual(["doc-1"]);
    expect(result.skippedDocuments.map((d) => d.ref.id)).toEqual(["doc-2"]);
  });
});
