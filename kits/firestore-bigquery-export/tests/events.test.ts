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

const { publish, channel } = vi.hoisted(() => {
  const publish = vi.fn().mockResolvedValue(undefined);
  const channel = vi.fn(() => ({ publish }));
  return { publish, channel };
});

vi.mock("firebase-admin/eventarc", () => ({
  getEventarc: () => ({ channel }),
}));

import {
  configuredEventChannel,
  recordCompletionEvent,
  recordErrorEvent,
  recordStartEvent,
  recordSuccessEvent,
  setupEventChannel,
} from "../src/events";

const ORIGINAL = process.env.EVENTARC_CHANNEL;

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.EVENTARC_CHANNEL;
  else process.env.EVENTARC_CHANNEL = ORIGINAL;
});

describe("no channel configured", () => {
  test("publishers are a no-op when EVENTARC_CHANNEL is unset", async () => {
    delete process.env.EVENTARC_CHANNEL;
    setupEventChannel();

    await recordStartEvent({ a: 1 });
    await recordCompletionEvent({ a: 1 });
    expect(publish).not.toHaveBeenCalled();
  });

  test.each([
    ["empty", ""],
    ["whitespace-only", "   "],
  ])("a %s EVENTARC_CHANNEL opens no channel", async (_label, value) => {
    process.env.EVENTARC_CHANNEL = value;
    setupEventChannel();

    await recordStartEvent({ a: 1 });
    expect(channel).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  test.each([
    ["unset", undefined],
    ["empty", ""],
    ["whitespace-only", "   "],
  ])("configuredEventChannel is undefined when %s", (_label, value) => {
    if (value === undefined) delete process.env.EVENTARC_CHANNEL;
    else process.env.EVENTARC_CHANNEL = value;
    expect(configuredEventChannel()).toBeUndefined();
  });
});

describe("channel configured", () => {
  beforeEach(() => {
    process.env.EVENTARC_CHANNEL = "projects/p/locations/l/channels/c";
    setupEventChannel();
  });

  test("configuredEventChannel returns the trimmed channel name", () => {
    process.env.EVENTARC_CHANNEL = "  projects/p/locations/l/channels/c  ";
    expect(configuredEventChannel()).toBe("projects/p/locations/l/channels/c");
  });

  test("opens the channel on the trimmed name", () => {
    process.env.EVENTARC_CHANNEL = "  projects/p/locations/l/channels/c  ";
    setupEventChannel();
    expect(channel).toHaveBeenLastCalledWith(
      "projects/p/locations/l/channels/c",
      expect.anything()
    );
  });

  test("publishes both the legacy and the current event type", async () => {
    await recordStartEvent({ a: 1 });
    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish.mock.calls.map((c) => c[0].type)).toEqual([
      "firebase.extensions.firestore-counter.v1.onStart",
      "firebase.extensions.firestore-bigquery-export.v1.onStart",
    ]);
  });

  test("error / success / completion map to their event types", async () => {
    await recordErrorEvent(new Error("boom"));
    await recordSuccessEvent({ subject: "doc1", data: { a: 1 } });
    await recordCompletionEvent({ a: 1 });

    const types = publish.mock.calls.map((c) => c[0].type);
    expect(types).toEqual([
      "firebase.extensions.firestore-counter.v1.onError",
      "firebase.extensions.firestore-bigquery-export.v1.onError",
      "firebase.extensions.firestore-counter.v1.onSuccess",
      "firebase.extensions.firestore-bigquery-export.v1.onSuccess",
      "firebase.extensions.firestore-counter.v1.onCompletion",
      "firebase.extensions.firestore-bigquery-export.v1.onCompletion",
    ]);
  });

  test("the legacy copy carries the same payload as the current one", async () => {
    await recordErrorEvent(new Error("boom"), "doc1");

    const [legacy, current] = publish.mock.calls.map((c) => c[0]);
    expect(legacy.data).toEqual({ message: "boom" });
    expect(legacy.subject).toBe("doc1");
    expect({ ...legacy, type: undefined }).toEqual({
      ...current,
      type: undefined,
    });
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
    process.env.EVENTARC_CHANNEL = "projects/p/locations/l/channels/c";
    setupEventChannel();

    await expect(recordStartEvent({ a: 1 })).resolves.toBeUndefined();
    await expect(recordErrorEvent(new Error("boom"))).resolves.toBeUndefined();
    await expect(
      recordSuccessEvent({ subject: "s", data: {} })
    ).resolves.toBeUndefined();
    await expect(recordCompletionEvent({ a: 1 })).resolves.toBeUndefined();

    // Two event types per call: the old and the new.
    expect(warn).toHaveBeenCalledTimes(8);
    warn.mockRestore();
  });
});
