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
import * as functions from "firebase-functions/v1";
import * as path from "path";
import * as sharp from "sharp";
import { File } from "@google-cloud/storage";
import { ObjectMetadata } from "firebase-functions/v1/storage";

import { resizeImages } from "./resize-image";
import { config, deleteImage } from "./config";
import * as logs from "./logs";
import { shouldResize } from "./filters";
import * as events from "./events";
import { convertToObjectMetadata } from "./util";
import { processContentFilter } from "./content-filter";
import {
  deleteRemoteFile,
  deleteTempFile,
  downloadOriginalFile,
  handleFailedImage,
} from "./file-operations";

sharp.cache(false);

// Initialize the Firebase Admin SDK
admin.initializeApp();

events.setupEventChannel();

logs.init(config);

/**
 * When an image is uploaded in the Storage bucket, we generate a resized image automatically using
 * the Sharp image converting library.
 */
const generateResizedImageHandler = async (
  object: ObjectMetadata,
  verbose = true
): Promise<void> => {
  !verbose || logs.start(config);
  if (!shouldResize(object)) {
    return;
  }

  const bucket = admin.storage().bucket(object.bucket);
  const filePath = object.name; // File path in the bucket.
  const parsedPath = path.parse(filePath);
  const objectMetadata = object;
  let failed = null;
  let localOriginalFile: string;
  let remoteOriginalFile: File;

  try {
    [localOriginalFile, remoteOriginalFile] = await downloadOriginalFile(
      bucket,
      filePath,
      verbose
    );

    // Check content filter and replace with placeholder if needed
    const filterResult = await processContentFilter(
      localOriginalFile,
      object,
      bucket,
      verbose,
      config
    );

    // Process image resizing if content filter didn't fail
    if (filterResult.failed !== true) {
      const resizeResults = await resizeImages(
        bucket,
        localOriginalFile,
        parsedPath,
        objectMetadata
      );

      await events.recordSuccessEvent({
        subject: filePath,
        data: {
          input: object,
          outputs: resizeResults,
          contentFilterPassed: filterResult.passed,
        },
      });

      // Only update failed status if it's still null (not already failed from content filter)
      failed =
        filterResult.failed === null
          ? resizeResults.some(
              (result) =>
                result.status === "rejected" || result.value.success === false
            )
          : filterResult.failed;
    } else {
      failed = true;
    }

    if (failed) {
      logs.failed();
      await handleFailedImage(
        bucket,
        localOriginalFile,
        object,
        parsedPath,
        filterResult.passed === false
      );
    } else {
      if (config.deleteOriginalFile === deleteImage.onSuccess) {
        await deleteRemoteFile(remoteOriginalFile, filePath);
      }
      !verbose || logs.complete();
    }
  } catch (err) {
    logs.error(err);
    events.recordErrorEvent(err as Error);
  } finally {
    // Clean up temporary files
    if (localOriginalFile) {
      await deleteTempFile(localOriginalFile, filePath, verbose);
    }

    if (
      config.deleteOriginalFile === deleteImage.always &&
      remoteOriginalFile
    ) {
      await deleteRemoteFile(remoteOriginalFile, filePath);
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
      maxResults: config.backfillBatchSize,
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
