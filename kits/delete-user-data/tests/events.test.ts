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

import { logger } from "firebase-functions";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const publish = vi.fn().mockResolvedValue(undefined);
const channel = vi.fn(() => ({ publish }));

vi.mock("firebase-admin/eventarc", () => ({
  getEventarc: () => ({ channel }),
}));

const CHANNEL = "projects/p/locations/l/channels/firebase";

const ALL_EVENTS = [
  "firebase.extensions.delete-user-data.v1.firestore",
  "firebase.extensions.delete-user-data.v1.database",
  "firebase.extensions.delete-user-data.v1.storage",
].join(",");

// `null` unsets the variable; `undefined` would trip importEvents' default.
function setEnv(name: string, value: string | null | undefined) {
  if (value === null || value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

async function importEvents(
  channelName?: string,
  selectedEvents: string | null = ALL_EVENTS
) {
  vi.resetModules();
  setEnv("EVENTARC_CHANNEL", channelName);
  setEnv("EXT_SELECTED_EVENTS", selectedEvents);
  const events = await import("../src/events");
  events.setupEventChannel();
  return events;
}

const ORIGINAL_CHANNEL = process.env.EVENTARC_CHANNEL;
const ORIGINAL_SELECTED_EVENTS = process.env.EXT_SELECTED_EVENTS;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  setEnv("EVENTARC_CHANNEL", ORIGINAL_CHANNEL);
  setEnv("EXT_SELECTED_EVENTS", ORIGINAL_SELECTED_EVENTS);
});

describe("setupEventChannel", () => {
  test("opens the configured channel with the selected event types", async () => {
    await importEvents(
      CHANNEL,
      "firebase.extensions.delete-user-data.v1.firestore"
    );

    expect(channel).toHaveBeenCalledWith(CHANNEL, {
      allowedEventTypes: "firebase.extensions.delete-user-data.v1.firestore",
    });
  });

  // The extension cleared its channel when no event types were selected, so
  // it published nothing. firebase-admin reads a missing allowlist as "allow
  // every type", which would publish all three.
  test.each([
    ["unset", null],
    ["empty", ""],
  ])(
    "stays disabled when a channel is set but EXT_SELECTED_EVENTS is %s",
    async (_label, selectedEvents) => {
      const events = await importEvents(CHANNEL, selectedEvents);

      expect(channel).not.toHaveBeenCalled();
      await events.publishDeletionEvent("firestore", { uid: "u1" });
      await events.publishDeletionEvent("database", { uid: "u1" });
      await events.publishDeletionEvent("storage", { uid: "u1" });
      expect(publish).not.toHaveBeenCalled();
    }
  );

  test("stays disabled when no channel is configured", async () => {
    const events = await importEvents();

    expect(channel).not.toHaveBeenCalled();
    await events.publishDeletionEvent("firestore", { uid: "u1" });
    expect(publish).not.toHaveBeenCalled();
  });
});

describe("publish failures", () => {
  afterEach(() => {
    publish.mockReset();
    publish.mockResolvedValue(undefined);
  });

  test("a rejected publish is logged and never reaches the caller", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    publish.mockRejectedValue(
      Object.assign(new Error("Permission denied"), { code: 403 })
    );
    const events = await importEvents(CHANNEL);

    await expect(
      events.publishDeletionEvent("firestore", { uid: "u1" })
    ).resolves.toBeUndefined();
    await expect(
      events.publishDeletionEvent("database", { uid: "u1" })
    ).resolves.toBeUndefined();
    await expect(
      events.publishDeletionEvent("storage", { uid: "u1" })
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });
});
