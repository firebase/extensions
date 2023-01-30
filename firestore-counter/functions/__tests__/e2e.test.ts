import { Counter } from "./test-client";
import * as admin from "firebase-admin";
import waitForExpect from "wait-for-expect";

process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

admin.initializeApp({
  projectId: "demo-test",
});

describe("e2e testing of firestore-counter", () => {
  let counter: Counter;
  const doc = admin.firestore().doc("test/test");
  const internalStatePath =
    process.env.INTERNAL_STATE_PATH || "_firebase_ext_/sharded_counter";

  const internalStateDoc = admin.firestore().doc(internalStatePath);

  beforeEach(async () => {});

  test("should increment the counter, and aggregate eventually", async () => {
    await doc.set({
      counter: 0,
    });

    const observer = jest.fn();

    const unsub = admin.firestore().doc("test/test").onSnapshot(observer);

    counter = new Counter(doc, "counter");

    await counter.incrementBy(1);

    const value = await counter.get();

    expect(value).toBe(1);
    for (let i = 0; i < 300; i++) {
      await counter.incrementBy(1);
    }

    const value2 = await counter.get();

    expect(value2).toBe(301);

    await waitForExpect(() => {
      expect(observer).toBeCalled();
    });

    await waitForExpect(() => {
      const calls = observer.mock.calls;
      const snapshot = calls[calls.length - 1][0];
      expect(snapshot.data().counter).toBe(301);
    }, 60000);

    unsub();
  }, 70000);
});
