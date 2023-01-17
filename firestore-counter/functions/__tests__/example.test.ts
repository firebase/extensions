import { Counter } from "./util";
import * as admin from "firebase-admin";

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

    counter = new Counter(doc, "counter");

    await counter.incrementBy(1);

    const value = await counter.get({});

    console.log(value);

    expect(value).toBe(1);

    await counter.incrementBy(1);

    const value2 = await counter.get({});

    console.log(value2);

    expect(value2).toBe(2);
  });
});
