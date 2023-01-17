import { Counter } from "./util";
import * as admin from "firebase-admin";
import waitForExpect from "wait-for-expect";

process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

admin.initializeApp({
  projectId: "demo-test",
});

describe("e2e testing", () => {
  let counter: Counter;
  const doc = admin.firestore().doc("test/test");
  const internalStatePath =
    process.env.INTERNAL_STATE_PATH || "_firebase_ext_/sharded_counter";

  const internalStateDoc = admin.firestore().doc(internalStatePath);

  beforeEach(async () => {});

  // afterEach(async () => {
  //     await doc.delete();
  //     await internalStateDoc.delete();
  // });

  test("example e2e", async () => {
    await doc.set({
      counter: 0,
    });

    const observer = jest.fn();

    const unsub = admin.firestore().doc("test/test").onSnapshot(observer);

    counter = new Counter(doc, "counter");

    await counter.incrementBy(1);

    const value = await counter.get({});

    console.log(value);

    expect(value).toBe(1);
    for (let i = 0; i < 300; i++) {
      await counter.incrementBy(1);
    }
    // sleep 500ms
    const value2 = await counter.get({});

    expect(value2).toBe(301);

    await waitForExpect(() => {
      expect(observer).toBeCalled();
    });

    const snapshot = observer.mock.calls[1][0];

    expect(snapshot.data()).toEqual({ counter: 301 });
  }, 70000);
});
