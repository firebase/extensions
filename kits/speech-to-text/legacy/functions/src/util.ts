/*
 * Copyright 2023 Google LLC
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
import * as util from "util";
import * as ffmpeg from "fluent-ffmpeg";
import { Failure, TranscribeAudioSuccess } from "./types";
import { Channel } from "firebase-admin/eventarc";
import { google } from "@google-cloud/speech/build/protos/protos";

export function errorFromAny(anyErr: any): Error {
  let error: Error;
  if (!(anyErr instanceof Error)) {
    error = {
      name: "Thrown non-error object",
      message: String(anyErr),
    };
  } else {
    error = anyErr;
  }

  return error;
}

export function isNullFreeList<T>(
  list: (NonNullable<T> | null | undefined)[]
): list is NonNullable<T>[] {
  return list.every((item) => item !== null);
}

export function getTranscriptionsByChannel(
  results: google.cloud.speech.v1.ISpeechRecognitionResult[]
): Record<number, string[]> | null {
  const taggedTranscription: ([number, string] | null)[] = results.map(
    getTaggedTranscriptionOrNull
  );
  if (!isNullFreeList(taggedTranscription)) {
    return null;
  }

  return separateByTags(taggedTranscription);
}

function getTaggedTranscriptionOrNull(
  result: google.cloud.speech.v1.ISpeechRecognitionResult
): [number, string] | null {
  const channelTag = result?.channelTag;

  // The API supports requests for multiple alternative transcriptions, so it
  // gives an array of transcription alternatives.
  //
  // Since we're not using that feature, our transcript will be in the first alternative.
  const transcript = result?.alternatives?.[0].transcript;
  if (channelTag == null || transcript == null) {
    return null;
  }

  return [channelTag, transcript];
}

function separateByTags(
  taggedStringList: [number, string][]
): Record<number, string[]> {
  return taggedStringList.reduce(
    (acc: Record<number, string[]>, [tag, string]) => {
      if (tag in acc) {
        acc[tag].push(string);
      } else {
        acc[tag] = [string];
      }
      return acc;
    },
    {}
  );
}

export const probePromise = util.promisify<string, ffmpeg.FfprobeData>(
  ffmpeg.ffprobe
);

export async function publishFailureEvent(
  eventChannel: Channel,
  { ...contents }: Failure,
  objectName: string
): Promise<void> {
  return eventChannel.publish({
    type: "firebase.extensions.storage-transcribe-audio.v1.fail",
    data: {
      ...contents,
      objectName,
    },
  });
}

export async function publishCompleteEvent(
  eventChannel: Channel,
  { ...contents }: TranscribeAudioSuccess,
  objectName: string
): Promise<void> {
  return eventChannel.publish({
    type: "firebase.extensions.storage-transcribe-audio.v1.complete",
    data: {
      ...contents,
      objectName,
    },
  });
}
