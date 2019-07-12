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
import * as fs from "fs";
import * as functions from "firebase-functions";
import * as mkdirp from "mkdirp-promise";
import { spawn } from "child-process-promise";
import * as os from "os";
import * as path from "path";

import config from "./config";
import * as logs from "./logs";
import * as validators from "./validators";

// Initialize the Firebase Admin SDK
admin.initializeApp();

logs.init();

/**
 * When an image is uploaded in the Storage bucket We generate a resized image automatically using
 * ImageMagick which is installed by default on all Cloud Functions instances.
 * After the resized image has been generated and uploaded to Cloud Storage,
 * we write the public URL to the Firebase Realtime Database.
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

    const filePath = object.name; // File path in the bucket.
    const fileDir = path.dirname(filePath);
    const fileName = path.basename(filePath);
    const fileExtension = path.extname(filePath);
    const fileNameWithoutExtension = fileName.slice(0, -fileExtension.length);
    const suffix = `_${config.maxWidth}x${config.maxHeight}`;

    const isResizedImage = validators.isResizedImage(
      fileNameWithoutExtension,
      suffix
    );
    if (isResizedImage) {
      logs.imageAlreadyResized();
      return;
    }

    let tempFile;
    let tempResizedFile;
    try {
      // Path where resized image will be uploaded to in Storage.
      const resizedFilePath = path.normalize(
        path.join(
          fileDir,
          `${fileNameWithoutExtension}${suffix}${fileExtension}`
        )
      );
      tempFile = path.join(os.tmpdir(), filePath);
      const tempLocalDir = path.dirname(tempFile);
      tempResizedFile = path.join(os.tmpdir(), resizedFilePath);

      // Cloud Storage files.
      const bucket = admin.storage().bucket(object.bucket);
      const remoteFile = bucket.file(filePath);
      const remoteResizedFile = bucket.file(resizedFilePath);
      const metadata = {
        contentType: contentType,
        "Cache-Control": config.cacheControlHeader,
      };

      // Create the temp directory where the storage file will be downloaded.
      logs.tempDirectoryCreating(tempLocalDir);
      await mkdirp(tempLocalDir);
      logs.tempDirectoryCreated(tempLocalDir);

      // Download file from bucket.
      logs.imageDownloading(filePath);
      await remoteFile.download({ destination: tempFile });
      logs.imageDownloaded(filePath, tempFile);

      // Generate a resized image using ImageMagick.
      logs.imageResizing(config.maxWidth, config.maxHeight);
      await spawn(
        "convert",
        [
          tempFile,
          "-resize",
          `${config.maxWidth}x${config.maxHeight}>`,
          tempResizedFile,
        ],
        { capture: ["stdout", "stderr"] }
      );
      logs.imageResized(tempResizedFile);

      // Uploading the resized image.
      logs.imageUploading(resizedFilePath);
      await bucket.upload(tempResizedFile, {
        destination: resizedFilePath,
        metadata: metadata,
      });
      logs.imageUploaded(resizedFilePath);

      if (config.signedUrlsPath) {
        // Get the Signed URLs for the resized image and original image. The signed URLs provide authenticated read access to
        // the images. These URLs expire on the date set in the config object below.
        const signedUrlConfig = {
          action: "read",
          expires: config.signedUrlsExpirationDate,
        };
        logs.signedUrlsGenerating();
        const results = await Promise.all([
          // @ts-ignore incorrectly seeing "read" as a string
          remoteResizedFile.getSignedUrl(signedUrlConfig),
          // @ts-ignore incorrectly seeing "read" as a string
          remoteFile.getSignedUrl(signedUrlConfig),
        ]);
        logs.signedUrlsGenerated();

        const imgResult = results[0];
        const originalResult = results[1];
        const imgFileUrl = imgResult[0];
        const fileUrl = originalResult[0];

        // Add the URLs to the Database
        logs.signedUrlsSaving(config.signedUrlsPath);
        await admin
          .database()
          .ref(`${config.signedUrlsPath}`)
          .push({ path: fileUrl, resizedImage: imgFileUrl });
        logs.signedUrlsSaved(config.signedUrlsPath);
      } else {
        logs.signedUrlsNotConfigured();
      }
    } catch (err) {
      logs.error(err);
    } finally {
      try {
        // Make sure all local files are cleaned up to free up disk space.
        logs.tempFilesDeleting();
        if (tempFile) {
          fs.unlinkSync(tempFile);
        }
        if (tempResizedFile) {
          fs.unlinkSync(tempResizedFile);
        }
        logs.tempFilesDeleted();
      } catch (err) {
        logs.errorDeleting(err);
      }
    }
  }
);
