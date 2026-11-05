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

import type { FirestoreBigQueryEventHistoryTracker } from "@firebaseextensions/firestore-bigquery-change-tracker";
import { describe, expect, test, vi } from "vitest";
import { createEnsureInitialized } from "../src/init";

function trackerWith(initialize: () => Promise<void>) {
  return { initialize } as unknown as FirestoreBigQueryEventHistoryTracker;
}

describe("createEnsureInitialized", () => {
  test("initializes the tracker once across sequential calls", async () => {
    const initialize = vi.fn().mockResolvedValue(undefined);
    const ensureInitialized = createEnsureInitialized(trackerWith(initialize));

    await ensureInitialized();
    await ensureInitialized();
    await ensureInitialized();

    expect(initialize).toHaveBeenCalledTimes(1);
  });

  test("concurrent calls share a single in-flight initialization", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const initialize = vi.fn().mockImplementation(() => gate);
    const ensureInitialized = createEnsureInitialized(trackerWith(initialize));

    const first = ensureInitialized();
    const second = ensureInitialized();
    release();
    await Promise.all([first, second]);

    expect(initialize).toHaveBeenCalledTimes(1);
  });

  test("a failed initialization resets the guard so the next call retries", async () => {
    const initialize = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce(undefined);
    const ensureInitialized = createEnsureInitialized(trackerWith(initialize));

    await expect(ensureInitialized()).rejects.toThrow("transient");
    await expect(ensureInitialized()).resolves.toBeUndefined();

    expect(initialize).toHaveBeenCalledTimes(2);
  });

  test("a success is cached — no retry after resolution", async () => {
    const initialize = vi.fn().mockResolvedValue(undefined);
    const ensureInitialized = createEnsureInitialized(trackerWith(initialize));

    await ensureInitialized();
    initialize.mockClear();
    await ensureInitialized();

    expect(initialize).not.toHaveBeenCalled();
  });
});
