import { beforeEach, describe, expect, test, vi } from "vitest";
import { resolveRtdbLimitConfig } from "../src/export-config";
import {
  type ChildCreatedEvent,
  type ChildSnapshotLike,
  handleChildCreated,
} from "../src/handlers";

vi.mock("../src/logs", () => ({
  complete: vi.fn(),
  childCount: vi.fn(),
  error: vi.fn(),
  init: vi.fn(),
  pathSkipped: vi.fn(),
  pathTruncated: vi.fn(),
  pathTruncating: vi.fn(),
  start: vi.fn(),
}));

function makeContext(maxCount: number) {
  return {
    config: resolveRtdbLimitConfig({
      nodePath: "path/to/limit",
      maxCount,
      databaseInstance: "test-instance",
    }),
  };
}

function makeEvent(
  keys: string[],
  update = vi.fn().mockResolvedValue(undefined)
) {
  const children: ChildSnapshotLike[] = keys.map((key) => ({ key }));
  const parentSnapshot = {
    numChildren: () => children.length,
    forEach: (action: (child: ChildSnapshotLike) => unknown) => {
      for (const child of children) {
        if (action(child)) {
          return true;
        }
      }
      return false;
    },
  };
  const parentRef = {
    once: vi.fn().mockResolvedValue(parentSnapshot),
    update,
  };
  const ref = {
    parent: parentRef,
    root: { toString: () => "https://project.firebaseio.com" },
    toString: () =>
      `https://project.firebaseio.com/path/to/limit/${keys.at(-1)}`,
  };

  return {
    event: { data: { ref } } as ChildCreatedEvent,
    parentRef,
    update,
  };
}

describe("handleChildCreated", () => {
  beforeEach(() => vi.clearAllMocks());

  test("removes the oldest children when the limit is exceeded", async () => {
    const { event, update } = makeEvent(["a", "b", "c", "d"]);

    await handleChildCreated(event, makeContext(2));

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({ a: null, b: null });
  });

  test("does not update when the child count already equals the limit", async () => {
    const { event, update } = makeEvent(["a", "b"]);

    await handleChildCreated(event, makeContext(2));

    expect(update).not.toHaveBeenCalled();
  });

  test("does not update when the child count is below the limit", async () => {
    const { event, update } = makeEvent(["a"]);

    await handleChildCreated(event, makeContext(2));

    expect(update).not.toHaveBeenCalled();
  });

  test("returns cleanly when the event has no snapshot data", async () => {
    await expect(
      handleChildCreated({ data: undefined }, makeContext(2))
    ).resolves.toBeUndefined();
  });
});
