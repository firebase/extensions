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

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { toEventContext } from "../src/event-context";

const publish = vi.fn().mockResolvedValue(undefined);
const channel = vi.fn(() => ({ publish }));

vi.mock("firebase-admin/eventarc", () => ({
  getEventarc: () => ({ channel }),
}));

const CHANNEL = "projects/p/locations/l/channels/firebase";
const EVENT_PREFIX = "firebase.extensions.firestore-translate-text.v1";

/** A write on the `COLLECTION_PATH/{messageId}` trigger. */
const DOCUMENT_WRITE = {
  id: "event-1",
  time: "2026-01-01T00:00:00.000Z",
  project: "demo-project",
  database: "(default)",
  document: "translations/id1",
  params: { messageId: "id1" },
} as any;

async function importEvents(channelName?: string) {
  if (channelName) {
    process.env.EVENTARC_CHANNEL = channelName;
  } else {
    delete process.env.EVENTARC_CHANNEL;
  }

  vi.resetModules();
  const events = await import("../src/events");
  events.setupEventChannel();
  return events;
}

describe("events", () => {
  const originalChannel = process.env.EVENTARC_CHANNEL;
  const originalSelected = process.env.EXT_SELECTED_EVENTS;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalChannel === undefined) {
      delete process.env.EVENTARC_CHANNEL;
    } else {
      process.env.EVENTARC_CHANNEL = originalChannel;
    }
    if (originalSelected === undefined) {
      delete process.env.EXT_SELECTED_EVENTS;
    } else {
      process.env.EXT_SELECTED_EVENTS = originalSelected;
    }
  });

  test("opens the channel with the selected event types", async () => {
    process.env.EXT_SELECTED_EVENTS = `${EVENT_PREFIX}.onStart`;
    await importEvents(CHANNEL);

    expect(channel).toHaveBeenCalledWith(CHANNEL, {
      allowedEventTypes: `${EVENT_PREFIX}.onStart`,
    });
  });

  test("publishes the start event", async () => {
    const events = await importEvents(CHANNEL);

    const context = toEventContext(DOCUMENT_WRITE);

    await events.recordStartEvent({
      change: { before: {}, after: {} },
      context,
    });

    expect(publish).toHaveBeenCalledWith({
      type: `${EVENT_PREFIX}.onStart`,
      data: { change: { before: {}, after: {} }, context },
    });
  });

  test("publishes the error event with just the message", async () => {
    const events = await importEvents(CHANNEL);

    await events.recordErrorEvent(new Error("kaboom"));

    expect(publish).toHaveBeenCalledWith({
      type: `${EVENT_PREFIX}.onError`,
      data: { message: "kaboom" },
    });
  });

  test("publishes the success event with the document path as subject", async () => {
    const events = await importEvents(CHANNEL);

    await events.recordSuccessEvent({
      subject: "translations/id1",
      data: { outputFieldName: "translated", translations: { en: "hello" } },
    });

    expect(publish).toHaveBeenCalledWith({
      type: `${EVENT_PREFIX}.onSuccess`,
      subject: "translations/id1",
      data: { outputFieldName: "translated", translations: { en: "hello" } },
    });
  });

  test("publishes the completion event", async () => {
    const events = await importEvents(CHANNEL);

    const context = toEventContext(DOCUMENT_WRITE);

    await events.recordCompletionEvent({ context });

    expect(publish).toHaveBeenCalledWith({
      type: `${EVENT_PREFIX}.onCompletion`,
      data: { context },
    });
  });

  test("puts the whole 1st gen context on the wire", async () => {
    const events = await importEvents(CHANNEL);
    const context = toEventContext(DOCUMENT_WRITE);

    await events.recordStartEvent({
      change: { before: {}, after: {} },
      context,
    });
    await events.recordCompletionEvent({ context });

    // `firebase-admin` sends the payload as `JSON.stringify(data)`, so this is
    // what a subscriber of the extension's events actually reads.
    expect(publish.mock.calls.length).toBe(2);
    for (const [event] of publish.mock.calls) {
      expect(JSON.parse(JSON.stringify(event.data)).context).toEqual({
        eventId: "event-1",
        timestamp: "2026-01-01T00:00:00.000Z",
        eventType: "google.firestore.document.write",
        resource: {
          service: "firestore.googleapis.com",
          name: "projects/demo-project/databases/(default)/documents/translations/id1",
        },
        params: { messageId: "id1" },
      });
    }
  });

  test("is a no-op when no channel is configured", async () => {
    const events = await importEvents();

    await events.recordStartEvent({});
    await events.recordErrorEvent(new Error("boom"));
    await events.recordSuccessEvent({ subject: "s", data: {} });
    await events.recordCompletionEvent({});

    expect(publish).not.toHaveBeenCalled();
  });
});
