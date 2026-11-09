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

const CHANNEL = "projects/p/locations/us-central1/channels/firebase";

const ALL_EVENT_TYPES = [
  "firebase.extensions.delete-user-data.v1.firestore",
  "firebase.extensions.delete-user-data.v1.database",
  "firebase.extensions.delete-user-data.v1.storage",
];
const ALL_EVENTS = ALL_EVENT_TYPES.join(",");

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
const ORIGINAL_PROJECT = process.env.GCLOUD_PROJECT;

beforeEach(() => {
  vi.clearAllMocks();
  setEnv("GCLOUD_PROJECT", "p");
});

afterEach(() => {
  setEnv("EVENTARC_CHANNEL", ORIGINAL_CHANNEL);
  setEnv("EXT_SELECTED_EVENTS", ORIGINAL_SELECTED_EVENTS);
  setEnv("GCLOUD_PROJECT", ORIGINAL_PROJECT);
});

describe("setupEventChannel", () => {
  test("opens the configured channel with the selected event types", async () => {
    await importEvents(
      CHANNEL,
      "firebase.extensions.delete-user-data.v1.firestore"
    );

    expect(channel).toHaveBeenCalledWith(CHANNEL, {
      allowedEventTypes: ["firebase.extensions.delete-user-data.v1.firestore"],
    });
  });

  // The CLI dropped empty entries before the platform checked the list.
  test("skips empty entries", async () => {
    await importEvents(CHANNEL, `,${ALL_EVENT_TYPES.join(",,")},`);

    expect(channel).toHaveBeenCalledWith(CHANNEL, {
      allowedEventTypes: ALL_EVENT_TYPES,
    });
  });

  // The extension's install rejected each of these, so the deploy fails
  // instead of trimming or dropping entries.
  test.each([
    ["spaces after commas", ALL_EVENT_TYPES.join(", ")],
    ["surrounding whitespace", `  ${ALL_EVENT_TYPES.join(" ,  ")}  `],
    ["whitespace only", "   "],
    ["only commas and spaces", " , ,"],
    ["different case", "firebase.extensions.delete-user-data.v1.Firestore"],
    [
      "an unknown type",
      "firebase.extensions.delete-user-data.v1.bogus,firebase.extensions.delete-user-data.v1.database",
    ],
    ["a duplicate type", `${ALL_EVENT_TYPES[0]},${ALL_EVENT_TYPES[0]}`],
    ["a ';' separator", ALL_EVENT_TYPES.join(";")],
  ])("rejects EXT_SELECTED_EVENTS with %s", async (_label, selectedEvents) => {
    await expect(importEvents(CHANNEL, selectedEvents)).rejects.toThrow(
      "EXT_SELECTED_EVENTS is invalid"
    );
    expect(channel).not.toHaveBeenCalled();
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

  test("stays disabled when neither is configured", async () => {
    const events = await importEvents(undefined, null);

    expect(channel).not.toHaveBeenCalled();
    await events.publishDeletionEvent("firestore", { uid: "u1" });
    expect(publish).not.toHaveBeenCalled();
  });

  // The extension's install rejected selected events without a channel.
  test("rejects selected event types without EVENTARC_CHANNEL", async () => {
    await expect(importEvents(undefined, ALL_EVENTS)).rejects.toThrow(
      "Must specify eventarc channel"
    );
    expect(channel).not.toHaveBeenCalled();
  });

  test.each([
    ["a bare channel id", "firebase"],
    ["a missing location", "projects/p/channels/firebase"],
    ["a trailing slash", `${CHANNEL}/`],
  ])("rejects an EVENTARC_CHANNEL with %s", async (_label, channelName) => {
    await expect(importEvents(channelName, ALL_EVENTS)).rejects.toThrow(
      "EVENTARC_CHANNEL"
    );
    expect(channel).not.toHaveBeenCalled();
  });

  // The extension's install accepted only a channel in its own project, in one
  // of the CLI's ALLOWED_EVENT_ARC_REGIONS, even with no event types selected.
  test.each(["us-central1", "us-west1", "europe-west4", "asia-northeast1"])(
    "accepts a channel in %s",
    async (location) => {
      const name = `projects/p/locations/${location}/channels/c`;
      await importEvents(name, ALL_EVENTS);

      expect(channel).toHaveBeenCalledWith(name, {
        allowedEventTypes: ALL_EVENT_TYPES,
      });
    }
  );

  test.each([
    [
      "an unsupported location",
      "projects/p/locations/europe-west1/channels/c",
      "location 'europe-west1' is not supported",
    ],
    [
      "the global location",
      "projects/p/locations/global/channels/c",
      "location 'global' is not supported",
    ],
    [
      "another project",
      "projects/other/locations/us-central1/channels/c",
      "it must be in the same project, 'p'",
    ],
    [
      "the project number",
      "projects/123456/locations/us-central1/channels/c",
      "it must be in the same project, 'p'",
    ],
  ])("rejects a channel in %s", async (_label, channelName, message) => {
    for (const selected of [ALL_EVENTS, null]) {
      await expect(importEvents(channelName, selected)).rejects.toThrow(
        message
      );
    }
    expect(channel).not.toHaveBeenCalled();
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
