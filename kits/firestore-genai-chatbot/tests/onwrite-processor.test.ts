import { describe, expect, test, vi } from "vitest";
import { FirestoreOnWriteProcessor } from "../src/firestore-onwrite-processor";
import { State } from "../src/firestore-onwrite-processor/common";

type Data = Record<string, any>;

function makeSnap(data: Data | undefined, update = vi.fn()) {
  return {
    exists: data !== undefined,
    createTime: "create-time",
    ref: { update },
    get: (field: string) => data?.[field],
    _update: update,
  } as any;
}

function makeProcessor(
  processFn = vi.fn(async () => ({ response: "hi" })),
  errorFn = vi.fn(() => "boom")
) {
  return {
    processor: new FirestoreOnWriteProcessor<string, Record<string, any>>({
      inputField: "prompt",
      processFn,
      errorFn,
    }),
    processFn,
    errorFn,
  };
}

describe("FirestoreOnWriteProcessor", () => {
  test("processes a created doc: writes PROCESSING then COMPLETED + output", async () => {
    const update = vi.fn();
    const after = makeSnap({ prompt: "hello" }, update);
    const before = makeSnap(undefined);
    const { processor, processFn } = makeProcessor();

    await processor.run({ before, after } as any);

    expect(processFn).toHaveBeenCalledOnce();
    expect(processFn).toHaveBeenCalledWith("hello", after);
    expect(update).toHaveBeenCalledTimes(2);

    const start = update.mock.calls[0][0];
    expect(start.status.state).toBe(State.PROCESSING);

    const complete = update.mock.calls[1][0];
    expect(complete.response).toBe("hi");
    expect(complete["status.state"]).toBe(State.COMPLETED);
  });

  test("writes ERROR when the processing function throws", async () => {
    const update = vi.fn();
    const after = makeSnap({ prompt: "hello" }, update);
    const before = makeSnap(undefined);
    const processFn = vi.fn(async () => {
      throw new Error("nope");
    });
    const { processor } = makeProcessor(processFn);

    await processor.run({ before, after } as any);

    expect(update).toHaveBeenCalledTimes(2);
    const errored = update.mock.calls[1][0];
    expect(errored.status.state).toBe(State.ERROR);
    expect(errored.status.error).toBe("boom");
  });

  test("skips when the prompt did not change on update", async () => {
    const update = vi.fn();
    const after = makeSnap({ prompt: "same" }, update);
    const before = makeSnap({ prompt: "same" });
    const { processor, processFn } = makeProcessor();

    await processor.run({ before, after } as any);

    expect(processFn).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  test("skips when already completed", async () => {
    const update = vi.fn();
    const after = makeSnap(
      { prompt: "hello", status: { state: State.COMPLETED } },
      update
    );
    const before = makeSnap(undefined);
    const { processor, processFn } = makeProcessor();

    await processor.run({ before, after } as any);

    expect(processFn).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  test("ignores deletes", async () => {
    const update = vi.fn();
    const before = makeSnap({ prompt: "hello" });
    const after = makeSnap(undefined, update);
    const { processor, processFn } = makeProcessor();

    await processor.run({ before, after } as any);

    expect(processFn).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
