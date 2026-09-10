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

import { describe, expect, test, vi } from "vitest";
import * as firestoreV1 from "firebase-functions/v1/firestore";
import { toEventContext } from "../src/event-context";
import { makeEvent } from "./helpers";

/**
 * The extension published its 1st gen handler's `context` verbatim, so these
 * assertions pin the fields subscribers read off it.
 */
describe("toEventContext", () => {
  test("rebuilds the 1st gen event context from a 2nd gen event", () => {
    expect(toEventContext(makeEvent())).toEqual({
      eventId: "event-1",
      timestamp: "2026-01-01T00:00:00.000Z",
      eventType: "google.firestore.document.write",
      resource: {
        service: "firestore.googleapis.com",
        name: "projects/demo-project/databases/(default)/documents/pages/home/_counter_shards_/0000",
      },
      params: { collection: "pages", counter: "home", shardId: "0000" },
    });
  });

  test("names the resource under the event's own database", () => {
    const context = toEventContext(makeEvent({ database: "counters" }));

    expect(context.resource.name).toBe(
      "projects/demo-project/databases/counters/documents/pages/home/_counter_shards_/0000"
    );
  });

  test("passes the trigger wildcards through unchanged", () => {
    const params = { collection: "docs", counter: "a/b/c", shardId: "0001" };

    expect(toEventContext(makeEvent({ params })).params).toEqual(params);
  });

  // `time` is a required string on the 2nd gen `CloudEvent`, so a missing time
  // is unreachable in production. 1st gen `context.timestamp` was always a
  // string though, and an `undefined` would be dropped by `JSON.stringify`, so
  // the key must survive the round trip rather than disappear.
  test("still publishes a timestamp when the event carries no time", () => {
    const context = toEventContext(makeEvent({ time: undefined }));

    expect(context.timestamp).toEqual(expect.any(String));
    expect(JSON.parse(JSON.stringify(context))).toHaveProperty("timestamp");
  });
});

/**
 * The behavioural oracle for `params`: run the extension's own 1st gen
 * registration through the real `firebase-functions` v1 code path and read the
 * `context` it built.
 *
 * `_makeParams` (matching wildcards against the code-side trigger path) is only
 * the fallback in `context.params = context.params || _makeParams(...)`. A live
 * 1st gen trigger arrives with `params` already filled in by the backend from
 * the wildcards in `extension.yaml`, and a real side-by-side deploy confirmed
 * the extension published them. So this feeds the raw event body the backend
 * actually sends.
 */
describe("the 1st gen context the extension actually published", () => {
  test("keeps the params the backend filled in from the yaml wildcards", async () => {
    vi.stubEnv("GCLOUD_PROJECT", "demo-project");
    // The extension registered
    // `functions.firestore.document(process.env.INTERNAL_STATE_PATH).onWrite(...)`
    // (firestore-counter/functions/src/index.ts:79-80), while the trigger
    // resource in firestore-counter/extension.yaml:72 declares
    // `{collection}/{counter=**}/_counter_shards_/{shardId}`.
    const triggerPath = "_firebase_ext_/sharded_counter";
    const backendParams = {
      collection: "pages",
      counter: "home",
      shardId: "0000",
    };
    let published: unknown;

    const cloudFunction = firestoreV1
      .document(triggerPath)
      .onWrite(async (_change, context) => {
        published = context.params;
      });

    await (cloudFunction as any)(
      { oldValue: {}, value: {} },
      {
        eventId: "event-1",
        timestamp: "2026-01-01T00:00:00.000Z",
        eventType: "google.firestore.document.write",
        params: backendParams,
        resource: {
          service: "firestore.googleapis.com",
          name: "projects/demo-project/databases/(default)/documents/pages/home/_counter_shards_/0000",
        },
      }
    );

    expect(published).toEqual(backendParams);
  });
});
