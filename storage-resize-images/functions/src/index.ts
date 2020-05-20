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
import * as os from "os";
import * as path from "path";
import * as sharp from "sharp";

import config from "./config";
import * as logs from "./logs";
import * as validators from "./validators";
import { ObjectMetadata } from "firebase-functions/lib/providers/storage";
import { extractFileNameWithoutExtension } from "./util";

interface ResizedImageResult {
  size: string;
  success: boolean;
}

sharp.cache(false);

// Initialize the Firebase Admin SDK
admin.initializeApp();

logs.init();
/**
 * When an image is uploaded in the Storage bucket, we generate a resized image automatically using
 * the Sharp image converting library.
 */
export const generateResizedImage = functions.storage.object().onFinalize(
  async (object): Promise<void> => {
    logs.start();
    const { contentType } = object; // This is the image MIME type

    if (!contentType) {
      logs.noContentType();
      return;
    }

    const isImage = validators.isImage(contentType);
    if (!isImage) {
      logs.contentTypeInvalid(contentType);
      return;
    }

    if (object.metadata && object.metadata.resizedImage === "true") {
      logs.imageAlreadyResized();
      return;
    }

    const bucket = admin.storage().bucket(object.bucket);
    const filePath = object.name; // File path in the bucket.
    const fileDir = path.dirname(filePath);
    const fileExtension = path.extname(filePath);
    const fileNameWithoutExtension = extractFileNameWithoutExtension(
      filePath,
      fileExtension
    );
    const objectMetadata = object;

    let originalFile;
    let remoteFile;
    try {
      originalFile = path.join(os.tmpdir(), filePath);
      const tempLocalDir = path.dirname(originalFile);

      // Create the temp directory where the storage file will be downloaded.
      logs.tempDirectoryCreating(tempLocalDir);
      await mkdirp(tempLocalDir);
      logs.tempDirectoryCreated(tempLocalDir);

      // Download file from bucket.
      remoteFile = bucket.file(filePath);
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
            objectMetadata: objectMetadata,
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
      if (config.deleteOriginalFile) {
        // Delete the original file
        if (remoteFile) {
          try {
            logs.remoteFileDeleting(filePath);
            await remoteFile.delete();
            logs.remoteFileDeleted(filePath);
          } catch (err) {
            logs.errorDeleting(err);
          }
        }
      }
    }
  }
);

function resize(originalFile, resizedFile, size) {
  let height, width;
  if (size.indexOf(",") !== -1) {
    [width, height] = size.split(",");
  } else if (size.indexOf("x") !== -1) {
    [width, height] = size.split("x");
  } else {
    throw new Error("height and width are not delimited by a ',' or a 'x'");
  }

  return sharp(originalFile)
    .rotate()
    .resize(parseInt(width, 10), parseInt(height, 10), { fit: "inside" })
    .toFile(resizedFile);
}

const resizeImage = async ({
  bucket,
  originalFile,
  fileDir,
  fileNameWithoutExtension,
  fileExtension,
  contentType,
  size,
  objectMetadata,
}: {
  bucket: Bucket;
  originalFile: string;
  fileDir: string;
  fileNameWithoutExtension: string;
  fileExtension: string;
  contentType: string;
  size: string;
  objectMetadata: ObjectMetadata;
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
      contentDisposition: objectMetadata.contentDisposition,
      contentEncoding: objectMetadata.contentEncoding,
      contentLanguage: objectMetadata.contentLanguage,
      contentType: contentType,
      metadata: objectMetadata.metadata || {},
    };
    metadata.metadata.resizedImage = true;
    if (config.cacheControlHeader) {
      metadata.cacheControl = config.cacheControlHeader;
    } else {
      metadata.cacheControl = objectMetadata.cacheControl;
    }

    // Generate a resized image using Sharp.
    logs.imageResizing(resizedFile, size);

    await resize(originalFile, resizedFile, size);

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
