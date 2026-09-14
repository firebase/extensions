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

import type { FirestoreEvent } from "firebase-functions/v2/firestore";

export const EVENT_ID = "event-1";
export const EVENT_TIME = "2026-01-01T00:00:00.000Z";
export const EVENT_PROJECT = "demo-project";
export const EVENT_DATABASE = "(default)";
export const EVENT_DOCUMENT = "pages/home/_counter_shards_/0000";

type ShardWriteEvent = FirestoreEvent<unknown, Record<string, string>>;

/**
 * A shard write on the `{collection}/{counter=**}/_counter_shards_/{shardId}`
 * trigger. `overrides` replaces individual fields, so a test can drop or change
 * one without restating the fixture.
 */
export function makeEvent(
  overrides: Partial<Record<keyof ShardWriteEvent, unknown>> = {}
): ShardWriteEvent {
  return {
    id: EVENT_ID,
    time: EVENT_TIME,
    project: EVENT_PROJECT,
    database: EVENT_DATABASE,
    document: EVENT_DOCUMENT,
    params: { collection: "pages", counter: "home", shardId: "0000" },
    ...overrides,
  } as unknown as ShardWriteEvent;
}
