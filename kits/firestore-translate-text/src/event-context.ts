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

/**
 * The 1st gen `EventContext` shape that the extension published inside its
 * `onStart` and `onCompletion` payloads.
 */
export interface EventContext {
  eventId: string;
  timestamp: string;
  eventType: string;
  resource: {
    service: string;
    name: string;
  };
  params: Record<string, string>;
}

/**
 * Every 1st gen Firestore `onWrite` trigger reported this event type, so
 * subscribers matching on `context.eventType` keep matching it.
 */
const FIRESTORE_WRITE_EVENT_TYPE = "google.firestore.document.write";

const FIRESTORE_SERVICE = "firestore.googleapis.com";

/**
 * Rebuilds the 1st gen `EventContext` from a 2nd gen `FirestoreEvent`.
 *
 * The extension handed the 1st gen handler's `context` straight to Eventarc, so
 * subscribers read `eventId`, `timestamp`, `eventType`, `resource` and `params`
 * off it. `FirestoreEvent` carries the same information under different names,
 * so the published payload keeps its original shape instead of following the
 * 2nd gen handler signature.
 */
export function toEventContext(
  event: FirestoreEvent<unknown, Record<string, string>>
): EventContext {
  return {
    eventId: event.id,
    timestamp: event.time,
    eventType: FIRESTORE_WRITE_EVENT_TYPE,
    resource: {
      service: FIRESTORE_SERVICE,
      name: `projects/${event.project}/databases/${event.database}/documents/${event.document}`,
    },
    params: event.params,
  };
}
