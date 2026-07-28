import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import * as firebaseFunctionsTest from "firebase-functions-test";
import { FirestoreOnWriteProcessor } from "../../src/firestore-onwrite-processor";
import { WrappedFunction } from "firebase-functions-test/lib/v1";
import { Change, firestore } from "firebase-functions/v1";

const fft = firebaseFunctionsTest({
  projectId: "demo-gcp",
});

process.env.GCLOUD_PROJECT = "demo-gcp";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

type DocumentReference = admin.firestore.DocumentReference;
type DocumentData = admin.firestore.DocumentData;
type DocumentSnapshot = admin.firestore.DocumentSnapshot<DocumentData>;
type WrappedFirebaseFunction = WrappedFunction<
  Change<DocumentSnapshot | undefined>,
  void
>;

admin.initializeApp({
  projectId: "demo-gcp",
});

const firestoreObserver = jest.fn((_x: any) => {});
let collectionName: string;

const processor = new FirestoreOnWriteProcessor<string, { output: string }>({
  inputField: "input",
  processFn: async (input: string) => {
    return { output: input };
  },
  errorFn: JSON.stringify,
});

describe("SingleFieldProcessor", () => {
  let unsubscribe: (() => void) | undefined;
  let wrappedGenerateMessage: WrappedFirebaseFunction;
  let docId: string;

  // clear firestore
  beforeEach(async () => {
    collectionName = "test";
    docId = "123";

    const testFunction = firestore
      .document(`${collectionName}/${docId}`)
      .onWrite(async (change, _context) => {
        return await processor.run(change);
      });

    wrappedGenerateMessage = fft.wrap(testFunction) as WrappedFirebaseFunction;

    await fetch(
      `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-gcp/databases/(default)/documents`,
      { method: "DELETE" }
    );
    jest.clearAllMocks();

    // set up observer on collection
    unsubscribe = admin
      .firestore()
      .collection(collectionName)
      .onSnapshot((snap: any) => {
        /** There is a bug on first init and write, causing the the emulator to the observer is called twice
         * A snapshot is registered on the first run, this affects the observer count
         * This is a workaround to ensure the observer is only called when it should be
         */
        if (snap.docs.length) firestoreObserver(snap);
      });
  });

  afterEach(() => {
    if (unsubscribe && typeof unsubscribe === "function") {
      unsubscribe();
    }
    jest.clearAllMocks();
  });

  test("should run when not given order field", async () => {
    const data = {
      input: "test",
    };
    const ref = await admin.firestore().collection(collectionName).add(data);

    await simulateFunctionTriggered(wrappedGenerateMessage)(ref);
    // we expect the firestore observer to be called 4 times total.
    expect(firestoreObserver).toHaveBeenCalledTimes(3);
    const firestoreCallData = firestoreObserver.mock.calls.map(
      (call: { docs: { data: () => any }[] }[]) => call[0].docs[0].data()
    );

    // for (const call of firestoreCallData) {
    //   console.log(call);
    // }

    expect(firestoreCallData[0]).toEqual({ input: "test" });
    expect(firestoreCallData[1]).toEqual({
      input: "test",
      createTime: expect.any(Timestamp),
      status: {
        state: "PROCESSING",
        startTime: expect.any(Timestamp),
        updateTime: expect.any(Timestamp),
      },
    });
    expect(firestoreCallData[1].status.startTime).toEqual(
      firestoreCallData[1].status.updateTime
    );
    const createTime = firestoreCallData[1].createTime;
    expect(firestoreCallData[2]).toEqual({
      input: "test",
      output: "test",
      createTime,
      status: {
        state: "COMPLETED",
        updateTime: expect.any(Timestamp),
        completeTime: expect.any(Timestamp),
        startTime: expect.any(Timestamp),
      },
    });
    expect(firestoreCallData[2]).toHaveProperty("createTime", createTime);
    expect(firestoreCallData[2].status.updateTime).toEqual(
      firestoreCallData[2].status.completeTime
    );
  });
  test("should run when given order field", async () => {
    const customCreateTime = new Date().toISOString();
    const data = {
      input: "test",
      createTime: customCreateTime,
    };

    const ref = await admin.firestore().collection(collectionName).add(data);

    await simulateFunctionTriggered(wrappedGenerateMessage)(ref);
    // we expect the firestore observer to be called 4 times total.
    expect(firestoreObserver).toHaveBeenCalledTimes(3);
    const firestoreCallData = firestoreObserver.mock.calls.map(
      (call: { docs: { data: () => any }[] }[]) => call[0].docs[0].data()
    );

    // for (const call of firestoreCallData) {
    //   console.log(call);
    // }

    expect(firestoreCallData[0]).toEqual({
      input: "test",
      createTime: customCreateTime,
    });

    expect(firestoreCallData[1]).toEqual({
      input: "test",
      createTime: customCreateTime,
      status: {
        state: "PROCESSING",
        startTime: expect.any(Timestamp),
        updateTime: expect.any(Timestamp),
      },
    });
    expect(firestoreCallData[1].status.startTime).toEqual(
      firestoreCallData[1].status.updateTime
    );
    expect(firestoreCallData[2]).toEqual({
      input: "test",
      output: "test",
      createTime: customCreateTime,
      status: {
        state: "COMPLETED",
        updateTime: expect.any(Timestamp),
        completeTime: expect.any(Timestamp),
        startTime: expect.any(Timestamp),
      },
    });
    expect(firestoreCallData[2].status.updateTime).toEqual(
      firestoreCallData[2].status.completeTime
    );
  });
});

const simulateFunctionTriggered =
  (wrappedFunction: WrappedFirebaseFunction) =>
  async (ref: DocumentReference, before?: DocumentSnapshot) => {
    const data = (await ref.get()).data() as { [key: string]: unknown };
    const beforeFunctionExecution = fft.firestore.makeDocumentSnapshot(
      data,
      `${collectionName}/${ref.id}`
    ) as DocumentSnapshot;
    const change = fft.makeChange(before, beforeFunctionExecution);
    await wrappedFunction(change);
    return beforeFunctionExecution;
  };
