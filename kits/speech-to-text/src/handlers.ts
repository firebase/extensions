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
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { SpeechClient } from "@google-cloud/speech";
import type { Bucket } from "@google-cloud/storage";
import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import type { StorageEvent } from "firebase-functions/storage";
import { mkdirp } from "mkdirp";

import type * as events from "./events";
import type { ResolvedSpeechToTextConfig } from "./export-config";
import { getFirestoreDocument, updateFirestoreDocument } from "./firestore";
import * as logs from "./logs";
import type { SpeechOptions, transcribeFns } from "./transcribe-fns";
import { Status, type TranscribeAudioResult } from "./types";
import { errorFromAny } from "./util";

/**
 * Everything a handler needs to do its work, supplied by the entrypoint so the
 * handler stays free of global state and remains unit-testable.
 */
export interface HandlerContext {
  /** Resolved configuration. */
  config: ResolvedSpeechToTextConfig;
  /** The Firestore instance used for transcript documents. */
  db: Firestore;
  /** The Speech-to-Text client. */
  client: SpeechClient;
  /** Resolves a Storage bucket by name. */
  getBucket: (name: string) => Bucket;
  /** Transcode/upload/transcribe implementations (injected for testability). */
  fns: typeof transcribeFns;
  /** Eventarc publishers (injected for testability). */
  events: typeof events;
}

/**
 * Handles a finalized Storage object: filters non-audio objects, transcodes,
 * uploads the transcoded file, runs long-running recognition, persists the
 * transcript and emits `complete`/`fail` Eventarc events.
 *
 * Mirrors the v1 `transcribeAudio` onFinalize behaviour 1:1.
 *
 * @param event - The v2 `onObjectFinalized` event.
 * @param ctx - The injected handler context.
 */
export async function handleObjectFinalized(
  event: StorageEvent,
  ctx: HandlerContext
): Promise<void> {
  const { config, db, client, getBucket } = ctx;
  const object = event.data;

  logs.start(config);
  const { contentType } = object;

  /** Return early if no file name is specified */
  if (object.name === undefined) {
    logs.undefinedObjectName(object);
    return;
  }

  /** Ignore files this extension produced */
  if (object.metadata && object.metadata.isTranscodeOutput === "true") {
    logs.audioAlreadyProcessed();
    return;
  }

  /** Create a new document and extract the document ID */
  const docId = await getFirestoreDocument(
    db,
    config.collectionPath,
    object.name
  );

  if (!contentType) {
    await updateFirestoreDocument(db, config.collectionPath, docId, {
      status: "FAILED",
      message: "No content type provided.",
    });

    logs.noContentType();
    return;
  }

  if (!contentType.startsWith("audio/")) {
    await updateFirestoreDocument(db, config.collectionPath, docId, {
      status: "FAILED",
      message: "Invalid content type.",
    });

    logs.contentTypeInvalid(contentType);
    return;
  }

  const bucket = getBucket(object.bucket);
  const filePath = object.name;

  const speechOptions: SpeechOptions = {
    languageCode: config.languageCode,
    model: config.model,
    enableAutomaticPunctuation: config.enableAutomaticPunctuation,
  };

  const localCopyPath: string = path.join(os.tmpdir(), filePath);
  const localTranscodedPath = `${localCopyPath}.wav`;

  try {
    const tempLocalDir = path.dirname(localCopyPath);

    logs.tempDirectoryCreating(tempLocalDir);
    await mkdirp(tempLocalDir);
    logs.tempDirectoryCreated(tempLocalDir);

    const remoteFile = bucket.file(filePath);
    logs.audioDownloading(filePath);
    await remoteFile.download({ destination: localCopyPath });
    logs.audioDownloaded(filePath, localCopyPath);

    const transcodeResult = await ctx.fns.transcodeToLinear16(localCopyPath);

    if (transcodeResult.status === Status.FAILURE) {
      logs.transcodingFailed(transcodeResult);
      await ctx.events.recordFailureEvent(transcodeResult, object.name);
      return;
    }

    logs.debug("uploading transcoded file");

    await updateFirestoreDocument(db, config.collectionPath, docId, {
      status: "PROCESSING",
      message: "Transcoding audio file.",
    });

    /**
     * Bucket-relative object name for the transcoded file, derived from the
     * input object's path/name (not the local `/tmp` path).
     */
    const transcodedObjectName = `${filePath}.wav`;
    const transcodedUploadResult = await ctx.fns.uploadTranscodedFile({
      localPath: localTranscodedPath,
      storagePath: config.outputStoragePath
        ? `${config.outputStoragePath.replace(
            /\/$/,
            ""
          )}/${transcodedObjectName}`
        : transcodedObjectName,
      bucket,
    });

    if (transcodedUploadResult.status === Status.FAILURE) {
      logs.transcodeUploadFailed(transcodedUploadResult);
      await ctx.events.recordFailureEvent(transcodedUploadResult, object.name);
      return;
    }
    logs.debug("uploaded transcoded file");

    const { sampleRateHertz, audioChannelCount } = transcodeResult;
    const [file] = transcodedUploadResult.uploadResponse;

    const transcriptionResult = await ctx.fns.transcribeAndUpload({
      client,
      file,
      sampleRateHertz,
      audioChannelCount,
      options: speechOptions,
    });

    /** Update the collection with the transcribed audio */
    await updateFirestoreDocument(db, config.collectionPath, docId, {
      ...(transcriptionResult as TranscribeAudioResult),
      message: FieldValue.delete(),
      status: Status[transcriptionResult.status],
    });

    if (transcriptionResult.status === Status.FAILURE) {
      logs.transcribingFailed(transcriptionResult);
      await ctx.events.recordFailureEvent(transcriptionResult, object.name);
      return;
    }

    await ctx.events.recordCompleteEvent(transcriptionResult, object.name);
  } catch (err) {
    const error = errorFromAny(err);
    logs.error(error);
    await ctx.events.recordErrorEvent(error);
  } finally {
    /**
     * `/tmp` is tmpfs shared across warm invocations, so the downloaded and
     * transcoded temp files must be removed to avoid filling the disk
     * (ENOSPC/OOM). Tolerant of files that were never created.
     */
    await fs.unlink(localCopyPath).catch(() => undefined);
    await fs.unlink(localTranscodedPath).catch(() => undefined);
  }
}
