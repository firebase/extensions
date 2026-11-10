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

const CHANNEL_NAME = /^projects\/([^/]+)\/locations\/([^/]+)\/channels\/[^/]+$/;

// The channel locations the extension's install accepted, as in the Firebase
// CLI's ALLOWED_EVENT_ARC_REGIONS.
const CHANNEL_LOCATIONS: ReadonlyArray<string> = [
  "us-central1",
  "us-west1",
  "europe-west4",
  "asia-northeast1",
];

/**
 * Reads `EXT_SELECTED_EVENTS`, failing on a value the extension's install
 * rejected.
 *
 * Splits on "," and skips "" (as the CLI did); rejects anything that isn't an
 * exact declared type, or is listed twice (as the platform did). Also rejects
 * event types without `EVENTARC_CHANNEL`, and a channel that is malformed, in
 * another project or in an unsupported location, as the install did. Called at
 * module load so a bad value fails the deploy.
 */
export function selectedEventTypes(): string[] {
  const types = (process.env.EXT_SELECTED_EVENTS ?? "")
    .split(",")
    .filter((t) => t !== "");
  // A repeat is reported as a duplicate even if it isn't a declared type, as
  // the platform did.
  const errors = types.flatMap((t, i) =>
    types.indexOf(t) !== i
      ? [`'${t}' is listed more than once`]
      : !EVENT_TYPES.includes(t)
      ? [`'${t}' is not one of ${EVENT_TYPES.join(", ")}`]
      : []
  );
  if (errors.length) {
    throw new Error(
      `EXT_SELECTED_EVENTS is invalid: ${errors.join("; ")}. ` +
        "List event types separated by commas, without spaces."
    );
  }

  const channel = process.env.EVENTARC_CHANNEL;
  if (types.length > 0 && !channel) {
    throw new Error(
      "EXT_SELECTED_EVENTS is set but EVENTARC_CHANNEL is not. " +
        "Must specify eventarc channel if allowing some events to be emitted."
    );
  }
  if (channel) {
    const match = CHANNEL_NAME.exec(channel);
    if (!match) {
      throw new Error(
        `EVENTARC_CHANNEL '${channel}' is invalid. Use the full channel name, ` +
          "e.g. projects/<project id>/locations/<location>/channels/<channel id>."
      );
    }
    const [, project, location] = match;
    // Set by the CLI when it loads the kit, and at runtime.
    const currentProject = process.env.GCLOUD_PROJECT;
    const channelErrors = [
      ...(CHANNEL_LOCATIONS.includes(location)
        ? []
        : [
            `location '${location}' is not supported, use one of ` +
              CHANNEL_LOCATIONS.join(", "),
          ]),
      ...(currentProject && project !== currentProject
        ? [`it must be in the same project, '${currentProject}'`]
        : []),
    ];
    if (channelErrors.length) {
      throw new Error(
        `EVENTARC_CHANNEL '${channel}' is invalid: ${channelErrors.join("; ")}.`
      );
    }
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
