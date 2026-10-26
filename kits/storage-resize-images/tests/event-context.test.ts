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

import { describe, expect, test } from "vitest";
import type { StorageEvent } from "firebase-functions/v2/storage";
import { toEventContext } from "../src/event-context";

const BUCKET = "demo-bucket";
const OBJECT_NAME = "images/nested/photo.jpg";

const event = {
  id: "event-1",
  type: "google.cloud.storage.object.v1.finalized",
  source: `//storage.googleapis.com/projects/_/buckets/${BUCKET}`,
  subject: `objects/${OBJECT_NAME}`,
  time: "2026-01-01T00:00:36.898303Z",
  specversion: "1.0",
  bucket: BUCKET,
  data: {
    kind: "storage#object",
    bucket: BUCKET,
    name: OBJECT_NAME,
    contentType: "image/jpeg",
  },
} as unknown as StorageEvent;

describe("toEventContext", () => {
  test("rebuilds the 1st gen event context from a 2nd gen event", () => {
    expect(toEventContext(event)).toEqual({
      eventId: "event-1",
      timestamp: "2026-01-01T00:00:36.898Z",
      eventType: "google.storage.object.finalize",
      resource: {
        service: "storage.googleapis.com",
        name: `projects/_/buckets/${BUCKET}/objects/${OBJECT_NAME}`,
        type: "storage#object",
      },
      params: {},
    });
  });

  test.each([
    ["2026-01-01T00:00:36.898303Z", "2026-01-01T00:00:36.898Z"],
    ["2026-01-01T00:00:36.060999Z", "2026-01-01T00:00:36.06Z"],
    ["2026-01-01T00:00:36.000400Z", "2026-01-01T00:00:36Z"],
  ])(
    "formats event time %s as the extension's timestamp %s",
    (time, timestamp) => {
      expect(toEventContext({ ...event, time }).timestamp).toBe(timestamp);
    }
  );
});

/**
 * One upload of `in/img-7.jpg` captured from both sides: the 2nd gen finalize
 * event the kit receives, and the `context` storage-resize-images 0.3.6
 * published. The extension took `eventId` and `timestamp` from a separate
 * delivery of the notification, so only their format can match.
 */
const CAPTURED_STORAGE_EVENT = {
  id: "22480302742407839",
  type: "google.cloud.storage.object.v1.finalized",
  source: "//storage.googleapis.com/projects/_/buckets/izaak-testing-pairc-ext",
  subject: "objects/in/img-7.jpg",
  time: "2026-10-26T15:20:21.630831Z",
  specversion: "1.0",
  bucket: "izaak-testing-pairc-ext",
  data: {
    kind: "storage#object",
    bucket: "izaak-testing-pairc-ext",
    name: "in/img-7.jpg",
    contentType: "image/jpeg",
  },
} as unknown as StorageEvent;

const CAPTURED_EXTENSION_CONTEXT = {
  eventId: "22480386067619997",
  eventType: "google.storage.object.finalize",
  resource: {
    name: "projects/_/buckets/izaak-testing-pairc-ext/objects/in/img-7.jpg",
    service: "storage.googleapis.com",
    type: "storage#object",
  },
  timestamp: "2026-10-26T15:20:21.676Z",
  params: {},
};

const LEGACY_TIMESTAMP = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d{0,2}[1-9])?Z$/;
const NUMERIC_EVENT_ID = /^\d+$/;

describe("the context the extension actually published", () => {
  test("matches the extension's eventType, resource and params exactly", () => {
    const { eventType, resource, params } = toEventContext(
      CAPTURED_STORAGE_EVENT
    );

    expect({ eventType, resource, params }).toEqual({
      eventType: CAPTURED_EXTENSION_CONTEXT.eventType,
      resource: CAPTURED_EXTENSION_CONTEXT.resource,
      params: CAPTURED_EXTENSION_CONTEXT.params,
    });
  });

  test("matches the format of the extension's eventId and timestamp", () => {
    const { eventId, timestamp } = toEventContext(CAPTURED_STORAGE_EVENT);

    expect(eventId).toBe("22480302742407839");
    expect(timestamp).toBe("2026-10-26T15:20:21.63Z");
    expect(CAPTURED_EXTENSION_CONTEXT.eventId).toMatch(NUMERIC_EVENT_ID);
    expect(eventId).toMatch(NUMERIC_EVENT_ID);
    expect(CAPTURED_EXTENSION_CONTEXT.timestamp).toMatch(LEGACY_TIMESTAMP);
    expect(timestamp).toMatch(LEGACY_TIMESTAMP);
  });
});
