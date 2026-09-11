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

const publish = vi.fn();
const channel = vi.fn(() => ({ publish }));

vi.mock("firebase-admin/eventarc", () => ({
  getEventarc: () => ({ channel }),
}));

async function importEvents() {
  vi.resetModules();
  return import("../src/events");
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("setupEventChannel", () => {
  test("opens the configured channel with the selected event types", async () => {
    vi.stubEnv(
      "EVENTARC_CHANNEL",
      "projects/p/locations/us-central1/channels/firebase"
    );
    vi.stubEnv(
      "EXT_SELECTED_EVENTS",
      "firebase.extensions.firestore-counter.v1.onStart"
    );

    const events = await importEvents();
    events.setupEventChannel();

    expect(channel).toHaveBeenCalledWith(
      "projects/p/locations/us-central1/channels/firebase",
      {
        allowedEventTypes: "firebase.extensions.firestore-counter.v1.onStart",
      }
    );
  });

  test("stays disabled when no channel is configured", async () => {
    vi.stubEnv("EVENTARC_CHANNEL", "");

    const events = await importEvents();
    events.setupEventChannel();

    expect(channel).not.toHaveBeenCalled();
    await events.recordStartEvent({ foo: "bar" });
    expect(publish).not.toHaveBeenCalled();
  });
});

describe("event publishing", () => {
  async function setupEnabledEvents() {
    vi.stubEnv("EVENTARC_CHANNEL", "channel");
    const events = await importEvents();
    events.setupEventChannel();
    return events;
  }

  test("publishes start events", async () => {
    const events = await setupEnabledEvents();

    await events.recordStartEvent({ params: { shardId: "0000" } });

    expect(publish).toHaveBeenCalledWith({
      type: "firebase.extensions.firestore-counter.v1.onStart",
      data: { params: { shardId: "0000" } },
    });
  });

  test("publishes error events with the message only", async () => {
    const events = await setupEnabledEvents();

    await events.recordErrorEvent(new Error("boom"), "counters/counter1");

    expect(publish).toHaveBeenCalledWith({
      type: "firebase.extensions.firestore-counter.v1.onError",
      data: { message: "boom" },
      subject: "counters/counter1",
    });
  });

  test("publishes success events", async () => {
    const events = await setupEnabledEvents();

    await events.recordSuccessEvent({
      subject: "counters/counter1",
      data: { counter: 1 },
    });

    expect(publish).toHaveBeenCalledWith({
      type: "firebase.extensions.firestore-counter.v1.onSuccess",
      subject: "counters/counter1",
      data: { counter: 1 },
    });
  });

  test("publishes completion events", async () => {
    const events = await setupEnabledEvents();

    await events.recordCompletionEvent({ params: { shardId: "0000" } });

    expect(publish).toHaveBeenCalledWith({
      type: "firebase.extensions.firestore-counter.v1.onCompletion",
      data: { params: { shardId: "0000" } },
    });
  });

  test("does nothing before the channel is set up", async () => {
    vi.stubEnv("EVENTARC_CHANNEL", "channel");
    const events = await importEvents();

    await events.recordStartEvent({});
    await events.recordCompletionEvent({});

    expect(publish).not.toHaveBeenCalled();
  });
});
