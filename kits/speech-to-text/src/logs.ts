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
import { logger } from "firebase-functions";

import {
  type Failure,
  failureTypeToMessage,
  warningTypeToMessage,
} from "./types";

export const error = (err: Error) => {
  logger.error("Error when transcribing audio");
  logger.error(err);
};

export const audioAlreadyProcessed = () => {
  logger.log("Ignoring already-processed file");
};

export const init = (config: unknown) => {
  logger.log("Initializing extension with configuration", { config });
};

export const start = (config: unknown) => {
  logger.log("Started execution of extension with configuration", { config });
};

export const undefinedObjectName = (object: unknown) => {
  logger.error("Object name was undefined for object", { object });
};

export const noContentType = () => {
  logger.log("File has no Content-Type, no processing is required");
};

export const contentTypeInvalid = (contentType: string) => {
  logger.log(`File of type '${contentType}' is not an audio file`);
};

export const tempDirectoryCreating = (directory: string) => {
  logger.log(`Creating temporary directory: '${directory}'`);
};

export const tempDirectoryCreated = (directory: string) => {
  logger.log(`Created temporary directory: '${directory}'`);
};

export function audioDownloading(filePath: string) {
  logger.log(`Downloading audio from '${filePath}'`);
}

export function audioDownloaded(filePath: string, localCopy: string) {
  logger.log(`Downloaded audio from '${filePath}' to '${localCopy}'`);
}

function messageify({ details, warnings, type }: Failure) {
  return {
    failureType: failureTypeToMessage[type],
    warnings: warnings.map((warning) => warningTypeToMessage[warning]),
    details,
  };
}

export function transcodingFailed(failure: Failure) {
  logger.error("Failed to transcode audio into linear16", {
    info: messageify(failure),
  });
}

export function transcodeUploadFailed(failure: Failure) {
  logger.error("Failed to upload transcoded audio", {
    info: messageify(failure),
  });
}

export function transcribingFailed(failure: Failure) {
  logger.error("Failed to transcribe audio", { info: messageify(failure) });
}

export const receivedLongRunningRecognizeResponse = (response: unknown) => {
  logger.log("Received response for sound file transcription:", response);
};

export const logResponseTranscription = (
  transcription: Record<number, string[]>
) => {
  logger.log("Response transcription is the following:", transcription);
};

export const ffmpegStderr = (stderr: string) => {
  logger.warn("stderr output of audio transcoder:", stderr);
};

export const ffmpegStdout = (stdout: string) => {
  logger.log("stdout output of audio transcoder:", stdout);
};

export const debug = (...object: any[]) => {
  logger.log(...object);
};
