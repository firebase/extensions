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
import { getFunctions } from "firebase-admin/functions";
import { getExtensions } from "firebase-admin/extensions";
import * as fs from "fs";
import * as functions from "firebase-functions/v1";
import { mkdirp } from "mkdirp";
import * as os from "os";
import * as path from "path";
import * as sharp from "sharp";

import { ResizedImageResult, modifyImage } from "./resize-image";
import { config, deleteImage } from "./config";
import * as logs from "./logs";
import { shouldResize } from "./filters";
import * as events from "./events";
import { v4 as uuidv4 } from "uuid";
import { convertToObjectMetadata, countNegativeTraversals } from "./util";
import { File } from "@google-cloud/storage";
import { ObjectMetadata } from "firebase-functions/v1/storage";
import { upscale } from "./upscale";
import { checkImageContent } from "./content-filter";

sharp.cache(false);

// Initialize the Firebase Admin SDK
admin.initializeApp();

events.setupEventChannel();

logs.init();

/**
 * When an image is uploaded in the Storage bucket, we generate a resized image automatically using
 * the Sharp image converting library.
 */

const generateResizedImageHandler = async (
  object: ObjectMetadata,
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

  let localOriginalFile: string;
  let remoteOriginalFile: File;
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

    const filterResult = await checkImageContent(
      localOriginalFile,
      config.contentFilterLevel,
      config.customFilterPrompt
    );

    if (!filterResult) {
      functions.logger.warn(
        `Image ${filePath} was rejected by the content filter.`
      );

      // Check if a placeholder image is configured
      if (config.placeholderImagePath) {
        try {
          // Path to the placeholder image in the bucket
          const placeholderPath = config.placeholderImagePath;

          functions.logger.info(
            `Replacing filtered image with placeholder from ${placeholderPath}`
          );

          const placeholderFile = bucket.file(placeholderPath);
          const localPlaceholderFile = path.join(os.tmpdir(), uuidv4());

          await placeholderFile.download({
            destination: localPlaceholderFile,
          });

          // Replace the original local file with the placeholder
          fs.unlinkSync(localOriginalFile);
          fs.copyFileSync(localPlaceholderFile, localOriginalFile);

          // Clean up the temporary placeholder file
          fs.unlinkSync(localPlaceholderFile);

          functions.logger.info(`Successfully replaced with placeholder image`);

          // Continue with resizing using the placeholder instead
        } catch (err) {
          functions.logger.error(
            `Error replacing with placeholder image:`,
            err
          );
          // If we can't replace with placeholder, just return and stop processing
          return;
        }
      } else {
        // No placeholder configured, so stop processing this image
        return;
      }
    }

    for (let upscaleFactor of ["x2", "x4"]) {
      // returns true if upscaleFactor exists in imageSizes and was deleted.
      const shouldUpscale = imageSizes.delete(upscaleFactor);

      if (shouldUpscale) {
        console.log(`Upscaling image by ${upscaleFactor}`);
        // upscale the image and save to local file, the same way modify image does
        tasks.push(
          upscale(
            bucket,
            localOriginalFile,
            parsedPath,
            objectMetadata,
            upscaleFactor
          )
        );
      }
    }

    console.log(`Image sizes: ${imageSizes.size}`);

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

    const results = await Promise.allSettled(tasks);

    console.log(results);

    await events.recordSuccessEvent({
      subject: filePath,
      data: { input: object, outputs: results },
    });

    console.log(results);

    const failed = results.some(
      (result) => result.status == "rejected" || !result.value.success
    );

    if (failed) {
      logs.failed();

      if (config.failedImagesPath) {
        const filePath = object.name; // File path in the bucket.
        const fileDir = parsedPath.dir;
        const fileExtension = parsedPath.ext;
        const fileNameWithoutExtension = path.basename(filePath, fileExtension);

        /** Check for negetaive traversal in the configuration */
        if (countNegativeTraversals(config.failedImagesPath)) {
          logs.invalidFailedResizePath(config.failedImagesPath);
          return;
        }

        /** Find the base directory */
        const baseDir = filePath.substring(0, filePath.lastIndexOf("/") + 1);

        /** Set the failed path */
        const failedFilePath = path.join(
          fileDir,
          config.failedImagesPath,
          `${fileNameWithoutExtension}${fileExtension}`
        );

        /** Normalize for gcp storage */
        const normalizedPath = path.normalize(failedFilePath);

        /** Check if safe path */
        if (!normalizedPath.startsWith(baseDir)) {
          logs.invalidFailedResizePath(failedFilePath);
          return;
        }

        /** Checks passed, upload the failed image to the failed image directory */
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
    events.recordErrorEvent(err as Error);
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
          events.recordErrorEvent(err as Error);
        }
      }
    }
  }
};

export const generateResizedImage = functions.storage
  .object()
  .onFinalize(async (object, context) => {
    await generateResizedImageHandler(object);
    await events.recordCompletionEvent({ context });
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
    const filesToResize = files.filter((f: File) => {
      logs.continueBackfill(f.metadata.name);
      return shouldResize(convertToObjectMetadata(f.metadata));
    });

    const filePromises = filesToResize.map((f) => {
      return generateResizedImageHandler(
        convertToObjectMetadata(f.metadata),
        /*verbose=*/ false
      );
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
