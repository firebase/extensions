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
    document: "_firebase_ext_/sharded_counter",
    params: { shardId: "0000" },
  } as any;

  test("rebuilds the 1st gen event context from a 2nd gen event", () => {
    expect(toEventContext(event)).toEqual({
      eventId: "event-1",
      timestamp: "2026-01-01T00:00:00.000Z",
      eventType: "google.firestore.document.write",
      resource: {
        service: "firestore.googleapis.com",
        name: "projects/demo-project/databases/(default)/documents/_firebase_ext_/sharded_counter",
      },
      params: { shardId: "0000" },
    });
  });

  test("names the resource under the event's own database", () => {
    const context = toEventContext({ ...event, database: "counters" });

    expect(context.resource.name).toBe(
      "projects/demo-project/databases/counters/documents/_firebase_ext_/sharded_counter"
    );
  });

  test("passes the trigger wildcards through unchanged", () => {
    const params = { collection: "pages", counter: "home", shardId: "0001" };

    expect(toEventContext({ ...event, params }).params).toEqual(params);
  });
});
