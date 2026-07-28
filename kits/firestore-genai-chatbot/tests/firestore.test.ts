import { describe, expect, test } from "vitest";
import type { ResolvedGenaiChatbotConfig } from "../src/export-config";
import { fetchHistory } from "../src/firestore";

const config = {
  promptField: "prompt",
  responseField: "response",
  orderField: "order",
} as ResolvedGenaiChatbotConfig;

/** A fake Firestore document snapshot. */
function snap(path: string, data: Record<string, unknown>) {
  return { ref: { path }, get: (field: string) => data[field] };
}

/** A fake message DocumentReference whose sibling collection holds `docs`. */
function ref(docs: ReturnType<typeof snap>[], currentOrder: unknown) {
  return {
    parent: {
      orderBy: () => ({ get: async () => ({ docs }) }),
    },
    get: async () => ({ get: () => currentOrder }),
  } as any;
}

describe("fetchHistory", () => {
  test("returns only siblings ordered strictly before the current doc", async () => {
    const docs = [
      snap("c/a", { order: 1, prompt: "p1", response: "r1" }),
      snap("c/b", { order: 2, prompt: "p2", response: "r2" }),
      snap("c/cur", { order: 3, prompt: "p3", response: "r3" }),
      snap("c/d", { order: 4, prompt: "p4", response: "r4" }),
    ];

    const history = await fetchHistory(ref(docs, 3), config);

    expect(history).toEqual([
      { path: "c/a", prompt: "p1", response: "r1" },
      { path: "c/b", prompt: "p2", response: "r2" },
    ]);
  });

  test("excludes docs missing the order field", async () => {
    const docs = [
      snap("c/a", { order: 1, prompt: "p1", response: "r1" }),
      snap("c/noorder", { prompt: "p2", response: "r2" }),
    ];

    const history = await fetchHistory(ref(docs, 5), config);

    expect(history).toEqual([{ path: "c/a", prompt: "p1", response: "r1" }]);
  });

  test("maps the configured prompt/response fields", async () => {
    const custom = {
      promptField: "q",
      responseField: "a",
      orderField: "order",
    } as ResolvedGenaiChatbotConfig;
    const docs = [snap("c/a", { order: 1, q: "question", a: "answer" })];

    const history = await fetchHistory(ref(docs, 2), custom);

    expect(history).toEqual([
      { path: "c/a", prompt: "question", response: "answer" },
    ]);
  });
});
