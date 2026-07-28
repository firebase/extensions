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

import { google } from "@google-cloud/speech/build/protos/protos";
import { logger } from "firebase-functions";
import { ObjectMetadata } from "firebase-functions/v1/storage";

import config from "./config";
import { Failure, failureTypeToMessage, warningTypeToMessage } from "./types";

export const error = (err: Error) => {
  logger.error("Error when transcribing audio");
  logger.error(err);
};

export const audioAlreadyProcessed = () => {
  logger.log("Ignoring already-processed file");
};

export const init = () => {
  logger.log("Initializing extension with configuration", { config });
};

export const start = () => {
  logger.log("Started execution of extension with configuration", { config });
};

export const undefinedObjectName = (object: ObjectMetadata) => {
  logger.error("Object name was undefined for object", { object });
};

export const tempDirectoryCreated = (directory: string) => {
  logger.log(`Created temporary directory: '${directory}'`);
};

export const tempDirectoryCreating = (directory: string) => {
  logger.log(`Creating temporary directory: '${directory}'`);
};

export const noContentType = () => {
  logger.log("File has no Content-Type, no processing is required");
};

export const contentTypeInvalid = (contentType: string) => {
  logger.log(`File of type '${contentType}' is not an audio file`);
};

export const downloaded = (remotePath: string, localPath: string) => {
  logger.log(`Downloaded file: '${remotePath}' to '${localPath}'`);
};

export const downloading = (path: string) => {
  logger.log(`Downloading file: '${path}'`);
};

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

export const receivedLongRunningRecognizeResponse = (
  response: google.cloud.speech.v1.IRecognizeResponse
) => {
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

// DO NOT MERGE: debugging stuff

export const debug = (...object: any) => {
  logger.log(...object);
};
export function audioDownloading(filePath: string) {
  logger.log(`Downloading audio from '${filePath}'`);
}

export function audioDownloaded(filePath: string, localCopy: string) {
  logger.log(`Downloaded audio from '${filePath}' to '${localCopy}'`);
}

export function unexpectedZeroStreamCount() {
  logger.log("Expected the file to contain 1 stream, but it contains none");
}

export function unexpectedStreamCount(streamCount: number) {
  logger.log(
    `Expected stream count to be 1, but it's ${streamCount}. Will only use` +
      " the first stream. Multiple channels are supported, but multiple streams are not."
  );
}

export function corruptedFile() {
  logger.log("File is corrupted and cannot be transcribed");
}
