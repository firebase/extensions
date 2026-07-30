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

import { Channel, getEventarc } from "firebase-admin/eventarc";

let eventChannel: Channel | undefined;

/** setup events */
export const setupEventChannel = () => {
  eventChannel =
    process.env.EVENTARC_CHANNEL &&
    getEventarc().channel(process.env.EVENTARC_CHANNEL, {
      allowedEventTypes: process.env.EXT_SELECTED_EVENTS,
    });
};

export const recordStartEvent = async (change) => {
  if (!eventChannel) return;

  return eventChannel.publish({
    type: "firebase.extensions.firestore-send-email.v1.onStart",
    subject: change.after.id,
    data: { doc: change.after },
  });
};

export const recordProcessingEvent = async (change) => {
  if (!eventChannel) return;

  return eventChannel.publish({
    type: "firebase.extensions.firestore-send-email.v1.onProcessing",
    subject: change.after.id,
    data: { doc: change.after },
  });
};

export const recordErrorEvent = async (change, doc, err) => {
  if (!eventChannel) return;

  return eventChannel.publish({
    type: "firebase.extensions.firestore-send-email.v1.onError",
    subject: change.after.id,
    data: { doc, err },
  });
};

export const recordSuccessEvent = async (change) => {
  if (!eventChannel) return;

  return eventChannel.publish({
    type: "firebase.extensions.firestore-send-email.v1.onSuccess",
    subject: change.after.id,
    data: { doc: change.after },
  });
};

export const recordCompleteEvent = async (change) => {
  if (!eventChannel) return;

  return eventChannel.publish({
    type: "firebase.extensions.firestore-send-email.v1.onComplete",
    subject: change.after.id,
    data: { doc: change.after },
  });
};

export const recordPendingEvent = async (change, doc) => {
  if (!eventChannel) return;

  return eventChannel.publish({
    type: "firebase.extensions.firestore-send-email.v1.onPending",
    subject: change.after.id,
    data: { doc },
  });
};

export const recordRetryEvent = async (change, doc) => {
  if (!eventChannel) return;

  return eventChannel.publish({
    type: "firebase.extensions.firestore-send-email.v1.onRetry",
    subject: change.after.id,
    data: { doc },
  });
};
