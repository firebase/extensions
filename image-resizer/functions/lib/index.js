"use strict";
/*
 * Copyright 2019 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const admin = require("firebase-admin");
const fs = require("fs");
const functions = require("firebase-functions");
const mkdirp = require("mkdirp-promise");
const child_process_promise_1 = require("child-process-promise");
const os = require("os");
const path = require("path");
const config_1 = require("./config");
const logs = require("./logs");
const validators = require("./validators");
// Initialize the Firebase Admin SDK
admin.initializeApp();
logs.init();
/**
 * When an image is uploaded in the Storage bucket We generate a resized image automatically using
 * ImageMagick which is installed by default on all Cloud Functions instances.
 * After the resized image has been generated and uploaded to Cloud Storage,
 * we write the public URL to the Firebase Realtime Database.
 */
exports.generateResizedImage = functions.storage.object().onFinalize((object) => __awaiter(this, void 0, void 0, function* () {
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
    const suffix = `_${config_1.default.maxWidth}x${config_1.default.maxHeight}`;
    const isResizedImage = validators.isResizedImage(fileNameWithoutExtension, suffix);
    if (isResizedImage) {
        logs.imageAlreadyResized();
        return;
    }
    let tempFile;
    let tempResizedFile;
    try {
        // Path where resized image will be uploaded to in Storage.
        const resizedFilePath = path.normalize(path.join(fileDir, `${fileNameWithoutExtension}${suffix}${fileExtension}`));
        tempFile = path.join(os.tmpdir(), filePath);
        const tempLocalDir = path.dirname(tempFile);
        tempResizedFile = path.join(os.tmpdir(), resizedFilePath);
        // Cloud Storage files.
        const bucket = admin.storage().bucket(object.bucket);
        const remoteFile = bucket.file(filePath);
        const remoteResizedFile = bucket.file(resizedFilePath);
        const metadata = {
            contentType: contentType,
            "Cache-Control": config_1.default.cacheControlHeader,
        };
        // Create the temp directory where the storage file will be downloaded.
        logs.tempDirectoryCreating(tempLocalDir);
        yield mkdirp(tempLocalDir);
        logs.tempDirectoryCreated(tempLocalDir);
        // Download file from bucket.
        logs.imageDownloading(filePath);
        yield remoteFile.download({ destination: tempFile });
        logs.imageDownloaded(filePath, tempFile);
        // Generate a resized image using ImageMagick.
        logs.imageResizing(config_1.default.maxWidth, config_1.default.maxHeight);
        yield child_process_promise_1.spawn("convert", [
            tempFile,
            "-resize",
            `${config_1.default.maxWidth}x${config_1.default.maxHeight}>`,
            tempResizedFile,
        ], { capture: ["stdout", "stderr"] });
        logs.imageResized(tempResizedFile);
        // Uploading the resized image.
        logs.imageUploading(resizedFilePath);
        yield bucket.upload(tempResizedFile, {
            destination: resizedFilePath,
            metadata: metadata,
        });
        logs.imageUploaded(resizedFilePath);
        if (config_1.default.signedUrlsPath) {
            // Get the Signed URLs for the resized image and original image. The signed URLs provide authenticated read access to
            // the images. These URLs expire on the date set in the config object below.
            const signedUrlConfig = {
                action: "read",
                expires: config_1.default.signedUrlsExpirationDate,
            };
            logs.signedUrlsGenerating();
            const results = yield Promise.all([
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
            logs.signedUrlsSaving(config_1.default.signedUrlsPath);
            yield admin
                .database()
                .ref(`${config_1.default.signedUrlsPath}`)
                .push({ path: fileUrl, resizedImage: imgFileUrl });
            logs.signedUrlsSaved(config_1.default.signedUrlsPath);
        }
        else {
            logs.signedUrlsNotConfigured();
        }
    }
    catch (err) {
        logs.error(err);
    }
    finally {
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
        }
        catch (err) {
            logs.errorDeleting(err);
        }
    }
}));
