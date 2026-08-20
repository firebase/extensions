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

/**
 * In-memory doubles for Firestore and Pub/Sub.
 *
 * The extension suite drives these behaviours through the Firebase emulators
 * (`firebase emulators:exec jest`). Kits have no emulator harness, so the same
 * behaviours are exercised against fakes: an in-memory document store that
 * implements the surface `src/` actually touches, plus a Pub/Sub double that
 * queues published messages so a test can pump discovery/deletion rounds
 * synchronously instead of polling `onSnapshot`.
 */

import type {
  DeleteMessageData,
  HandlerContext,
  SearchMessageData,
} from "../src/handlers";
import { handleDeletion, handleSearch } from "../src/handlers";
import type { ResolvedDeleteUserDataConfig } from "../src/export-config";
import { resolveDeleteUserDataConfig } from "../src/export-config";

type DocData = Record<string, unknown>;

export interface RecursiveDeleteCall {
  path: string;
  type: "document" | "collection";
}

export interface FakeFirestore {
  /** Raw store, keyed by full document path. */
  store: Map<string, DocData>;
  /** Every `db.recursiveDelete()` invocation, in order. */
  recursiveDeleteCalls: RecursiveDeleteCall[];
  /** Number of committed write batches. */
  batchCommits: number;
  doc(path: string): any;
  collection(path: string): any;
  listCollections(): Promise<any[]>;
  getAll(...refs: any[]): Promise<any[]>;
  batch(): any;
  bulkWriter(): any;
  recursiveDelete(ref: any, bulkWriter?: any): Promise<void>;
  runTransaction(fn: (transaction: any) => Promise<void>): Promise<void>;
  /** Convenience: seed a document. */
  seed(path: string, data?: DocData): void;
  /** Convenience: does a document exist? */
  exists(path: string): boolean;
}

const lastSegment = (path: string): string => path.split("/").at(-1) as string;

const isDocumentPath = (path: string): boolean =>
  path.split("/").length % 2 === 0;

function readField(data: DocData | undefined, fieldPath: unknown): unknown {
  if (!data) return undefined;
  const segments = String(fieldPath).split(".");
  let current: unknown = data;
  for (const segment of segments) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as DocData)[segment];
  }
  return current;
}

export function createFakeFirestore(
  seed: Record<string, DocData> = {}
): FakeFirestore {
  const store = new Map<string, DocData>(
    Object.entries(seed).map(([path, data]) => [path, { ...data }])
  );
  const recursiveDeleteCalls: RecursiveDeleteCall[] = [];
  let autoId = 0;
  let batchCommits = 0;

  const childIds = (prefix: string): string[] => {
    const scoped = prefix.length > 0 ? `${prefix}/` : "";
    const ids = new Set<string>();
    for (const path of store.keys()) {
      if (!path.startsWith(scoped)) continue;
      ids.add(path.slice(scoped.length).split("/")[0]);
    }
    return [...ids];
  };

  const snapshot = (path: string) => {
    const data = store.get(path);
    return {
      id: lastSegment(path),
      ref: docRef(path),
      exists: data !== undefined,
      data: () => (data ? { ...data } : undefined),
      get: (fieldPath: unknown) => readField(data, fieldPath),
    };
  };

  function docRef(path: string): any {
    return {
      id: lastSegment(path),
      path,
      get: async () => snapshot(path),
      set: async (data: DocData) => {
        store.set(path, { ...data });
      },
      create: async (data: DocData) => {
        store.set(path, { ...data });
      },
      delete: async () => {
        store.delete(path);
      },
      collection: (id: string) => collectionRef(`${path}/${id}`),
      listCollections: async () =>
        childIds(path).map((id) => collectionRef(`${path}/${id}`)),
    };
  }

  function collectionRef(path: string): any {
    return {
      id: lastSegment(path),
      path,
      doc: (id?: string) => docRef(`${path}/${id ?? `auto-${++autoId}`}`),
      add: async (data: DocData) => {
        const ref = docRef(`${path}/auto-${++autoId}`);
        await ref.set(data);
        return ref;
      },
      get: async () => {
        const docs = childIds(path)
          .map((id) => snapshot(`${path}/${id}`))
          .filter((doc) => doc.exists);
        return { docs, empty: docs.length === 0, size: docs.length };
      },
      // Firestore returns refs for "missing" documents that only exist as
      // parents of subcollections; `childIds` covers that by walking paths.
      listDocuments: async () =>
        childIds(path).map((id) => docRef(`${path}/${id}`)),
    };
  }

  const db: FakeFirestore = {
    store,
    recursiveDeleteCalls,
    get batchCommits() {
      return batchCommits;
    },
    doc: (path: string) => docRef(path),
    collection: (path: string) => collectionRef(path),
    listCollections: async () => childIds("").map((id) => collectionRef(id)),
    getAll: async (...refs: any[]) => refs.map((ref) => snapshot(ref.path)),
    batch: () => {
      const deletes: string[] = [];
      return {
        delete: (ref: any) => deletes.push(ref.path),
        commit: async () => {
          batchCommits++;
          for (const path of deletes) store.delete(path);
          return deletes.map(() => ({}));
        },
      };
    },
    bulkWriter: () => ({
      onWriteError: (_handler: unknown) => undefined,
      close: async () => undefined,
    }),
    recursiveDelete: async (ref: any) => {
      recursiveDeleteCalls.push({
        path: ref.path,
        type: isDocumentPath(ref.path) ? "document" : "collection",
      });
      for (const path of [...store.keys()]) {
        if (path === ref.path || path.startsWith(`${ref.path}/`)) {
          store.delete(path);
        }
      }
    },
    runTransaction: async (fn: (transaction: any) => Promise<void>) => {
      const deletes: string[] = [];
      await fn({ delete: (ref: any) => deletes.push(ref.path) });
      for (const path of deletes) store.delete(path);
    },
    seed: (path: string, data: DocData = { seeded: true }) => {
      store.set(path, { ...data });
    },
    exists: (path: string) => store.has(path),
  };

  return db;
}

export interface PublishedMessage {
  topic: string;
  json: unknown;
}

export interface FakePubSub {
  published: PublishedMessage[];
  topic(name: string): {
    publishMessage(message: { json: unknown }): Promise<string>;
  };
}

export function createFakePubSub(): FakePubSub {
  const published: PublishedMessage[] = [];
  return {
    published,
    topic: (name: string) => ({
      publishMessage: async ({ json }: { json: unknown }) => {
        published.push({ topic: name, json });
        return `message-${published.length}`;
      },
    }),
  };
}

export interface TestContext extends HandlerContext {
  firestore: FakeFirestore;
  pubsub: FakePubSub;
  rtdbRemovals: string[];
  storageDeletions: Array<{ bucket: string; prefix: string }>;
  /**
   * Dispatch every queued discovery/deletion message back into its handler,
   * repeating until the queue drains. Stands in for the emulator's Pub/Sub
   * delivery loop.
   */
  drain(maxRounds?: number): Promise<void>;
}

export interface TestContextOptions {
  config?: Partial<ResolvedDeleteUserDataConfig>;
  firestore?: FakeFirestore;
  /** Reject RTDB removes / storage deletes with this error. */
  rtdbError?: unknown;
  storageError?: unknown;
}

export function makeContext(options: TestContextOptions = {}): TestContext {
  const firestore = options.firestore ?? createFakeFirestore();
  const pubsub = createFakePubSub();
  const rtdbRemovals: string[] = [];
  const storageDeletions: Array<{ bucket: string; prefix: string }> = [];

  const config = resolveDeleteUserDataConfig({
    instanceId: "test-instance",
    projectId: "demo-test",
    firestoreDeleteMode: "shallow",
    searchFields: "uid",
    searchDepth: 3,
    ...options.config,
  });

  const database = {
    ref: (path: string) => ({
      remove: async () => {
        if (options.rtdbError) throw options.rtdbError;
        rtdbRemovals.push(path);
      },
    }),
  } as any;

  const storage = {
    bucket: (name: string) => ({
      name,
      deleteFiles: async ({ prefix }: { prefix: string }) => {
        if (options.storageError) throw options.storageError;
        storageDeletions.push({ bucket: name, prefix });
      },
    }),
  } as any;

  const ctx = {
    firestore,
    storage,
    database,
    pubsub,
    config,
    rtdbRemovals,
    storageDeletions,
  } as unknown as TestContext;

  ctx.drain = async (maxRounds = 50) => {
    for (let round = 0; round < maxRounds; round++) {
      if (pubsub.published.length === 0) return;
      const pending = pubsub.published.splice(0, pubsub.published.length);
      for (const message of pending) {
        if (message.topic.endsWith(config.discoveryTopicName)) {
          await handleSearch(message.json as SearchMessageData, ctx);
        } else if (message.topic.endsWith(config.deletionTopicName)) {
          await handleDeletion(message.json as DeleteMessageData, ctx);
        } else {
          throw new Error(`Unexpected topic: ${message.topic}`);
        }
      }
    }
    throw new Error("drain() did not settle: message loop exceeded maxRounds");
  };

  return ctx;
}

/** Messages queued for the discovery topic, oldest first. */
export const discoveryMessages = (ctx: TestContext): SearchMessageData[] =>
  ctx.pubsub.published
    .filter((message) => message.topic.endsWith(ctx.config.discoveryTopicName))
    .map((message) => message.json as SearchMessageData);

/** Messages queued for the deletion topic, oldest first. */
export const deletionMessages = (ctx: TestContext): DeleteMessageData[] =>
  ctx.pubsub.published
    .filter((message) => message.topic.endsWith(ctx.config.deletionTopicName))
    .map((message) => message.json as DeleteMessageData);
