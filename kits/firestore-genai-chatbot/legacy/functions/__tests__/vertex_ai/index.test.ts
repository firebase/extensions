import * as firebaseFunctionsTest from "firebase-functions-test";
import * as admin from "firebase-admin";
import config from "../../src/config";
import { generateMessage } from "../../src/index";
import { WrappedFunction } from "firebase-functions-test/lib/v1";
import { Change } from "firebase-functions/v1";

import { QuerySnapshot } from "firebase-admin/firestore";
import { expectToProcessCorrectly } from "../util";

process.env.GCLOUD_PROJECT = "demo-gcp";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

// // We mock out the config here instead of setting environment variables directly
jest.mock("../../src/config", () => ({
  default: {
    googleAi: {
      model: "gemini-2.5-pro",
      apiKey: "test-api-key",
    },
    vertex: {
      model: "gemini-2.5-pro",
    },
    collectionName: "discussionsTestGenerative/{discussionId}/messages",
    location: "us-central1",
    orderField: "createTime",
    promptField: "prompt",
    responseField: "response",
    enableDiscussionOptionOverrides: true,
    candidatesField: "candidates",
    provider: "vertex-ai",
    model: "gemini-2.5-pro",
    apiKey: "test-api-key",
    candidateCount: 2,
    candidateField: "candidates",
  },
}));

// // mock to check the arguments passed to the annotateVideo function+
const mockGetClient = jest.fn();
const mockGetModel = jest.fn();
const mockGenerateContentStream = jest.fn();

jest.mock("@google-cloud/vertexai", () => {
  return {
    ...jest.requireActual("@google-cloud/vertexai"),
    VertexAI: function mockedClient(args: any) {
      mockGetClient(args);
      return {
        preview: {
          getGenerativeModel: (args: unknown) => {
            mockGetModel(args);
            return {
              generateContentStream: async function mockedStartChat(args: any) {
                mockGenerateContentStream(args);
                return {
                  response: {
                    candidates: [
                      {
                        content: {
                          parts: [
                            {
                              text: "test response",
                            },
                          ],
                        },
                      },
                    ],
                  },
                };
              },
            };
          },
        },
      };
    },
  };
});

const fft = firebaseFunctionsTest({
  projectId: "demo-gcp",
});

admin.initializeApp({
  projectId: "demo-gcp",
});

type DocumentReference = admin.firestore.DocumentReference;
type DocumentData = admin.firestore.DocumentData;
type DocumentSnapshot = admin.firestore.DocumentSnapshot<DocumentData>;
type WrappedFirebaseFunction = WrappedFunction<
  Change<DocumentSnapshot | undefined>,
  void
>;
const Timestamp = admin.firestore.Timestamp;

const wrappedGenerateMessage = fft.wrap(
  generateMessage
) as WrappedFirebaseFunction;

const firestoreObserver = jest.fn((_x: any) => {});
let collectionName: string;

describe("generateMessage", () => {
  let unsubscribe: (() => void) | undefined;

  // clear firestore
  beforeEach(async () => {
    await fetch(
      `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-gcp/databases/(default)/documents`,
      { method: "DELETE" }
    );
    jest.clearAllMocks();
    const randomInteger = Math.floor(Math.random() * 1000000);
    collectionName = config.collectionName.replace(
      "{discussionId}",
      randomInteger.toString()
    );

    // set up observer on collection
    unsubscribe = admin
      .firestore()
      .collection(collectionName)
      .onSnapshot((snap: QuerySnapshot) => {
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

  test("should not run if the prompt field is not set", async () => {
    const notMessage = {
      notPrompt: "hello chat bison",
    };
    // Make a write to the collection. This won't trigger our wrapped function as it isn't deployed to the emulator.
    const ref = await admin
      .firestore()
      .collection(collectionName)
      .add(notMessage);

    await simulateFunctionTriggered(wrappedGenerateMessage)(ref);

    await expectNoOp();
  });

  test("should not run if the prompt field is empty", async () => {
    const notMessage = {
      prompt: "",
    };

    const ref = await admin
      .firestore()
      .collection(collectionName)
      .add(notMessage);

    await simulateFunctionTriggered(wrappedGenerateMessage)(ref);

    await expectNoOp();
  });

  test("should not run if the prompt field is not a string", async () => {
    const notMessage = {
      prompt: 123,
    };

    const ref = await admin
      .firestore()
      .collection(collectionName)
      .add(notMessage);

    await simulateFunctionTriggered(wrappedGenerateMessage)(ref);

    await expectNoOp();
  });

  test("should run when given createTime", async () => {
    const message = {
      prompt: "hello chat bison",
      createTime: Timestamp.now(),
    };
    const ref = await admin.firestore().collection(collectionName).add(message);

    await simulateFunctionTriggered(wrappedGenerateMessage)(ref);

    expect(firestoreObserver).toHaveBeenCalledTimes(3);

    const firestoreCallData = firestoreObserver.mock.calls.map((call) =>
      call[0].docs[0].data()
    );

    expectToProcessCorrectly(
      firestoreCallData,
      message,
      false,
      "test response"
    );

    expect(mockGetClient).toHaveBeenCalledTimes(1);

    expect(mockGetModel).toHaveBeenCalledTimes(1);
    expect(mockGetModel).toHaveBeenCalledWith({ model: config.googleAi.model });
    expect(mockGenerateContentStream).toHaveBeenCalledTimes(1);
    expect(mockGenerateContentStream).toHaveBeenCalledWith({
      contents: [{ parts: [{ text: "hello chat bison" }], role: "user" }],
      generationConfig: {
        topK: undefined,
        topP: undefined,
        temperature: undefined,
        candidateCount: undefined,
        maxOutputTokens: undefined,
      },
      safetySettings: [],
    });
  });

  test("should run when not given createTime", async () => {
    const message = {
      prompt: "hello chat bison",
    };

    // Make a write to the collection. This won't trigger our wrapped function as it isn't deployed to the emulator.
    const ref = await admin.firestore().collection(collectionName).add(message);

    const beforeOrderField = await simulateFunctionTriggered(
      wrappedGenerateMessage
    )(ref);

    await simulateFunctionTriggered(wrappedGenerateMessage)(
      ref,
      beforeOrderField
    );

    // we expect the firestore observer to be called 4 times total.
    expect(firestoreObserver).toHaveBeenCalledTimes(3);

    const firestoreCallData = firestoreObserver.mock.calls.map((call) => {
      return call[0].docs[0].data();
    });

    expectToProcessCorrectly(firestoreCallData, message, true, "test response");

    // // verify SDK is called with expected arguments
    // we expect the mock API to be called once
    expect(mockGetClient).toHaveBeenCalledTimes(1);

    expect(mockGetModel).toHaveBeenCalledTimes(1);
    expect(mockGetModel).toBeCalledWith({ model: config.googleAi.model });
    expect(mockGenerateContentStream).toHaveBeenCalledTimes(1);
    expect(mockGenerateContentStream).toHaveBeenCalledWith({
      contents: [{ parts: [{ text: "hello chat bison" }], role: "user" }],
      generationConfig: {
        topK: undefined,
        topP: undefined,
        temperature: undefined,
        candidateCount: undefined,
        maxOutputTokens: undefined,
      },
      safetySettings: [],
    });
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

const expectNoOp = async () => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(mockGetModel).toHaveBeenCalledTimes(0);
};
