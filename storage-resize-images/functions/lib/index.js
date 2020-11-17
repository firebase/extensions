"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateResizedImage = void 0;
const admin = require("firebase-admin");
const fs = require("fs");
const functions = require("firebase-functions");
const mkdirp = require("mkdirp");
const os = require("os");
const path = require("path");
const sharp = require("sharp");
const resize_image_1 = require("./resize-image");
const config_1 = require("./config");
const logs = require("./logs");
const util_1 = require("./util");
sharp.cache(false);
// Initialize the Firebase Admin SDK
admin.initializeApp();
logs.init();
/**
 * When an image is uploaded in the Storage bucket, we generate a resized image automatically using
 * the Sharp image converting library.
 */
exports.generateResizedImage = functions.storage.object().onFinalize(async (object) => {
    logs.start();
    const { contentType } = object; // This is the image MIME type
    const tmpFilePath = path.resolve("/", path.dirname(object.name)); // Absolute path to dirname
    if (!contentType) {
        logs.noContentType();
        return;
    }
    if (!contentType.startsWith("image/")) {
        logs.contentTypeInvalid(contentType);
        return;
    }
    if (object.contentEncoding === "gzip") {
        logs.gzipContentEncoding();
        return;
    }
    if (!resize_image_1.supportedContentTypes.includes(contentType)) {
        logs.unsupportedType(resize_image_1.supportedContentTypes, contentType);
        return;
    }
    if (config_1.default.includePathList &&
        !util_1.startsWithArray(config_1.default.includePathList, tmpFilePath)) {
        logs.imageOutsideOfPaths(config_1.default.includePathList, tmpFilePath);
        return;
    }
    if (config_1.default.excludePathList &&
        util_1.startsWithArray(config_1.default.excludePathList, tmpFilePath)) {
        logs.imageInsideOfExcludedPaths(config_1.default.excludePathList, tmpFilePath);
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
    const fileNameWithoutExtension = util_1.extractFileNameWithoutExtension(filePath, fileExtension);
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
        const imageSizes = new Set(config_1.default.imageSizes);
        const tasks = [];
        imageSizes.forEach((size) => {
            tasks.push(resize_image_1.modifyImage({
                bucket,
                originalFile,
                fileDir,
                fileNameWithoutExtension,
                fileExtension,
                contentType,
                size,
                objectMetadata: objectMetadata,
            }));
        });
        const results = await Promise.all(tasks);
        const failed = results.some((result) => result.success === false);
        if (failed) {
            logs.failed();
            return;
        }
        else {
            if (config_1.default.deleteOriginalFile === config_1.deleteImage.onSuccess) {
                if (remoteFile) {
                    try {
                        logs.remoteFileDeleting(filePath);
                        await remoteFile.delete();
                        logs.remoteFileDeleted(filePath);
                    }
                    catch (err) {
                        logs.errorDeleting(err);
                    }
                }
            }
            logs.complete();
        }
    }
    catch (err) {
        logs.error(err);
    }
    finally {
        if (originalFile) {
            logs.tempOriginalFileDeleting(filePath);
            fs.unlinkSync(originalFile);
            logs.tempOriginalFileDeleted(filePath);
        }
        if (config_1.default.deleteOriginalFile === config_1.deleteImage.always) {
            // Delete the original file
            if (remoteFile) {
                try {
                    logs.remoteFileDeleting(filePath);
                    await remoteFile.delete();
                    logs.remoteFileDeleted(filePath);
                }
                catch (err) {
                    logs.errorDeleting(err);
                }
            }
        }
    }
});
