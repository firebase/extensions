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

const publish = vi.fn().mockResolvedValue(undefined);
const channel = vi.fn(() => ({ publish }));

vi.mock("firebase-admin/eventarc", () => ({
  getEventarc: () => ({ channel }),
}));

import { Status } from "../src/types";

describe("events", () => {
  const ORIGINAL_ENV = process.env.EVENTARC_CHANNEL;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.EVENTARC_CHANNEL;
    } else {
      process.env.EVENTARC_CHANNEL = ORIGINAL_ENV;
    }
  });

  test("publishes the complete event with the legacy type", async () => {
    process.env.EVENTARC_CHANNEL = "projects/p/locations/l/channels/c";
    const events = await import("../src/events");
    events.setupEventChannel();

    await events.recordCompleteEvent(
      { status: Status.SUCCESS, warnings: [], transcription: { 1: ["hi"] } },
      "audio.wav"
    );

    expect(publish).toHaveBeenCalledWith({
      type: "firebase.extensions.storage-transcribe-audio.v1.complete",
      data: expect.objectContaining({ objectName: "audio.wav" }),
    });
  });

  test("publishes the fail event with the legacy type", async () => {
    process.env.EVENTARC_CHANNEL = "projects/p/locations/l/channels/c";
    const events = await import("../src/events");
    events.setupEventChannel();

    await events.recordFailureEvent(
      { status: Status.FAILURE, warnings: [], type: 5 },
      "audio.wav"
    );

    expect(publish).toHaveBeenCalledWith({
      type: "firebase.extensions.storage-transcribe-audio.v1.fail",
      data: expect.objectContaining({ objectName: "audio.wav" }),
    });
  });

  test("publishes the error itself in the fail payload", async () => {
    process.env.EVENTARC_CHANNEL = "projects/p/locations/l/channels/c";
    const events = await import("../src/events");
    events.setupEventChannel();

    const err = new Error("kaboom");
    await events.recordErrorEvent(err);

    expect(publish).toHaveBeenCalledWith({
      type: "firebase.extensions.storage-transcribe-audio.v1.fail",
      data: { error: err },
    });
    // Parity with the extension: for a plain `Error`, `message` and `stack` are
    // not enumerable, so subscribers receive `{"error":{}}`. Richer errors keep
    // whatever own properties they set (see the `ApiError` case below).
    const payload = publish.mock.calls[0][0];
    expect(JSON.parse(JSON.stringify(payload)).data).toEqual({ error: {} });
  });

  test("keeps the enumerable fields of a Storage ApiError in the fail payload", async () => {
    process.env.EVENTARC_CHANNEL = "projects/p/locations/l/channels/c";
    const events = await import("../src/events");
    events.setupEventChannel();

    // Shaped like @google-cloud/common's `ApiError`, which assigns `code`,
    // `errors`, `response` and `message` as own (enumerable) properties.
    const apiError = new Error() as Error & {
      code: number;
      errors: { message: string }[];
      response: { statusCode: number };
    };
    apiError.code = 404;
    apiError.errors = [{ message: "Not Found" }];
    apiError.response = { statusCode: 404 };
    apiError.message = "Not Found";

    await events.recordErrorEvent(apiError);

    const payload = publish.mock.calls[0][0];
    expect(JSON.parse(JSON.stringify(payload)).data).toEqual({
      error: {
        code: 404,
        errors: [{ message: "Not Found" }],
        response: { statusCode: 404 },
        message: "Not Found",
      },
    });
  });

  test("keeps the name and message of a thrown non-error in the fail payload", async () => {
    process.env.EVENTARC_CHANNEL = "projects/p/locations/l/channels/c";
    const events = await import("../src/events");
    const { errorFromAny } = await import("../src/util");
    events.setupEventChannel();

    await events.recordErrorEvent(errorFromAny("not an error"));

    const payload = publish.mock.calls[0][0];
    expect(JSON.parse(JSON.stringify(payload)).data).toEqual({
      error: { name: "Thrown non-error object", message: "not an error" },
    });
  });

  test("is a no-op when no channel is configured", async () => {
    delete process.env.EVENTARC_CHANNEL;
    const events = await import("../src/events");
    events.setupEventChannel();

    await events.recordErrorEvent(new Error("boom"));

    expect(publish).not.toHaveBeenCalled();
  });
});
