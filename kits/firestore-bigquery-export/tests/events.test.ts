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

const { publish, channel } = vi.hoisted(() => {
  const publish = vi.fn().mockResolvedValue(undefined);
  const channel = vi.fn(() => ({ publish }));
  return { publish, channel };
});

vi.mock("firebase-admin/eventarc", () => ({
  getEventarc: () => ({ channel }),
}));

import {
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
});

describe("channel configured", () => {
  beforeEach(() => {
    process.env.EVENTARC_CHANNEL = "projects/p/locations/l/channels/c";
    setupEventChannel();
  });

  test("publishes the firestore-bigquery-export event type only", async () => {
    await recordStartEvent({ a: 1 });
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "firebase.extensions.firestore-bigquery-export.v1.onStart",
      })
    );
  });

  test("error / success / completion map to their event types", async () => {
    await recordErrorEvent(new Error("boom"));
    await recordSuccessEvent({ subject: "doc1", data: { a: 1 } });
    await recordCompletionEvent({ a: 1 });

    const types = publish.mock.calls.map((c) => c[0].type);
    expect(types).toEqual([
      "firebase.extensions.firestore-bigquery-export.v1.onError",
      "firebase.extensions.firestore-bigquery-export.v1.onSuccess",
      "firebase.extensions.firestore-bigquery-export.v1.onCompletion",
    ]);
  });
});
