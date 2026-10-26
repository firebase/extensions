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

import type { StorageEvent } from "firebase-functions/v2/storage";

/**
 * The 1st gen `EventContext` shape that the extension published inside its
 * `onCompletion` payload.
 */
export interface EventContext {
  eventId: string;
  timestamp: string;
  eventType: string;
  resource: {
    service: string;
    name: string;
    type?: string;
  };
  params: Record<string, string>;
}

/**
 * The extension's only trigger was `onFinalize`, so subscribers matching on
 * `context.eventType` keep matching this value.
 */
const STORAGE_FINALIZE_EVENT_TYPE = "google.storage.object.finalize";

const STORAGE_SERVICE = "storage.googleapis.com";

/**
 * The extension's timestamps had millisecond precision with trailing zeros
 * trimmed (`...36.06Z`), while 2nd gen event times carry microseconds.
 */
function toLegacyTimestamp(time: string | undefined): string {
  return new Date(time ?? Date.now()).toISOString().replace(/\.?0+Z$/, "Z");
}

/**
 * Rebuilds the 1st gen `EventContext` from a 2nd gen `StorageEvent`, so the
 * `onCompletion` payload keeps the shape the extension published and
 * `resource.name` still names the uploaded object.
 *
 * `params` is always empty: the extension registered
 * `functions.storage.object()`, whose trigger path has no wildcards.
 */
export function toEventContext(event: StorageEvent): EventContext {
  return {
    eventId: event.id,
    timestamp: toLegacyTimestamp(event.time),
    eventType: STORAGE_FINALIZE_EVENT_TYPE,
    resource: {
      service: STORAGE_SERVICE,
      name: `projects/_/buckets/${event.data.bucket}/objects/${event.data.name}`,
      type: event.data.kind,
    },
    params: {},
  };
}
