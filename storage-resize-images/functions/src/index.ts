/*
 * Copyright 2019 Google LLC
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

import * as admin from "firebase-admin";
import { getEventarc } from "firebase-admin/eventarc";
import { getFunctions } from "firebase-admin/functions";
import { getExtensions } from "firebase-admin/extensions";
import * as fs from "fs";
import * as functions from "firebase-functions";
import * as mkdirp from "mkdirp";
import * as os from "os";
import * as path from "path";
import * as sharp from "sharp";

import { ResizedImageResult, modifyImage } from "./resize-image";
import config, { deleteImage } from "./config";
import * as logs from "./logs";
import { shouldResize } from "./filters";
import { v4 as uuidv4 } from "uuid";

sharp.cache(false);

// Initialize the Firebase Admin SDK
admin.initializeApp();

const eventChannel =
  process.env.EVENTARC_CHANNEL &&
  getEventarc().channel(process.env.EVENTARC_CHANNEL, {
    allowedEventTypes: process.env.EXT_SELECTED_EVENTS,
  });

logs.init();

/**
 * When an image is uploaded in the Storage bucket, we generate a resized image automatically using
 * the Sharp image converting library.
 */

const generateResizedImageHandler = async (
  object,
  verbose = true
): Promise<void> => {
  !verbose || logs.start();
  if (!shouldResize(object)) {
    return;
  }

  const bucket = admin.storage().bucket(object.bucket);
  const filePath = object.name; // File path in the bucket.
  const parsedPath = path.parse(filePath);
  const objectMetadata = object;

  let localOriginalFile;
  let remoteOriginalFile;
  try {
    localOriginalFile = path.join(os.tmpdir(), uuidv4());
    const tempLocalDir = path.dirname(localOriginalFile);

    // Create the temp directory where the storage file will be downloaded.
    !verbose || logs.tempDirectoryCreating(tempLocalDir);
    await mkdirp(tempLocalDir);
    !verbose || logs.tempDirectoryCreated(tempLocalDir);

    // Download file from bucket.
    remoteOriginalFile = bucket.file(filePath);
    !verbose || logs.imageDownloading(filePath);
    await remoteOriginalFile.download({ destination: localOriginalFile });
    !verbose || logs.imageDownloaded(filePath, localOriginalFile);

    // Get a unique list of image types
    const imageTypes = new Set(config.imageTypes);

    // Convert to a set to remove any duplicate sizes
    const imageSizes = new Set(config.imageSizes);

    const tasks: Promise<ResizedImageResult>[] = [];

    imageTypes.forEach((format) => {
      imageSizes.forEach((size) => {
        tasks.push(
          modifyImage({
            bucket,
            originalFile: localOriginalFile,
            parsedPath,
            contentType: object.contentType,
            size,
            objectMetadata: objectMetadata,
            format,
          })
        );
      });
    });

    const results = await Promise.all(tasks);

    eventChannel &&
      (await eventChannel.publish({
        type: "firebase.extensions.storage-resize-images.v1.complete",
        subject: filePath,
        data: {
          input: object,
          outputs: results,
        },
      }));

    const failed = results.some((result) => result.success === false);
    if (failed) {
      logs.failed();

      if (config.failedImagesPath) {
        const filePath = object.name; // File path in the bucket.
        const fileDir = parsedPath.dir;
        const fileExtension = parsedPath.ext;
        const fileNameWithoutExtension = path.basename(filePath, fileExtension);

        const failedFilePath = path.join(
          fileDir,
          config.failedImagesPath,
          `${fileNameWithoutExtension}${fileExtension}`
        );

        logs.failedImageUploading(failedFilePath);
        await bucket.upload(localOriginalFile, {
          destination: failedFilePath,
          metadata: { metadata: { resizeFailed: "true" } },
        });
        logs.failedImageUploaded(failedFilePath);
      }

      return;
    } else {
      if (config.deleteOriginalFile === deleteImage.onSuccess) {
        if (remoteOriginalFile) {
          try {
            logs.remoteFileDeleting(filePath);
            await remoteOriginalFile.delete();
            logs.remoteFileDeleted(filePath);
          } catch (err) {
            logs.errorDeleting(err);
          }
        }
      }
      !verbose || logs.complete();
    }
  } catch (err) {
    logs.error(err);
  } finally {
    if (localOriginalFile) {
      !verbose || logs.tempOriginalFileDeleting(filePath);
      try {
        fs.unlinkSync(localOriginalFile);
      } catch (err) {
        logs.errorDeleting(err);
      }
      !verbose || logs.tempOriginalFileDeleted(filePath);
    }
    if (config.deleteOriginalFile === deleteImage.always) {
      // Delete the original file
      if (remoteOriginalFile) {
        try {
          logs.remoteFileDeleting(filePath);
          await remoteOriginalFile.delete();
          logs.remoteFileDeleted(filePath);
        } catch (err) {
          logs.errorDeleting(err);
        }
      }
    }
  }
};

export const generateResizedImage = functions.storage
  .object()
  .onFinalize(async (object) => {
    await generateResizedImageHandler(object);
  });

/**
 *
 */
export const backfillResizedImages = functions.tasks
  .taskQueue()
  .onDispatch(async (data) => {
    const runtime = getExtensions().runtime();
    if (!config.doBackfill) {
      await runtime.setProcessingState(
        "PROCESSING_COMPLETE",
        "Existing images were not resized because 'Backfill existing images' was configured to false." +
          " If you want to resize existing images, reconfigure this instance."
      );
      return;
    }
    if (data?.nextPageQuery == undefined) {
      logs.startBackfill();
    }
    const bucket = admin.storage().bucket(process.env.IMG_BUCKET);
    const query = data.nextPageQuery || {
      autoPaginate: false,
      maxResults: 3, // We only grab 3 images at a time to minimize the chance of OOM errors.
    };
    const [files, nextPageQuery] = await bucket.getFiles(query);
    const filesToResize = files.filter((f) => {
      logs.continueBackfill(f.metadata.name);
      return shouldResize(f.metadata);
    });
    const filePromises = filesToResize.map((f) => {
      return generateResizedImageHandler(f.metadata, /*verbose=*/ false);
    });
    const results = await Promise.allSettled(filePromises);

    const pageErrorsCount = results.filter(
      (r) => r.status === "rejected"
    ).length;
    const pageSuccessCount = results.filter(
      (r) => r.status === "fulfilled"
    ).length;
    const oldErrorsCount = Number(data.errorsCount) || 0;
    const oldSuccessCount = Number(data.successCount) || 0;
    const errorsCount = pageErrorsCount + oldErrorsCount;
    const successCount = pageSuccessCount + oldSuccessCount;

    if (nextPageQuery) {
      const queue = getFunctions().taskQueue(
        `locations/${config.location}/functions/backfillResizedImages`,
        process.env.EXT_INSTANCE_ID
      );
      await queue.enqueue({
        nextPageQuery,
        errorsCount,
        successCount,
      });
    } else {
      logs.backfillComplete(successCount, errorsCount);
      if (errorsCount == 0) {
        await runtime.setProcessingState(
          "PROCESSING_COMPLETE",
          `Successfully resized ${successCount} images.`
        );
      } else if (errorsCount > 0 && successCount > 0) {
        await runtime.setProcessingState(
          "PROCESSING_WARNING",
          `Successfully resized ${successCount} images, failed to resize ${errorsCount} images. See function logs for error details.`
        );
      }
      if (errorsCount > 0 && successCount == 0) {
        await runtime.setProcessingState(
          "PROCESSING_FAILED",
          `Successfully resized ${successCount} images, failed to resize ${errorsCount} images. See function logs for error details.`
        );
      }
    }
  });
