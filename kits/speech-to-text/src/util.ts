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
import { promisify } from "node:util";
import type { google } from "@google-cloud/speech/build/protos/protos";
import ffmpeg from "fluent-ffmpeg";

/** Normalizes any thrown value into an `Error`. */
export function errorFromAny(anyErr: any): Error {
  if (!(anyErr instanceof Error)) {
    return {
      name: "Thrown non-error object",
      message: String(anyErr),
    } as Error;
  }
  return anyErr;
}

/** Type guard asserting a list contains no null/undefined entries. */
export function isNullFreeList<T>(
  list: (NonNullable<T> | null | undefined)[]
): list is NonNullable<T>[] {
  return list.every((item) => item != null);
}

/**
 * Collapses Speech-to-Text results into a per-channel map of transcripts.
 *
 * @param results - The recognition results returned by the Speech API.
 * @returns A map from channel tag to its transcripts, or `null` if any result
 *   lacked a channel tag or transcript.
 */
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
  // Since we're not using that feature, our transcript will be in the first
  // alternative.
  const transcript = result?.alternatives?.[0]?.transcript;
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

/** Promisified `ffmpeg.ffprobe`, used to read stream metadata. */
export const probePromise = promisify<string, ffmpeg.FfprobeData>(
  ffmpeg.ffprobe
);
