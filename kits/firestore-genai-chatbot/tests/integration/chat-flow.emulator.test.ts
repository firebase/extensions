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

/**
 * End-to-end message flow against a real Firestore emulator, with only the
 * generative client mocked. Skipped unless FIRESTORE_EMULATOR_HOST is set.
 *
 * Run locally:
 *   npm run test:emulator
 */

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  getGenerativeClient: vi.fn(),
  send: vi.fn(),
}));

vi.mock("../../src/generative-client", () => ({
  getGenerativeClient: mocks.getGenerativeClient,
}));

import { type App, deleteApp, initializeApp } from "firebase-admin/app";
import type { DocumentReference, Firestore } from "firebase-admin/firestore";
import { getFirestore } from "firebase-admin/firestore";
import { resolveConfig } from "../../src/export-config";
import { State } from "../../src/firestore-onwrite-processor/common";
import type { DocumentWriteEvent } from "../../src/handlers";
import { createProcessor, handleDocumentWrite } from "../../src/handlers";

const describeEmulator = process.env.FIRESTORE_EMULATOR_HOST
  ? describe
  : describe.skip;

const config = resolveConfig({
  projectId: "demo-test",
  model: "gemini-2.5-flash",
  apiKey: "test-key",
});

/** Runs the trigger handler over a write that created `ref`. */
async function processCreate(
  ref: DocumentReference,
  before: Awaited<ReturnType<DocumentReference["get"]>>
): Promise<void> {
  const after = await ref.get();
  const event = {
    data: { before, after },
  } as unknown as DocumentWriteEvent;

  await handleDocumentWrite(event, { processor: createProcessor(config) });
}

describeEmulator("message flow against the Firestore emulator", () => {
  let app: App;
  let db: Firestore;
  let discussion: DocumentReference;

  beforeAll(() => {
    app = initializeApp({ projectId: "demo-test" }, "genai-chatbot-emulator");
    db = getFirestore(app);
  });

  afterAll(async () => {
    await deleteApp(app);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getGenerativeClient.mockReturnValue({ send: mocks.send });
    mocks.send.mockResolvedValue({ response: "generated response" });
    discussion = db.collection("discussions").doc();
  });

  test("takes a new message from PROCESSING to COMPLETED", async () => {
    const observedStates: unknown[] = [];
    const ref = discussion.collection("messages").doc();

    // The client runs after the start event is written, so reading the document
    // here observes the in-flight state without racing a snapshot listener.
    mocks.send.mockImplementation(async () => {
      observedStates.push((await ref.get()).get("status")?.state);
      return { response: "generated response" };
    });

    const before = await ref.get();
    await ref.set({ prompt: "hello" });

    await processCreate(ref, before);

    expect(observedStates).toEqual([State.PROCESSING]);

    const completed = await ref.get();
    expect(completed.get("response")).toBe("generated response");
    expect(completed.get("status")).toMatchObject({ state: State.COMPLETED });
    // The processor backfills the order field so history stays sortable.
    expect(completed.get("createTime")).toBeDefined();
  });

  test("passes earlier messages in the discussion as history", async () => {
    const first = discussion.collection("messages").doc();
    const firstBefore = await first.get();
    await first.set({ prompt: "first prompt" });
    await processCreate(first, firstBefore);

    const second = discussion.collection("messages").doc();
    const secondBefore = await second.get();
    await second.set({ prompt: "second prompt" });
    await processCreate(second, secondBefore);

    expect(mocks.send).toHaveBeenLastCalledWith(
      "second prompt",
      expect.objectContaining({
        history: [
          {
            path: first.path,
            prompt: "first prompt",
            response: "generated response",
          },
        ],
      })
    );
  });

  test("records a generation failure as ERROR on the document", async () => {
    mocks.send.mockRejectedValue(new Error("model unavailable"));
    const ref = discussion.collection("messages").doc();

    const before = await ref.get();
    await ref.set({ prompt: "hello" });
    await processCreate(ref, before);

    expect((await ref.get()).get("status")).toMatchObject({
      state: State.ERROR,
      error:
        "An error occurred while processing the provided message, model unavailable",
    });
  });
});
