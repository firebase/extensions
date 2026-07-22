import type { FirestoreBigQueryEventHistoryTracker } from "@firebase/firestore-bigquery-change-tracker";
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
