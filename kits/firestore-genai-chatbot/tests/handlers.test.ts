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

import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchHistory: vi.fn(),
  fetchDiscussionOptions: vi.fn(),
  getGenerativeClient: vi.fn(),
  send: vi.fn(),
}));

vi.mock("../src/firestore", () => ({
  fetchHistory: mocks.fetchHistory,
  fetchDiscussionOptions: mocks.fetchDiscussionOptions,
}));

vi.mock("../src/generative-client", () => ({
  getGenerativeClient: mocks.getGenerativeClient,
}));

import { resolveConfig } from "../src/export-config";
import { State } from "../src/firestore-onwrite-processor/common";
import type { DocumentWriteEvent, HandlerContext } from "../src/handlers";
import { createProcessor, handleDocumentWrite } from "../src/handlers";

function config(overrides: Record<string, unknown> = {}) {
  return resolveConfig({
    projectId: "project",
    model: "gemini-2.5-flash",
    apiKey: "test-key",
    ...overrides,
  });
}

/** A fake message document snapshot, in the onwrite-processor test's style. */
function makeSnap(data: Record<string, unknown> | undefined, update = vi.fn()) {
  return {
    exists: data !== undefined,
    createTime: "create-time",
    ref: { update },
    get: (field: string) => data?.[field],
  };
}

/** A create event for a message doc, as delivered to the trigger. */
function createEvent(
  data: Record<string, unknown>,
  update = vi.fn()
): DocumentWriteEvent {
  return {
    data: { before: makeSnap(undefined), after: makeSnap(data, update) },
  } as unknown as DocumentWriteEvent;
}

describe("handleDocumentWrite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchHistory.mockResolvedValue([]);
    mocks.fetchDiscussionOptions.mockResolvedValue({});
    mocks.getGenerativeClient.mockReturnValue({ send: mocks.send });
    mocks.send.mockResolvedValue({ response: "generated" });
  });

  test("ignores an event with no change data", async () => {
    const run = vi.fn();
    const ctx = { processor: { run } } as unknown as HandlerContext;

    await handleDocumentWrite({ data: undefined } as DocumentWriteEvent, ctx);

    expect(run).not.toHaveBeenCalled();
  });

  test("forwards the change to the context processor", async () => {
    const run = vi.fn();
    const ctx = { processor: { run } } as unknown as HandlerContext;
    const event = createEvent({ prompt: "hello" });

    await handleDocumentWrite(event, ctx);

    expect(run).toHaveBeenCalledWith(event.data);
  });

  test("generates a response and writes it back to the message doc", async () => {
    const update = vi.fn();
    const event = createEvent({ prompt: "hello" }, update);

    await handleDocumentWrite(event, { processor: createProcessor(config()) });

    expect(mocks.send).toHaveBeenCalledWith(
      "hello",
      expect.objectContaining({ history: [] })
    );
    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[0][0].status.state).toBe(State.PROCESSING);
    expect(update.mock.calls[1][0]).toMatchObject({
      response: "generated",
      "status.state": State.COMPLETED,
    });
  });

  test("reads the prompt from, and writes the response to, the configured fields", async () => {
    const update = vi.fn();
    const event = createEvent({ question: "hello" }, update);
    const processor = createProcessor(
      config({ promptField: "question", responseField: "answer" })
    );

    await handleDocumentWrite(event, { processor });

    expect(mocks.send).toHaveBeenCalledWith("hello", expect.anything());
    expect(update.mock.calls[1][0]).toMatchObject({ answer: "generated" });
  });

  test("maps a generation failure through the error message builder", async () => {
    const update = vi.fn();
    mocks.send.mockRejectedValue(
      Object.assign(new Error("denied"), {
        reason: "ACCESS_TOKEN_SCOPE_INSUFFICIENT",
      })
    );

    await handleDocumentWrite(createEvent({ prompt: "hello" }, update), {
      processor: createProcessor(config()),
    });

    expect(update.mock.calls[1][0].status).toMatchObject({
      state: State.ERROR,
      error:
        "The project or service account likely does not have access to the Gemini API.",
    });
  });

  test("skips a document that is already completed", async () => {
    const update = vi.fn();
    const event = createEvent(
      { prompt: "hello", status: { state: State.COMPLETED } },
      update
    );

    await handleDocumentWrite(event, { processor: createProcessor(config()) });

    expect(mocks.send).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
