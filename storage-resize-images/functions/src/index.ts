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
import * as fs from "fs";

import { resizeImages } from "./resize-image";
import { config, deleteImage } from "./config";
import * as logs from "./logs";
import { shouldResize } from "./filters";
import * as events from "./events";
import { convertToObjectMetadata } from "./util";
import { checkImageContent } from "./content-filter";
import { replacePlaceholder } from "./placeholder";
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
export const generateResizedImageHandler = async (
  object: ObjectMetadata,
  verbose = true
): Promise<void> => {
  !verbose || logs.start(config);
  if (!shouldResize(object)) {
    return;
  }

  await events.recordStartResizeEvent({
    subject: object.name,
    data: { input: object },
  });

  const bucket = admin.storage().bucket(object.bucket);
  const filePath = object.name; // File path in the bucket.
  const parsedPath = path.parse(filePath);

  let localOriginalFile: string;
  let localProcessingFile: string | undefined;
  let remoteOriginalFile: File;

  try {
    [localOriginalFile, remoteOriginalFile] = await downloadOriginalFile(
      bucket,
      filePath,
      verbose
    );

    let blockedByFilter = false;
    let filterErrored = false;
    let blockedImageStored = false;

    try {
      const passed = await checkImageContent(
        localOriginalFile,
        config.contentFilterLevel,
        config.customFilterPrompt,
        object.contentType
      );
      if (!passed) {
        blockedByFilter = true;
        logs.contentFilterRejected(object.name);

        await handleFailedImage(
          bucket,
          localOriginalFile,
          object,
          parsedPath,
          true
        );
        blockedImageStored = true;

        localProcessingFile = `${localOriginalFile}-placeholder`;
        fs.copyFileSync(localOriginalFile, localProcessingFile);
        try {
          await replacePlaceholder(
            localProcessingFile,
            bucket,
            config.placeholderImagePath
          );
        } catch (err) {
          logs.placeholderReplaceError(err);
          filterErrored = true;
        }
      }
    } catch (err) {
      logs.contentFilterErrored(err);
      filterErrored = true;
    }

    const fileToResize = localProcessingFile ?? localOriginalFile;

    let resizeFailed = false;
    if (!filterErrored) {
      const resizeResults = await resizeImages(
        bucket,
        fileToResize,
        parsedPath,
        object
      );

      await events.recordSuccessEvent({
        subject: filePath,
        data: {
          input: object,
          outputs: resizeResults,
          contentFilterPassed: !blockedByFilter,
        },
      });

      resizeFailed = resizeResults.some(
        (result) =>
          result.status === "rejected" || result.value.success === false
      );
    }

    const failed = filterErrored || resizeFailed;

    if (failed) {
      logs.failed();
      if (!blockedImageStored) {
        await handleFailedImage(
          bucket,
          localOriginalFile,
          object,
          parsedPath,
          blockedByFilter
        );
      }
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

    if (localProcessingFile) {
      await deleteTempFile(localProcessingFile, filePath, verbose);
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
    await events.recordStartEvent(object);
    await generateResizedImageHandler(object);
    await events.recordCompletionEvent({ context });
  });

/**
 *
 */
// export const backfillResizedImages = functions.tasks
//   .taskQueue()
//   .onDispatch(async (data) => {
//     const runtime = getExtensions().runtime();
//     if (!config.doBackfill) {
//       await runtime.setProcessingState(
//         "PROCESSING_COMPLETE",
//         "Existing images were not resized because 'Backfill existing images' was configured to false." +
//           " If you want to resize existing images, reconfigure this instance."
//       );
//       return;
//     }
//     if (data?.nextPageQuery == undefined) {
//       logs.startBackfill();
//     }

//     const bucket = admin.storage().bucket(process.env.IMG_BUCKET);
//     const query = data.nextPageQuery || {
//       autoPaginate: false,
//       maxResults: config.backfillBatchSize,
//     };
//     const [files, nextPageQuery] = await bucket.getFiles(query);
//     const filesToResize = files.filter((f: File) => {
//       logs.continueBackfill(f.metadata.name);
//       return shouldResize(convertToObjectMetadata(f.metadata));
//     });

//     const filePromises = filesToResize.map((f) => {
//       return generateResizedImageHandler(
//         convertToObjectMetadata(f.metadata),
//         /*verbose=*/ false
//       );
//     });
//     const results = await Promise.allSettled(filePromises);

//     const pageErrorsCount = results.filter(
//       (r) => r.status === "rejected"
//     ).length;
//     const pageSuccessCount = results.filter(
//       (r) => r.status === "fulfilled"
//     ).length;
//     const oldErrorsCount = Number(data.errorsCount) || 0;
//     const oldSuccessCount = Number(data.successCount) || 0;
//     const errorsCount = pageErrorsCount + oldErrorsCount;
//     const successCount = pageSuccessCount + oldSuccessCount;

//     if (nextPageQuery) {
//       const queue = getFunctions().taskQueue(
//         `locations/${config.location}/functions/backfillResizedImages`,
//         process.env.EXT_INSTANCE_ID
//       );
//       await queue.enqueue({
//         nextPageQuery,
//         errorsCount,
//         successCount,
//       });
//     } else {
//       logs.backfillComplete(successCount, errorsCount);
//       if (errorsCount == 0) {
//         await runtime.setProcessingState(
//           "PROCESSING_COMPLETE",
//           `Successfully resized ${successCount} images.`
//         );
//       } else if (errorsCount > 0 && successCount > 0) {
//         await runtime.setProcessingState(
//           "PROCESSING_WARNING",
//           `Successfully resized ${successCount} images, failed to resize ${errorsCount} images. See function logs for error details.`
//         );
//       }
//       if (errorsCount > 0 && successCount == 0) {
//         await runtime.setProcessingState(
//           "PROCESSING_FAILED",
//           `Successfully resized ${successCount} images, failed to resize ${errorsCount} images. See function logs for error details.`
//         );
//       }
//     }
//   });
