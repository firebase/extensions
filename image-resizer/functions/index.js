/*
 * Copyright 2019 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

const admin = require("firebase-admin");
const fs = require("fs");
const functions = require("firebase-functions");
const mkdirp = require("mkdirp-promise");
const { spawn } = require("child-process-promise");
const os = require("os");
const path = require("path");

// Initializing firebase-admin
admin.initializeApp();

const CACHE_CONTROL_HEADER = process.env.CACHE_CONTROL_HEADER;
const MAX_HEIGHT = process.env.IMG_MAX_HEIGHT;
const MAX_WIDTH = process.env.IMG_MAX_WIDTH;
const PREFIX = process.env.IMG_PREFIX;
const SIGNED_URLS_PATH = process.env.SIGNED_URLS_PATH;
const SIGNED_URLS_EXPIRATION_DATE = process.env.SIGNED_URLS_EXPIRATION_DATE;

/**
 * When an image is uploaded in the Storage bucket We generate a resized image automatically using
 * ImageMagick which is installed by default on all Cloud Functions instances.
 * After the resized image has been generated and uploaded to Cloud Storage,
 * we write the public URL to the Firebase Realtime Database.
 */
exports.generateResizedImage = functions.storage
  .object()
  .onFinalize(async (object) => {
    const contentType = object.contentType; // This is the image MIME type
    // Exit if this is triggered on a file that is not an image.
    if (!contentType.startsWith("image/")) {
      console.log("This is not an image.");
      return;
    }

    const filePath = object.name; // File path in the bucket.
    const fileDir = path.dirname(filePath);
    const fileName = path.basename(filePath);
    // Exit if the image is already a resized image.
    if (fileName.startsWith(PREFIX)) {
      console.log("Already a resized image.");
      return;
    }

    // Path where resized image will be uploaded to in Storage.
    const imgFilePath = path.normalize(
      path.join(fileDir, `${PREFIX}${fileName}`)
    );
    const tempLocalFile = path.join(os.tmpdir(), filePath);
    const tempLocalDir = path.dirname(tempLocalFile);
    const tempLocalImgFile = path.join(os.tmpdir(), imgFilePath);

    // Cloud Storage files.
    const bucket = admin.storage().bucket(object.bucket);
    const file = bucket.file(filePath);
    const imgFile = bucket.file(imgFilePath);
    const metadata = {
      contentType: contentType,
      "Cache-Control": CACHE_CONTROL_HEADER,
    };

    // Create the temp directory where the storage file will be downloaded.
    await mkdirp(tempLocalDir);

    // Download file from bucket.
    await file.download({ destination: tempLocalFile });
    console.log("The file has been downloaded to", tempLocalFile);

    // Generate a resized image using ImageMagick.
    await spawn(
      "convert",
      [
        tempLocalFile,
        "-resize",
        `${MAX_WIDTH}x${MAX_HEIGHT}>`,
        tempLocalImgFile,
      ],
      { capture: ["stdout", "stderr"] }
    );
    console.log("resized image created at", tempLocalImgFile);

    // Uploading the resized image.
    await bucket.upload(tempLocalImgFile, {
      destination: imgFilePath,
      metadata: metadata,
    });
    console.log("resized image uploaded to Storage at", imgFilePath);

    // Once the image has been uploaded delete the local files to free up disk space.
    fs.unlinkSync(tempLocalFile);
    fs.unlinkSync(tempLocalImgFile);

    if (SIGNED_URLS_PATH) {
      // Get the Signed URLs for the resized image and original image. The signed URLs provide authenticated read access to
      // the images. These URLs expire on the date set in the config object below.
      const config = {
        action: "read",
        expires: SIGNED_URLS_EXPIRATION_DATE,
      };
      const results = await Promise.all([
        imgFile.getSignedUrl(config),
        file.getSignedUrl(config),
      ]);
      console.log("Got Signed URLs.");

      const imgResult = results[0];
      const originalResult = results[1];
      const imgFileUrl = imgResult[0];
      const fileUrl = originalResult[0];

      // Add the URLs to the Database
      await admin
        .database()
        .ref(`${SIGNED_URLS_PATH}`)
        .push({ path: fileUrl, resizedImage: imgFileUrl });
      console.log("resized image URLs saved to database.");
    }
  });
