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
import type { SpeechClient } from "@google-cloud/speech";
import type { google } from "@google-cloud/speech/build/protos/protos";
import type { Bucket } from "@google-cloud/storage";
import ffmpeg from "fluent-ffmpeg";

import * as logs from "./logs";
import {
  FailureType,
  Status,
  type TranscodeAudioResult,
  type TranscribeAudioResult,
  type UploadAudioResult,
  type WarningType,
  WarningType as WarningTypeEnum,
} from "./types";
import { getTranscriptionsByChannel, probePromise } from "./util";

const encoding = "LINEAR16";
const TRANSCODE_TARGET_FILE_EXTENSION = ".wav";

/** Speech-recognition options passed through from the resolved config. */
export interface SpeechOptions {
  languageCode: string;
  model: string;
  enableAutomaticPunctuation: boolean;
}

/**
 * Runs a long-running Speech-to-Text recognition over an uploaded audio file
 * and collapses the response into a per-channel transcript map.
 *
 * The operation is polled to completion in-process, so the host function must
 * allow a long timeout for lengthy audio.
 *
 * @param args - The Speech client, the uploaded file, probed audio params and
 *   recognition options.
 * @returns The transcription result, success or failure.
 */
export async function transcribeAndUpload({
  client,
  file: { bucket, name },
  sampleRateHertz,
  audioChannelCount,
  options,
}: {
  client: SpeechClient;
  file: { bucket: Bucket; name: string };
  sampleRateHertz: number;
  audioChannelCount: number;
  options: SpeechOptions;
}): Promise<TranscribeAudioResult> {
  const inputUri = `gs://${bucket.name}/${name}`;
  const outputUri = `gs://${bucket.name}/${name.replace(
    "tmp/",
    ""
  )}_transcription.txt`;
  const warnings: WarningType[] = [];
  const request: google.cloud.speech.v1.ILongRunningRecognizeRequest = {
    config: {
      encoding,
      enableAutomaticPunctuation: options.enableAutomaticPunctuation,
      sampleRateHertz,
      languageCode: options.languageCode,
      model: options.model,
      audioChannelCount,
    },

    audio: {
      uri: inputUri,
    },

    outputConfig: {
      gcsUri: outputUri,
    },
  };

  const response = await transcribe(client, request);

  if (response.outputError) {
    return {
      status: Status.FAILURE,
      warnings,
      type: FailureType.TRANSCRIPTION_UPLOAD_FAILED,
      details: {
        outputUri: response.outputConfig?.gcsUri,
        outputError: response.outputError,
      },
    };
  }

  logs.receivedLongRunningRecognizeResponse(response);
  if (response.results == null) {
    return {
      status: Status.FAILURE,
      warnings,
      type: FailureType.NULL_TRANSCRIPTION,
    };
  }

  const transcription: Record<number, string[]> | null =
    getTranscriptionsByChannel(response.results);

  if (transcription == null) {
    return {
      status: Status.FAILURE,
      warnings,
      type: FailureType.NULL_TRANSCRIPTION,
    };
  }

  logs.logResponseTranscription(transcription);
  return {
    status: Status.SUCCESS,
    warnings,
    transcription,
  };
}

/**
 * Transcodes an input file to a single-stream LINEAR16 `.wav` and reports the
 * sample rate and channel count needed by the recognizer.
 *
 * @param localTmpPath - The local path to the downloaded source audio.
 * @returns The transcode result, success or failure.
 */
export async function transcodeToLinear16(
  localTmpPath: string
): Promise<TranscodeAudioResult> {
  const probeData: ffmpeg.FfprobeData = await probePromise(localTmpPath);
  const warnings: WarningType[] = [];

  logs.debug("probe data before transcription:", probeData);
  const { streams } = probeData;

  if (streams.length === 0) {
    return {
      status: Status.FAILURE,
      type: FailureType.ZERO_STREAMS,
      warnings,
    };
  }

  if (streams.length !== 1) {
    warnings.push(WarningTypeEnum.MORE_THAN_ONE_STREAM);
  }

  if (streams[0].sample_rate == null) {
    return {
      status: Status.FAILURE,
      type: FailureType.NULL_SAMPLE_RATE,
      warnings,
    };
  }

  if (streams[0].channels == null) {
    return {
      status: Status.FAILURE,
      type: FailureType.NULL_CHANNELS,
      warnings,
    };
  }

  const localTranscodedPath = localTmpPath + TRANSCODE_TARGET_FILE_EXTENSION;
  logs.debug("transcoding locally");
  try {
    await transcodeLocally({
      inputPath: localTmpPath,
      outputPath: localTranscodedPath,
    });
  } catch (error: unknown) {
    const { err, stdout, stderr } = error as {
      err: any;
      stdout: string;
      stderr: string;
    };
    return {
      status: Status.FAILURE,
      type: FailureType.FFMPEG_FAILURE,
      warnings,
      details: {
        ffmpegError: err,
        ffmpegStdout: stdout,
        ffmpegStderr: stderr,
      },
    };
  }
  logs.debug("finished transcoding locally");

  return {
    status: Status.SUCCESS,
    sampleRateHertz: Number(streams[0].sample_rate),
    audioChannelCount: streams[0].channels,
    outputPath: localTranscodedPath,
    warnings,
  };
}

/**
 * Uploads a transcoded file to Storage, tagging it so the trigger ignores it on
 * re-finalize.
 *
 * @param args - The local path, destination storage path and target bucket.
 * @returns The upload result, success or failure.
 */
export async function uploadTranscodedFile({
  localPath,
  storagePath,
  bucket,
}: {
  localPath: string;
  storagePath: string;
  bucket: Bucket;
}): Promise<UploadAudioResult> {
  try {
    const uploadResponse = await bucket.upload(localPath, {
      destination: storagePath,
      metadata: { metadata: { isTranscodeOutput: true } },
    });

    return {
      status: Status.SUCCESS,
      uploadResponse,
    };
  } catch (err: unknown) {
    return {
      status: Status.FAILURE,
      warnings: [],
      type: FailureType.TRANSCODED_UPLOAD_FAILED,
      details: err,
    };
  }
}

function transcodeLocally({
  inputPath,
  outputPath,
}: {
  inputPath: string;
  outputPath: string;
}): Promise<string> {
  // Save input to output path, converting it to the format of outputPath.
  return new Promise((resolve, reject) => {
    ffmpeg({ source: inputPath })
      .save(outputPath)
      .on("error", (err, stdout, stderr) => {
        reject({ err, stdout, stderr });
      })
      .on("end", (stdout, stderr) => {
        if (stdout) logs.ffmpegStdout(stdout);
        if (stderr) logs.ffmpegStderr(stderr);
        resolve(outputPath);
      });
  });
}

async function transcribe(
  client: SpeechClient,
  request: google.cloud.speech.v1.ILongRunningRecognizeRequest
): Promise<google.cloud.speech.v1.ILongRunningRecognizeResponse> {
  const [operation] = await client.longRunningRecognize(request);

  const [response] = await operation.promise();
  return response;
}
