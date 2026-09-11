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
 * A minimal in-memory stand-in for the pieces of the Firestore API that the
 * controller and worker exercise. The extension covers the same behaviour with
 * `firebase-admin` pointed at the Firestore emulator; kit tests stay
 * emulator-free, so this store emulates just enough:
 *
 *  - `doc()` / `collection()` references with `path`, `id` and `firestore`
 *  - collection-group queries with `orderBy("__name__")`, `startAt`,
 *    `endBefore` and `limit`
 *  - `runTransaction` with `get` (document and query), `set` (with `merge`),
 *    `update` and `delete`
 *  - `FieldValue.serverTimestamp()`, `FieldValue.increment()` and
 *    `FieldValue.arrayUnion()` resolution on write
 */

export const SERVER_TIMESTAMP_MS = 1_700_000_000_000;

export interface FakeDoc {
  data: Record<string, any>;
  updateTimeSeconds: number;
}

function transformName(value: any): string | undefined {
  if (value === null || typeof value !== "object") return undefined;
  return value.constructor?.name;
}

function transformOperand(value: any): any {
  return value.operand ?? value.elements ?? value._elements ?? value._operand;
}

function resolveValue(existing: any, value: any): any {
  switch (transformName(value)) {
    case "ServerTimestampTransform":
      return SERVER_TIMESTAMP_MS;
    case "NumericIncrementTransform":
      return (
        (typeof existing === "number" ? existing : 0) + transformOperand(value)
      );
    case "ArrayUnionTransform": {
      const elements = transformOperand(value);
      const additions = Array.isArray(elements) ? elements : [elements];
      return (Array.isArray(existing) ? existing : []).concat(additions);
    }
    default:
      break;
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const base =
      existing !== null &&
      typeof existing === "object" &&
      !Array.isArray(existing)
        ? { ...existing }
        : {};
    for (const key of Object.keys(value)) {
      base[key] = resolveValue(base[key], value[key]);
    }
    return base;
  }
  return value;
}

function mergeData(
  existing: Record<string, any> | undefined,
  update: Record<string, any>
): Record<string, any> {
  const result = { ...(existing ?? {}) };
  for (const key of Object.keys(update)) {
    result[key] = resolveValue(result[key], update[key]);
  }
  return result;
}

function overwriteData(update: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of Object.keys(update)) {
    result[key] = resolveValue(undefined, update[key]);
  }
  return result;
}

function normalize(path: string): string {
  return path.replace(/^\/+/, "").replace(/\/+$/, "");
}

function collectionIdOf(docPath: string): string {
  const segments = docPath.split("/");
  return segments[segments.length - 2];
}

function inCollection(docPath: string, collectionPath: string): boolean {
  const segments = docPath.split("/");
  return segments.slice(0, -1).join("/") === collectionPath;
}

export class FakeFirestore {
  public readonly docs = new Map<string, FakeDoc>();

  private readonly listeners = new Set<() => void>();

  doc(path: string): any {
    const normalized = normalize(path);
    const segments = normalized.split("/");
    return {
      id: segments[segments.length - 1],
      path: normalized,
      firestore: this,
      parent: {
        id: segments[segments.length - 2],
        path: segments.slice(0, -1).join("/"),
      },
      collection: (collectionId: string) =>
        this.collection(`${normalized}/${collectionId}`),
      get: async () => this.snapshot(normalized),
      set: async (data: Record<string, any>, options?: { merge?: boolean }) => {
        this.write(normalized, data, options?.merge === true);
      },
      delete: async () => {
        this.docs.delete(normalized);
        this.notify();
      },
      onSnapshot: (cb: (snap: any) => void) =>
        this.listen(() => {
          cb(this.snapshot(normalized));
        }),
    };
  }

  collection(path: string): any {
    const normalized = normalize(path);
    const segments = normalized.split("/");
    return {
      id: segments[segments.length - 1],
      path: normalized,
      firestore: this,
      doc: (docId: string) => this.doc(`${normalized}/${docId}`),
      orderBy: () =>
        this.queryFor((docPath) => inCollection(docPath, normalized)),
    };
  }

  collectionGroup(collectionId: string): any {
    return {
      orderBy: () =>
        this.queryFor((docPath) => collectionIdOf(docPath) === collectionId),
    };
  }

  snapshot(path: string): any {
    const normalized = normalize(path);
    const stored = this.docs.get(normalized);
    const ref = this.doc(normalized);
    return {
      id: ref.id,
      ref,
      exists: stored !== undefined,
      updateTime: {
        seconds: stored?.updateTimeSeconds ?? 0,
        toMillis: () => (stored?.updateTimeSeconds ?? 0) * 1000,
      },
      data: () => (stored ? structuredClone(stored.data) : undefined),
      get: (field: string) =>
        field
          .split(".")
          .reduce<any>(
            (value, part) => (value === undefined ? undefined : value?.[part]),
            stored ? structuredClone(stored.data) : undefined
          ),
    };
  }

  write(path: string, data: Record<string, any>, merge: boolean): void {
    const normalized = normalize(path);
    const existing = this.docs.get(normalized);
    this.docs.set(normalized, {
      data: merge ? mergeData(existing?.data, data) : overwriteData(data),
      updateTimeSeconds: Math.floor(SERVER_TIMESTAMP_MS / 1000),
    });
    this.notify();
  }

  /**
   * Registers a snapshot listener. Like Firestore, the initial snapshot is
   * delivered asynchronously, so the caller can finish wiring up before the
   * first callback lands.
   */
  listen(emit: () => void): () => void {
    this.listeners.add(emit);
    this.deliver(emit);
    return () => {
      this.listeners.delete(emit);
    };
  }

  /** Delivers the current state to every registered snapshot listener. */
  notify(): void {
    for (const emit of [...this.listeners]) {
      this.deliver(emit);
    }
  }

  private deliver(emit: () => void): void {
    queueMicrotask(() => {
      // The listener may have been torn down before this delivery ran.
      if (this.listeners.has(emit)) emit();
    });
  }

  /** Seed a document without going through the transaction machinery. */
  seed(
    path: string,
    data: Record<string, any>,
    updateTimeSeconds?: number
  ): void {
    this.docs.set(normalize(path), {
      data: structuredClone(data),
      updateTimeSeconds: updateTimeSeconds ?? Math.floor(Date.now() / 1000),
    });
  }

  async runTransaction<T>(fn: (t: any) => Promise<T>): Promise<T> {
    const writes: (() => void)[] = [];
    const transaction = {
      get: async (target: any) => {
        if (target?.__isQuery) return target.__run();
        return this.snapshot(target.path);
      },
      getAll: async (...refs: any[]) =>
        refs.map((ref) => this.snapshot(ref.path)),
      set: (
        ref: any,
        data: Record<string, any>,
        options?: { merge?: boolean }
      ) => {
        writes.push(() => {
          this.write(ref.path, data, options?.merge === true);
        });
      },
      update: (ref: any, data: Record<string, any>) => {
        writes.push(() => {
          this.write(ref.path, data, true);
        });
      },
      delete: (ref: any) => {
        writes.push(() => {
          this.docs.delete(normalize(ref.path));
        });
      },
    };
    const result = await fn(transaction);
    for (const write of writes) {
      write();
    }
    return result;
  }

  private queryFor(predicate: (path: string) => boolean): any {
    const constraints: {
      startAt?: string;
      endBefore?: string;
      limit?: number;
    } = {};
    const query: any = {
      startAt: (value: string) => {
        constraints.startAt = normalize(value);
        return query;
      },
      endBefore: (value: string) => {
        constraints.endBefore = normalize(value);
        return query;
      },
      limit: (value: number) => {
        constraints.limit = value;
        return query;
      },
      get: async () => this.runQuery(predicate, constraints),
      onSnapshot: (cb: (snap: any) => void) =>
        this.listen(() => {
          cb(this.runQuery(predicate, constraints));
        }),
      __isQuery: true,
      __run: () => this.runQuery(predicate, constraints),
    };
    return query;
  }

  private runQuery(
    predicate: (path: string) => boolean,
    constraints: { startAt?: string; endBefore?: string; limit?: number }
  ): any {
    let paths = [...this.docs.keys()].filter(predicate).sort();
    if (constraints.startAt) {
      paths = paths.filter((path) => path >= constraints.startAt);
    }
    if (constraints.endBefore) {
      paths = paths.filter((path) => path < constraints.endBefore);
    }
    if (constraints.limit !== undefined) {
      paths = paths.slice(0, constraints.limit);
    }
    const docs = paths.map((path) => this.snapshot(path));
    return {
      docs,
      empty: docs.length === 0,
      size: docs.length,
      forEach: (cb: (snap: any) => void) => {
        docs.forEach(cb);
      },
    };
  }
}
