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
  const event = makeEvent(undefined, undefined);

  test("rebuilds the 1st gen event context from a 2nd gen event", () => {
    expect(toEventContext(event)).toEqual({
      eventId: "event-1",
      timestamp: "2026-01-01T00:00:00.000Z",
      eventType: "google.firestore.document.write",
      resource: {
        service: "firestore.googleapis.com",
        name: "projects/demo-project/databases/(default)/documents/translations/id1",
      },
      params: { messageId: "id1" },
      notSupported: {},
    });
  });

  // The 1st gen backend put an empty `notSupported` object in every Firestore
  // event body, and the extension published the context verbatim, so the key
  // was part of the payload subscribers received. It has no 2nd gen source, so
  // the kit writes the same literal.
  test("keeps the empty notSupported object the 1st gen context carried", () => {
    const context = toEventContext(event);

    expect(context.notSupported).toEqual({});
    expect(JSON.parse(JSON.stringify(context))).toHaveProperty("notSupported");
  });

  test("names the resource under the event's own database", () => {
    const context = toEventContext({ ...event, database: "messages" });

    expect(context.resource.name).toBe(
      "projects/demo-project/databases/messages/documents/translations/id1"
    );
  });

  test("passes the trigger wildcards through unchanged", () => {
    const params = { messageId: "id2" };

    expect(toEventContext({ ...event, params }).params).toEqual(params);
  });

  // `time` is a required string on the 2nd gen `CloudEvent`, so a missing time
  // is unreachable in production. 1st gen `context.timestamp` was always a
  // string though, and an `undefined` would be dropped by `JSON.stringify`, so
  // the key must survive the round trip rather than disappear.
  test("still publishes a timestamp when the event carries no time", () => {
    const context = toEventContext({ ...event, time: undefined as any });

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
    // `functions.firestore.document(process.env.COLLECTION_PATH).onWrite(...)`
    // (firestore-translate-text/functions/src/index.ts:46-47), while the
    // trigger resource in firestore-translate-text/extension.yaml declares
    // `${param:COLLECTION_PATH}/{messageId}`.
    const triggerPath = "translations";
    const backendParams = { messageId: "id1" };
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
          name: `projects/demo-project/databases/(default)/documents/${triggerPath}/id1`,
        },
      }
    );

    expect(published).toEqual(backendParams);
  });
});
