/*
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

import type { Failure, TranscribeAudioSuccess } from "./types";

const { getEventarc } = eventArc;

const COMPLETE_EVENT_TYPE =
  "firebase.extensions.storage-transcribe-audio.v1.complete";
const FAIL_EVENT_TYPE = "firebase.extensions.storage-transcribe-audio.v1.fail";

let eventChannel: eventArc.Channel | undefined;

/**
 * Sets up the Eventarc channel.
 *
 * Reads the channel name from `EVENTARC_CHANNEL` and the allowed event types
 * from `EXT_SELECTED_EVENTS`. When `EVENTARC_CHANNEL` is unset, event publishing
 * becomes a no-op.
 */
export const setupEventChannel = () => {
  eventChannel = process.env.EVENTARC_CHANNEL
    ? getEventarc().channel(process.env.EVENTARC_CHANNEL, {
        allowedEventTypes: process.env.EXT_SELECTED_EVENTS,
      })
    : undefined;
};

/**
 * Publishes the `complete` event for a successful transcription.
 *
 * @param contents - The successful transcription result.
 * @param objectName - The Storage object name that was transcribed.
 */
export const recordCompleteEvent = async (
  contents: TranscribeAudioSuccess,
  objectName: string
): Promise<void> => {
  if (!eventChannel) return;
  await eventChannel.publish({
    type: COMPLETE_EVENT_TYPE,
    data: {
      ...contents,
      objectName,
    },
  });
};

/**
 * Publishes the `fail` event for a typed pipeline failure.
 *
 * @param contents - The failure result.
 * @param objectName - The Storage object name being processed.
 */
export const recordFailureEvent = async (
  contents: Failure,
  objectName: string
): Promise<void> => {
  if (!eventChannel) return;
  await eventChannel.publish({
    type: FAIL_EVENT_TYPE,
    data: {
      ...contents,
      objectName,
    },
  });
};

/**
 * Publishes the `fail` event for an unexpected error thrown by the pipeline.
 *
 * The error is published as-is to keep the payload identical to the extension's.
 * An `Error`'s `message` and `stack` are not enumerable, so a genuine `Error`
 * serialises to `{"error":{}}`, while the plain object `errorFromAny` builds for
 * a thrown non-error keeps its `name` and `message`. Anything richer would be a
 * payload change for existing subscribers.
 *
 * @param error - The error that aborted processing.
 */
export const recordErrorEvent = async (error: Error): Promise<void> => {
  if (!eventChannel) return;
  await eventChannel.publish({
    type: FAIL_EVENT_TYPE,
    data: {
      error,
    },
  });
};
