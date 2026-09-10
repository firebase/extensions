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

/**
 * The extension published its 1st gen handler's `context` verbatim, so these
 * assertions pin the fields subscribers read off it.
 */
describe("toEventContext", () => {
  const event = {
    id: "event-1",
    time: "2026-01-01T00:00:00.000Z",
    project: "demo-project",
    database: "(default)",
    document: "pages/home/_counter_shards_/0000",
    params: { collection: "pages", counter: "home", shardId: "0000" },
  } as any;

  test("rebuilds the 1st gen event context from a 2nd gen event", () => {
    expect(toEventContext(event)).toEqual({
      eventId: "event-1",
      timestamp: "2026-01-01T00:00:00.000Z",
      eventType: "google.firestore.document.write",
      resource: {
        service: "firestore.googleapis.com",
        name: "projects/demo-project/databases/(default)/documents/pages/home/_counter_shards_/0000",
      },
      params: {},
    });
  });

  test("names the resource under the event's own database", () => {
    const context = toEventContext({ ...event, database: "counters" });

    expect(context.resource.name).toBe(
      "projects/demo-project/databases/counters/documents/pages/home/_counter_shards_/0000"
    );
  });

  // 1st gen read `context.params` off the trigger path registered in code, and
  // the extension registered `.document(process.env.INTERNAL_STATE_PATH)` with
  // no `{wildcard}` segment, so subscribers always saw `{}`. The 2nd gen event
  // does carry the yaml wildcards, and they must not leak onto the wire.
  test("drops the 2nd gen event params the extension never published", () => {
    const params = { collection: "docs", counter: "a/b/c", shardId: "0001" };

    expect(toEventContext({ ...event, params }).params).toEqual({});
  });
});

/**
 * The behavioural oracle for the empty `params` above: run the extension's own
 * 1st gen registration through the real `firebase-functions` v1 code path and
 * read the `context` it built.
 */
describe("the 1st gen context the extension actually published", () => {
  test("leaves params empty for the extension's wildcard-free trigger path", async () => {
    vi.stubEnv("GCLOUD_PROJECT", "demo-project");
    // The extension registered
    // `functions.firestore.document(process.env.INTERNAL_STATE_PATH).onWrite(...)`
    // (firestore-counter/functions/src/index.ts:79-80) and this is the
    // parameter's default value.
    const triggerPath = "_firebase_ext_/sharded_counter";
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
        resource: {
          service: "firestore.googleapis.com",
          name: `projects/demo-project/databases/(default)/documents/${triggerPath}`,
        },
      }
    );

    expect(published).toEqual({});
  });
});
