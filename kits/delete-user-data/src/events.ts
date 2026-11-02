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

import * as eventArc from "firebase-admin/eventarc";
import { logger } from "firebase-functions";

let eventChannel: eventArc.Channel | undefined;

const EVENT_TYPES: ReadonlyArray<string> = [
  "firestore",
  "database",
  "storage",
].map((t) => `firebase.extensions.delete-user-data.v1.${t}`);

/**
 * Reads `EXT_SELECTED_EVENTS`, failing on a value the extension's install
 * rejected.
 *
 * Splits on "," and skips "" (as the CLI did); rejects anything that isn't an
 * exact declared type, or is listed twice (as the platform did). Called at
 * module load so a bad value fails the deploy.
 */
export function selectedEventTypes(): string[] {
  const types = (process.env.EXT_SELECTED_EVENTS ?? "")
    .split(",")
    .filter((t) => t !== "");
  const errors = types.flatMap((t, i) =>
    !EVENT_TYPES.includes(t)
      ? [`'${t}' is not one of ${EVENT_TYPES.join(", ")}`]
      : types.indexOf(t) !== i
      ? [`'${t}' is listed more than once`]
      : []
  );
  if (errors.length) {
    throw new Error(
      `EXT_SELECTED_EVENTS is invalid: ${errors.join("; ")}. ` +
        "List event types separated by commas, without spaces."
    );
  }
  return types;
}

/**
 * Opens the Eventarc channel only when event types are selected.
 *
 * The extension emitted only the types selected at install. With none
 * selected, the platform cleared the channel and nothing was published.
 * firebase-admin reads a missing allowlist as "allow every type", so an unset
 * or empty `EXT_SELECTED_EVENTS` has to disable publishing here.
 */
export const setupEventChannel = (): void => {
  const channel = process.env.EVENTARC_CHANNEL;
  const selectedEvents = selectedEventTypes();

  eventChannel =
    channel && selectedEvents.length > 0
      ? eventArc.getEventarc().channel(channel, {
          allowedEventTypes: selectedEvents,
        })
      : undefined;
};

/**
 * Publishes an event, logging and swallowing any failure.
 *
 * A deleted or unreachable Eventarc channel must not fail the invocation:
 * deleting the user's data is the contract, event delivery is best effort.
 */
const publish = async (event: eventArc.CloudEvent): Promise<void> => {
  if (!eventChannel) return;

  try {
    await eventChannel.publish(event);
  } catch (err) {
    logger.warn(`Failed to publish Eventarc event ${event.type}`, err);
  }
};

export async function publishDeletionEvent(
  target: "firestore" | "database" | "storage",
  data: object
): Promise<void> {
  return publish({
    type: `firebase.extensions.delete-user-data.v1.${target}`,
    data,
  });
}
