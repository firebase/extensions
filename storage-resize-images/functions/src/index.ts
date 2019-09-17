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

import { Bucket } from "@google-cloud/storage";
import * as admin from "firebase-admin";
import * as fs from "fs";
import * as functions from "firebase-functions";
import * as mkdirp from "mkdirp-promise";
import { spawn } from "child-process-promise";
import * as os from "os";
import * as path from "path";

import config from "./config";
import * as logs from "./logs";
import * as validators from "./validators";

interface ResizedImageResult {
  size: string;
  success: boolean;
}

// Initialize the Firebase Admin SDK
admin.initializeApp();

logs.init();

/**
 * When an image is uploaded in the Storage bucket We generate a resized image automatically using
 * ImageMagick which is installed by default on all Cloud Functions instances.
 */
export const generateResizedImage = functions.storage.object().onFinalize(
  async (object): Promise<void> => {
    logs.start();
    const { contentType } = object; // This is the image MIME type

    const isImage = validators.isImage(contentType);
    if (!isImage) {
      logs.contentTypeInvalid(contentType);
      return;
    }

    const bucket = admin.storage().bucket(object.bucket);
    const filePath = object.name; // File path in the bucket.
    const fileDir = path.dirname(filePath);
    const fileName = path.basename(filePath);
    const fileExtension = path.extname(filePath);
    const fileNameWithoutExtension = fileName.slice(0, -fileExtension.length);

    const isResizedImage = validators.isResizedImage(fileNameWithoutExtension);
    if (isResizedImage) {
      logs.imageAlreadyResized();
      return;
    }

    let originalFile;
    try {
      originalFile = path.join(os.tmpdir(), filePath);
      const tempLocalDir = path.dirname(originalFile);

      // Create the temp directory where the storage file will be downloaded.
      logs.tempDirectoryCreating(tempLocalDir);
      await mkdirp(tempLocalDir);
      logs.tempDirectoryCreated(tempLocalDir);

      // Download file from bucket.
      const remoteFile = bucket.file(filePath);
      logs.imageDownloading(filePath);
      await remoteFile.download({ destination: originalFile });
      logs.imageDownloaded(filePath, originalFile);

      // Convert to a set to remove any duplicate sizes
      const imageSizes = new Set(config.imageSizes);
      const tasks: Promise<ResizedImageResult>[] = [];
      imageSizes.forEach((size) => {
        tasks.push(
          resizeImage({
            bucket,
            originalFile,
            fileDir,
            fileNameWithoutExtension,
            fileExtension,
            contentType,
            size,
          })
        );
      });

      const results = await Promise.all(tasks);

      const failed = results.some((result) => result.success === false);
      if (failed) {
        logs.failed();
        return;
      }
      logs.complete();
    } catch (err) {
      logs.error(err);
    } finally {
      if (originalFile) {
        logs.tempOriginalFileDeleting(filePath);
        fs.unlinkSync(originalFile);
        logs.tempOriginalFileDeleted(filePath);
      }
    }
  }
);

const resizeImage = async ({
  bucket,
  originalFile,
  fileDir,
  fileNameWithoutExtension,
  fileExtension,
  contentType,
  size,
}: {
  bucket: Bucket;
  originalFile: string;
  fileDir: string;
  fileNameWithoutExtension: string;
  fileExtension: string;
  contentType: string;
  size: string;
}): Promise<ResizedImageResult> => {
  const resizedFileName = `${fileNameWithoutExtension}_${size}${fileExtension}`;
  // Path where resized image will be uploaded to in Storage.
  const resizedFilePath = path.normalize(
    config.resizedImagesPath
      ? path.join(fileDir, config.resizedImagesPath, resizedFileName)
      : path.join(fileDir, resizedFileName)
  );
  let resizedFile;

  try {
    resizedFile = path.join(os.tmpdir(), resizedFileName);

    // Cloud Storage files.
    const metadata: any = {
      contentType: contentType,
    };
    if (config.cacheControlHeader) {
      metadata.cacheControl = config.cacheControlHeader;
    }

    // Generate a resized image using ImageMagick.
    logs.imageResizing(resizedFile, size);
    await spawn("convert", [originalFile, "-resize", `${size}>`, resizedFile], {
      capture: ["stdout", "stderr"],
    });
    logs.imageResized(resizedFile);

    // Uploading the resized image.
    logs.imageUploading(resizedFilePath);
    await bucket.upload(resizedFile, {
      destination: resizedFilePath,
      metadata,
    });
    logs.imageUploaded(resizedFilePath);

    return { size, success: true };
  } catch (err) {
    logs.error(err);
    return { size, success: false };
  } finally {
    try {
      // Make sure the local resized file is cleaned up to free up disk space.
      if (resizedFile) {
        logs.tempResizedFileDeleting(resizedFilePath);
        fs.unlinkSync(resizedFile);
        logs.tempResizedFileDeleted(resizedFilePath);
      }
    } catch (err) {
      logs.errorDeleting(err);
    }
  }
};
