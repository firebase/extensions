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

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { getEventarc, Channel } from "firebase-admin/eventarc";
import * as speech from "@google-cloud/speech";
import * as path from "path";
import * as os from "os";
import * as mkdirp from "mkdirp";
import { FieldValue } from "firebase-admin/firestore";

import * as logs from "./logs";
import {
  publishFailureEvent,
  errorFromAny,
  publishCompleteEvent,
} from "./util";
import {
  transcodeToLinear16,
  transcribeAndUpload,
  uploadTranscodedFile,
} from "./transcribe-audio";

import { Status, TranscribeAudioResult } from "./types";
import config from "./config";
import { getFirestoreDocument, updateFirestoreDocument } from "./firestore";

admin.initializeApp();

const eventChannel: Channel | null = process.env.EVENTARC_CHANNEL
  ? getEventarc().channel(process.env.EVENTARC_CHANNEL, {
      allowedEventTypes: process.env.EXT_SELECTED_EVENTS,
    })
  : null;

logs.init();

const client = new speech.SpeechClient();

// TODO(reao): Write to firestore if that setting is enabled
// TODO(reao): Don't write to storage if that setting is not enabled
export const transcribeAudio = functions.storage
  .object()
  .onFinalize(async (object): Promise<void> => {
    logs.start();
    const { contentType } = object; // the MIME type

    /** Return early if no file name is specified */
    if (object.name === undefined) {
      logs.undefinedObjectName(object);
      return;
    }

    /** Start tracking progress in Firestore, if configured */
    if (object.metadata && object.metadata.isTranscodeOutput === "true") {
      logs.audioAlreadyProcessed();
      return;
    }

    /** Create a new document and extract the document ID */
    const docId = await getFirestoreDocument(object.name);

    if (!contentType) {
      /** Start tracking progress in Firestore, if configured */
      await updateFirestoreDocument(docId, {
        status: "FAILED",
        message: "No content type provided.",
      });

      logs.noContentType();
      return;
    }

    if (!contentType.startsWith("audio/")) {
      /** Updated failed status Firestore, if configured */
      await updateFirestoreDocument(docId!, {
        status: "FAILED",
        message: "Invalid content type.",
      });

      logs.contentTypeInvalid(contentType);
      return;
    }

    const bucket = admin.storage().bucket(object.bucket);
    const filePath = object.name;

    try {
      const localCopyPath: string = path.join(os.tmpdir(), filePath);
      const tempLocalDir = path.dirname(localCopyPath);

      logs.tempDirectoryCreating(tempLocalDir);
      await mkdirp(tempLocalDir);
      logs.tempDirectoryCreated(tempLocalDir);

      const remoteFile = bucket.file(filePath);
      logs.audioDownloading(filePath);
      await remoteFile.download({ destination: localCopyPath });
      logs.audioDownloaded(filePath, localCopyPath);

      const transcodeResult = await transcodeToLinear16(localCopyPath);

      if (transcodeResult.status == Status.FAILURE) {
        logs.transcodingFailed(transcodeResult);
        if (eventChannel) {
          await publishFailureEvent(eventChannel, transcodeResult, object.name);
        }
        return;
      }

      logs.debug("uploading transcoded file");

      /** Update processing status */
      await updateFirestoreDocument(docId, {
        status: "PROCESSING",
        message: "Transcoding audio file.",
      });

      const transcodedUploadResult = await uploadTranscodedFile({
        localPath: transcodeResult.outputPath,
        storagePath: config.outputStoragePath
          ? `${config.outputStoragePath}${transcodeResult.outputPath}`
          : transcodeResult.outputPath.slice(1),
        bucket: bucket,
      });

      if (transcodedUploadResult.status == Status.FAILURE) {
        logs.transcodeUploadFailed(transcodedUploadResult);
        if (eventChannel) {
          await publishFailureEvent(
            eventChannel,
            transcodedUploadResult,
            object.name
          );
        }
        return;
      }
      logs.debug("uploaded transcoded file");

      const { sampleRateHertz, audioChannelCount } = transcodeResult;
      const [file /*, metadata */] = transcodedUploadResult.uploadResponse;

      const transcriptionResult = await transcribeAndUpload({
        client,
        file,
        sampleRateHertz,
        audioChannelCount,
      });

      /** Update the collecton with the transcribed audio  */
      await updateFirestoreDocument(docId, {
        ...(transcriptionResult as TranscribeAudioResult),
        message: FieldValue.delete(),
        status: Status[transcriptionResult.status],
      });

      if (transcriptionResult.status == Status.FAILURE) {
        logs.transcribingFailed(transcriptionResult);
        if (eventChannel) {
          await publishFailureEvent(
            eventChannel,
            transcriptionResult,
            object.name
          );
        }
        return;
      }

      if (eventChannel) {
        await publishCompleteEvent(
          eventChannel,
          transcriptionResult,
          object.name
        );
      }
      return;
    } catch (err) {
      const error = errorFromAny(err);
      logs.error(error);

      if (eventChannel) {
        await eventChannel.publish({
          type: "firebase.extensions.storage-transcribe-audio.v1.fail",
          data: {
            error,
          },
        });
      }
    }
  });
