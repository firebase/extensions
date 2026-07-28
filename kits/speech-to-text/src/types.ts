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
import type { UploadResponse } from "@google-cloud/storage";

/** Result of transcoding an input file into LINEAR16, success or failure. */
export type TranscodeAudioResult = TranscodeAudioSuccess | Failure;
/** Result of a Speech-to-Text transcription, success or failure. */
export type TranscribeAudioResult = TranscribeAudioSuccess | Failure;
/** Result of uploading the transcoded file to Storage, success or failure. */
export type UploadAudioResult = UploadAudioSuccess | Failure;

/** Discriminator for the success/failure result union. */
export enum Status {
  SUCCESS = 0,
  FAILURE = 1,
}

/** Successful upload of the transcoded file. */
export interface UploadAudioSuccess {
  status: Status.SUCCESS;
  uploadResponse: UploadResponse;
}

/** Successful transcode, carrying the probed audio parameters. */
export interface TranscodeAudioSuccess {
  status: Status.SUCCESS;
  sampleRateHertz: number;
  warnings: WarningType[];
  audioChannelCount: number;
  outputPath: string;
}

/** Successful transcription, keyed by channel tag. */
export interface TranscribeAudioSuccess {
  status: Status.SUCCESS;
  warnings: WarningType[];
  transcription: Record<number, string[]>;
}

/** A failure result, carrying a typed failure and optional details. */
export interface Failure {
  status: Status.FAILURE;
  warnings: WarningType[];
  type: FailureType;
  details?: any;
}

/** Enumerates the failure modes of the pipeline. */
export enum FailureType {
  UNKNOWN = 0,
  ZERO_STREAMS = 1,
  NULL_SAMPLE_RATE = 2,
  NULL_CHANNELS = 3,
  FFMPEG_FAILURE = 4,
  NULL_TRANSCRIPTION = 5,
  TRANSCRIPTION_UPLOAD_FAILED = 6,
  TRANSCODED_UPLOAD_FAILED = 7,
}

/** Human-readable message for each {@link FailureType}. */
export const failureTypeToMessage: Record<FailureType, string> = {
  [FailureType.UNKNOWN]: "An unknown error occured.",
  [FailureType.ZERO_STREAMS]: "The uploaded file had zero audio streams.",
  [FailureType.NULL_SAMPLE_RATE]: "Could not obtain the file's sample rate.",
  [FailureType.NULL_CHANNELS]: "Could not obtain the file's channels.",
  [FailureType.FFMPEG_FAILURE]: "An ffmpeg error ocurred.",
  [FailureType.NULL_TRANSCRIPTION]: "Received a null transcription from API.",
  [FailureType.TRANSCRIPTION_UPLOAD_FAILED]:
    "An error ocurred when uploading the transcription.",
  [FailureType.TRANSCODED_UPLOAD_FAILED]:
    "An error ocurred when uploading the transcoded file.",
};

/** Enumerates the non-fatal warnings the pipeline can surface. */
export enum WarningType {
  UNKNOWN = 0,
  MORE_THAN_ONE_STREAM = 1,
  EMPTY_TRANSCRIPTION = 2,
}

/** Human-readable message for each {@link WarningType}. */
export const warningTypeToMessage: Record<WarningType, string> = {
  [WarningType.UNKNOWN]: "An unknown warning occured.",
  [WarningType.MORE_THAN_ONE_STREAM]:
    "The uploaded file had more than one stream.",
  [WarningType.EMPTY_TRANSCRIPTION]:
    "The transcription is an empty string. " +
    "\nIf this is not expected, the language code may be wrong, the file may " +
    "be too noisy, or the sample rate of the original file may be too low.",
};
