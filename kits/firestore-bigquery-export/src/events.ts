/*
 * Copyright 2019 Google LLC
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

const { getEventarc } = eventArc;

/**
 * Generates both the OLD and NEW event types to maintain backward compatibility.
 *
 * Old Event Type: firebase.extensions.firestore-counter.v1.{eventName}
 * New Event Type: firebase.extensions.firestore-bigquery-export.v1.{eventName}
 *
 * @param eventName The name of the event (e.g., "onStart", "onError", etc.)
 * @returns An array containing both the old and new event types
 */
const getEventTypes = (eventName: string) => [
  `firebase.extensions.firestore-counter.v1.${eventName}`, // OLD Event Type for backward compatibility
  `firebase.extensions.firestore-bigquery-export.v1.${eventName}`, // NEW Event Type following the updated convention
];

let eventChannel: eventArc.Channel | undefined;

/**
 * The Eventarc channel named by `EVENTARC_CHANNEL`, or `undefined` when the
 * variable is unset or blank, which disables event publishing.
 */
export const configuredEventChannel = (): string | undefined =>
  process.env.EVENTARC_CHANNEL?.trim() || undefined;

/**
 * Sets up the Eventarc channel.
 *
 * This function retrieves the Eventarc channel based on the environment variables:
 * - `EVENTARC_CHANNEL` specifies the channel to use for publishing events.
 * - `EXT_SELECTED_EVENTS` defines the allowed event types.
 *
 * @function setupEventChannel
 */
export const setupEventChannel = () => {
  const channel = configuredEventChannel();
  eventChannel = channel
    ? getEventarc().channel(channel, {
        allowedEventTypes: process.env.EXT_SELECTED_EVENTS,
      })
    : undefined;
};

/**
 * Publishes an event, logging and swallowing any failure.
 *
 * A deleted or unreachable Eventarc channel must not fail the invocation: the
 * BigQuery export is the contract, event delivery is best effort.
 */
const publish = async (event: eventArc.CloudEvent): Promise<void> => {
  if (!eventChannel) return;

  try {
    await eventChannel.publish(event);
  } catch (err) {
    logger.warn(`Failed to publish Eventarc event ${event.type}`, err);
  }
};

/**
 * Publishes a "start" event using both OLD and NEW event types.
 *
 * @param data The payload to send with the event. Can be a string or an object.
 * @returns A Promise resolving once both publishes have been attempted.
 */
export const recordStartEvent = async (data: string | object) => {
  const eventTypes = getEventTypes("onStart");

  // Publish events for both OLD and NEW event types
  await Promise.all(
    eventTypes.map((type) =>
      publish({
        type,
        data,
      })
    )
  );
};

/**
 * Publishes an "error" event using both OLD and NEW event types.
 *
 * @param err The Error object containing the error message.
 * @param subject (Optional) Subject identifier related to the error event.
 * @returns A Promise resolving once both publishes have been attempted.
 */
export const recordErrorEvent = async (err: Error, subject?: string) => {
  const eventTypes = getEventTypes("onError");

  // Publish events for both OLD and NEW event types
  await Promise.all(
    eventTypes.map((type) =>
      publish({
        type,
        data: { message: err.message },
        subject,
      })
    )
  );
};

/**
 * Publishes a "success" event using both OLD and NEW event types.
 *
 * @param params An object containing the subject and the event data.
 * @param params.subject A string representing the subject of the event.
 * @param params.data The payload to send with the event.
 * @returns A Promise resolving once both publishes have been attempted.
 */
export const recordSuccessEvent = async ({
  subject,
  data,
}: {
  subject: string;
  data: string | object;
}) => {
  const eventTypes = getEventTypes("onSuccess");

  // Publish events for both OLD and NEW event types
  await Promise.all(
    eventTypes.map((type) =>
      publish({
        type,
        subject,
        data,
      })
    )
  );
};

/**
 * Publishes a "completion" event using both OLD and NEW event types.
 *
 * @param data The payload to send with the event. Can be a string or an object.
 * @returns A Promise resolving once both publishes have been attempted.
 */
export const recordCompletionEvent = async (data: string | object) => {
  const eventTypes = getEventTypes("onCompletion");

  // Publish events for both OLD and NEW event types
  await Promise.all(
    eventTypes.map((type) =>
      publish({
        type,
        data,
      })
    )
  );
};
