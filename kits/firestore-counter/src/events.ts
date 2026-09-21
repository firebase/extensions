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

const { getEventarc } = eventArc;

const EXTENSION_NAME = "firestore-counter";

const getEventType = (eventName: string) =>
  `firebase.extensions.${EXTENSION_NAME}.v1.${eventName}`;

let eventChannel: eventArc.Channel | undefined;

/** setup events */
export const setupEventChannel = () => {
  eventChannel = process.env.EVENTARC_CHANNEL
    ? getEventarc().channel(process.env.EVENTARC_CHANNEL, {
        allowedEventTypes: process.env.EXT_SELECTED_EVENTS,
      })
    : undefined;
};

/**
 * Publishes an event, logging and swallowing any failure.
 *
 * A deleted or unreachable Eventarc channel must not fail the invocation: the
 * counter work is the contract, event delivery is best effort.
 */
const publish = async (event: eventArc.CloudEvent): Promise<void> => {
  if (!eventChannel) return;

  try {
    await eventChannel.publish(event);
  } catch (err) {
    logger.warn(`Failed to publish Eventarc event ${event.type}`, err);
  }
};

export const recordStartEvent = async (data: string | object) => {
  return publish({
    type: getEventType("onStart"),
    data,
  });
};

export const recordErrorEvent = async (err: Error, subject?: string) => {
  return publish({
    type: getEventType("onError"),
    data: { message: err.message },
    subject,
  });
};

export const recordSuccessEvent = async ({
  subject,
  data,
}: {
  subject: string;
  data: string | object;
}) => {
  return publish({
    type: getEventType("onSuccess"),
    subject,
    data,
  });
};

export const recordCompletionEvent = async (data: string | object) => {
  return publish({
    type: getEventType("onCompletion"),
    data,
  });
};
