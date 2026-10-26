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

import { afterEach, describe, expect, test, vi } from "vitest";
import * as storageV1 from "firebase-functions/v1/storage";
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
 * The oracle: run the extension's own 1st gen registration through the real
 * `firebase-functions` v1 code path and compare the `context` its handler
 * received, which the extension published verbatim.
 */
describe("the 1st gen context the extension actually published", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("matches the context rebuilt from the equivalent 2nd gen event", async () => {
    vi.stubEnv("GCLOUD_PROJECT", "demo-project");
    vi.stubEnv(
      "FIREBASE_CONFIG",
      JSON.stringify({ projectId: "demo-project", storageBucket: BUCKET })
    );
    let published: unknown;

    // The extension registered `functions.storage.object().onFinalize(...)`.
    const cloudFunction = storageV1
      .object()
      .onFinalize(async (_object, context) => {
        published = JSON.parse(JSON.stringify(context));
      });

    // The legacy event body the functions framework builds for this
    // CloudEvent (`marshalConvertableCloudEvent` in
    // @google-cloud/functions-framework).
    await (cloudFunction as any)(event.data, {
      eventId: "event-1",
      timestamp: "2026-01-01T00:00:36.898Z",
      eventType: "google.storage.object.finalize",
      resource: {
        service: "storage.googleapis.com",
        name: `projects/_/buckets/${BUCKET}/objects/${OBJECT_NAME}`,
        type: "storage#object",
      },
    });

    expect(published).toEqual(toEventContext(event));
  });
});
