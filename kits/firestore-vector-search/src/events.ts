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

const EXTENSION_NAME = "firestore-vector-search";

const getEventType = (eventName: string): string =>
  `firebase.extensions.${EXTENSION_NAME}.v1.${eventName}`;

let eventChannel: eventArc.Channel | undefined;

export const setupEventChannel = (): void => {
  eventChannel = process.env.EVENTARC_CHANNEL
    ? eventArc.getEventarc().channel(process.env.EVENTARC_CHANNEL, {
        allowedEventTypes: process.env.EXT_SELECTED_EVENTS,
      })
    : undefined;
};

export async function recordStartEvent(data: object): Promise<unknown> {
  if (!eventChannel) return Promise.resolve();
  return eventChannel.publish({ type: getEventType("onStart"), data });
}

export async function recordErrorEvent(err: Error): Promise<unknown> {
  if (!eventChannel) return Promise.resolve();
  return eventChannel.publish({
    type: getEventType("onError"),
    data: { message: err.message },
  });
}

export async function recordSuccessEvent(params: {
  subject: string;
  data: object;
}): Promise<unknown> {
  if (!eventChannel) return Promise.resolve();
  return eventChannel.publish({
    type: getEventType("onSuccess"),
    subject: params.subject,
    data: params.data,
  });
}

export async function recordCompletionEvent(data: object): Promise<unknown> {
  if (!eventChannel) return Promise.resolve();
  return eventChannel.publish({ type: getEventType("onCompletion"), data });
}
