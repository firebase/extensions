/*
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

const admin = require('firebase-admin');
const fs = require('fs');
const functions = require('firebase-functions');
const mkdirp = require('mkdirp-promise');
const spawn = require('child-process-promise').spawn;
const os = require('os');
const path = require('path');

// Initializing firebase-admin using auto-populated environment variable.
admin.initializeApp(JSON.parse(process.env.FIREBASE_CONFIG));

const MAX_HEIGHT = process.env.THUMB_MAX_HEIGHT;
const MAX_WIDTH = process.env.THUMB_MAX_WIDTH;
const PREFIX = process.env.THUMB_PREFIX;
const FOLDER = process.env.SIGNED_URLS_FOLDER;

/**
 * When an image is uploaded in the Storage bucket We generate a thumbnail automatically using
 * ImageMagick.
 * After the thumbnail has been generated and uploaded to Cloud Storage,
 * we write the public URL to the Firebase Realtime Database.
 */
exports.generateThumbnail = functions.storage.object().onFinalize(object => {
  const contentType = object.contentType; // This is the image MIME type
  const filePath = object.name; // File path in the bucket.
  const fileDir = path.dirname(filePath);
  const fileName = path.basename(filePath);
  // Path thumbnail image will be uploaded to in Storage.
  const thumbFilePath = path.normalize(path.join(fileDir, `${PREFIX}${fileName}`));
  const tempLocalFile = path.join(os.tmpdir(), filePath);
  const tempLocalDir = path.dirname(tempLocalFile);
  const tempLocalThumbFile = path.join(os.tmpdir(), thumbFilePath);

  // Exit if this is triggered on a file that is not an image.
  if (!contentType.startsWith('image/')) {
    console.log('This is not an image.')
    return Promise.resolve();
  }

  // Exit if the image is already a thumbnail.
  if (fileName.startsWith(PREFIX)) {
    console.log('Already a Thumbnail.');
    return Promise.resolve();
  }

  // Cloud Storage files.
  const bucket = admin.storage().bucket(object.bucket);
  const file = bucket.file(filePath);
  const thumbFile = bucket.file(thumbFilePath);
  const metadata = {
    contentType: contentType,
    // To enable Client-side caching you can set the Cache-Control headers here. Uncomment below.
    // 'Cache-Control': 'public,max-age=3600',
  };
  
  // Create the temp directory where the storage file will be downloaded.
  return mkdirp(tempLocalDir).then(() => {
    // Download file from bucket.
    return file.download({destination: tempLocalFile});
  }).then(() => {
    console.log('The file has been downloaded to', tempLocalFile);
    // Generate a thumbnail using ImageMagick.
    return spawn('convert', [tempLocalFile, '-thumbnail', `${MAX_WIDTH}x${MAX_HEIGHT}>`, tempLocalThumbFile], {capture: ['stdout', 'stderr']});
  }).then(() => {
    console.log('Thumbnail created at', tempLocalThumbFile);
    // Uploading the Thumbnail.
    return bucket.upload(tempLocalThumbFile, {destination: thumbFilePath, metadata: metadata});
  }).then(() => {
    console.log('Thumbnail uploaded to Storage at', thumbFilePath);
    // Once the image has been uploaded delete the local files to free up disk space.
    fs.unlinkSync(tempLocalFile);
    fs.unlinkSync(tempLocalThumbFile);

    // Get the Signed URLs for the thumbnail and original image.
    const config = {
      action: 'read',
      expires: '03-01-2500',
    };
    return Promise.all([
      thumbFile.getSignedUrl(config),
      file.getSignedUrl(config),
    ]);
  }).then(results => {
    console.log('Got Signed URLs.');
    const thumbResult = results[0];
    const originalResult = results[1];
    const thumbFileUrl = thumbResult[0];
    const fileUrl = originalResult[0];
    // Add the URLs to the Database
    return admin.database().ref(`${FOLDER}`).push({path: fileUrl, thumbnail: thumbFileUrl});
  }).then(() => {
    return console.log('Thumbnail URLs saved to database.');
  });  
});
