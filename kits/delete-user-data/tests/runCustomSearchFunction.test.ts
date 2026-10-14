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

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock("../src/logs");
vi.mock("../src/events");
vi.stubGlobal("fetch", mocks.fetch);

import * as logs from "../src/logs";
import { runCustomSearchFunction } from "../src/runCustomSearchFunction";
import { createFakeFirestore, deletionMessages, makeContext } from "./fakes";

const UID = "testUid";
const SEARCH_FUNCTION = "https://example.com/search";
const log = vi.mocked(logs);

beforeEach(() => {
  vi.clearAllMocks();
});

// Parity: delete-user-data/functions/__tests__/searchFunction.test.ts, which
// exercises the same path end-to-end through the emulator.
describe("runCustomSearchFunction", () => {
  test("posts the uid to the configured function", async () => {
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => [] });
    const ctx = makeContext({ config: { searchFunction: SEARCH_FUNCTION } });

    await runCustomSearchFunction(UID, ctx);

    expect(mocks.fetch).toHaveBeenCalledWith(SEARCH_FUNCTION, {
      method: "POST",
      body: JSON.stringify({ uid: UID }),
      headers: { "Content-Type": "application/json" },
    });
  });

  test("queues the paths from an array response", async () => {
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ["users/doc1", "users/doc2"],
    });
    const ctx = makeContext({ config: { searchFunction: SEARCH_FUNCTION } });

    await runCustomSearchFunction(UID, ctx);

    expect(deletionMessages(ctx)).toEqual([
      { paths: ["users/doc1", "users/doc2"], uid: UID },
    ]);
  });

  test("queues the paths from a { firestorePaths } response", async () => {
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ firestorePaths: ["users/doc1"] }),
    });
    const ctx = makeContext({ config: { searchFunction: SEARCH_FUNCTION } });

    await runCustomSearchFunction(UID, ctx);

    expect(deletionMessages(ctx)).toEqual([
      { paths: ["users/doc1"], uid: UID },
    ]);
  });

  test("deletes the returned documents once the deletion is dispatched", async () => {
    const firestore = createFakeFirestore({
      "searchFunction/doc1": { uid: UID },
      "searchFunction/doc2": { uid: "someoneElse" },
    });
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ["searchFunction/doc1", "searchFunction/doc2"],
    });
    const ctx = makeContext({
      firestore,
      config: { searchFunction: SEARCH_FUNCTION },
    });

    await runCustomSearchFunction(UID, ctx);
    await ctx.drain();

    expect(firestore.exists("searchFunction/doc1")).toBe(false);
    expect(firestore.exists("searchFunction/doc2")).toBe(true);
  });

  test("logs and stops when the function responds with an error", async () => {
    mocks.fetch.mockResolvedValue({
      ok: false,
      text: async () => "internal error",
    });
    const ctx = makeContext({ config: { searchFunction: SEARCH_FUNCTION } });

    await runCustomSearchFunction(UID, ctx);

    expect(log.customFunctionError).toHaveBeenCalledWith(
      new Error("internal error")
    );
    expect(ctx.pubsub.published).toEqual([]);
  });

  test("does nothing when no search function is configured", async () => {
    const ctx = makeContext();

    await runCustomSearchFunction(UID, ctx);

    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(ctx.pubsub.published).toEqual([]);
  });
});
