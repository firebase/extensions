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

async function importEvents(channelName?: string) {
  vi.resetModules();
  if (channelName) {
    process.env.EVENTARC_CHANNEL = channelName;
  } else {
    delete process.env.EVENTARC_CHANNEL;
  }
  const events = await import("../src/events");
  events.setupEventChannel();
  return events;
}

const ORIGINAL_CHANNEL = process.env.EVENTARC_CHANNEL;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  if (ORIGINAL_CHANNEL === undefined) {
    delete process.env.EVENTARC_CHANNEL;
  } else {
    process.env.EVENTARC_CHANNEL = ORIGINAL_CHANNEL;
  }
});

describe("setupEventChannel", () => {
  test("opens the configured channel with the selected event types", async () => {
    process.env.EXT_SELECTED_EVENTS =
      "firebase.extensions.delete-user-data.v1.firestore";
    await importEvents(CHANNEL);

    expect(channel).toHaveBeenCalledWith(CHANNEL, {
      allowedEventTypes: "firebase.extensions.delete-user-data.v1.firestore",
    });
    delete process.env.EXT_SELECTED_EVENTS;
  });

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
