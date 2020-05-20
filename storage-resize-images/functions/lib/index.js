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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateResizedImage = void 0;
const admin = require("firebase-admin");
const fs = require("fs");
const functions = require("firebase-functions");
const mkdirp = require("mkdirp-promise");
const os = require("os");
const path = require("path");
const sharp = require("sharp");
const config_1 = require("./config");
const logs = require("./logs");
const validators = require("./validators");
const util_1 = require("./util");
sharp.cache(false);
// Initialize the Firebase Admin SDK
admin.initializeApp();
logs.init();
/**
 * When an image is uploaded in the Storage bucket, we generate a resized image automatically using
 * the Sharp image converting library.
 */
exports.generateResizedImage = functions.storage.object().onFinalize((object) => __awaiter(void 0, void 0, void 0, function* () {
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
    const fileNameWithoutExtension = util_1.extractFileNameWithoutExtension(filePath, fileExtension);
    const objectMetadata = object;
    let originalFile;
    let remoteFile;
    try {
        originalFile = path.join(os.tmpdir(), filePath);
        const tempLocalDir = path.dirname(originalFile);
        // Create the temp directory where the storage file will be downloaded.
        logs.tempDirectoryCreating(tempLocalDir);
        yield mkdirp(tempLocalDir);
        logs.tempDirectoryCreated(tempLocalDir);
        // Download file from bucket.
        remoteFile = bucket.file(filePath);
        logs.imageDownloading(filePath);
        yield remoteFile.download({ destination: originalFile });
        logs.imageDownloaded(filePath, originalFile);
        // Convert to a set to remove any duplicate sizes
        const imageSizes = new Set(config_1.default.imageSizes);
        const tasks = [];
        imageSizes.forEach((size) => {
            tasks.push(resizeImage({
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
        const results = yield Promise.all(tasks);
        const failed = results.some((result) => result.success === false);
        if (failed) {
            logs.failed();
            return;
        }
        logs.complete();
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
        if (config_1.default.deleteOriginalFile) {
            // Delete the original file
            if (remoteFile) {
                try {
                    logs.remoteFileDeleting(filePath);
                    yield remoteFile.delete();
                    logs.remoteFileDeleted(filePath);
                }
                catch (err) {
                    logs.errorDeleting(err);
                }
            }
        }
    }
}));
function resize(originalFile, resizedFile, size) {
    let height, width;
    if (size.indexOf(",") !== -1) {
        [width, height] = size.split(",");
    }
    else if (size.indexOf("x") !== -1) {
        [width, height] = size.split("x");
    }
    else {
        throw new Error("height and width are not delimited by a ',' or a 'x'");
    }
    return sharp(originalFile)
        .rotate()
        .resize(parseInt(width, 10), parseInt(height, 10), { fit: "inside" })
        .toFile(resizedFile);
}
const resizeImage = ({ bucket, originalFile, fileDir, fileNameWithoutExtension, fileExtension, contentType, size, objectMetadata, }) => __awaiter(void 0, void 0, void 0, function* () {
    const resizedFileName = `${fileNameWithoutExtension}_${size}${fileExtension}`;
    // Path where resized image will be uploaded to in Storage.
    const resizedFilePath = path.normalize(config_1.default.resizedImagesPath
        ? path.join(fileDir, config_1.default.resizedImagesPath, resizedFileName)
        : path.join(fileDir, resizedFileName));
    let resizedFile;
    try {
        resizedFile = path.join(os.tmpdir(), resizedFileName);
        // Cloud Storage files.
        const metadata = {
            contentDisposition: objectMetadata.contentDisposition,
            contentEncoding: objectMetadata.contentEncoding,
            contentLanguage: objectMetadata.contentLanguage,
            contentType: contentType,
            metadata: objectMetadata.metadata || {},
        };
        metadata.metadata.resizedImage = true;
        if (config_1.default.cacheControlHeader) {
            metadata.cacheControl = config_1.default.cacheControlHeader;
        }
        else {
            metadata.cacheControl = objectMetadata.cacheControl;
        }
        // Generate a resized image using Sharp.
        logs.imageResizing(resizedFile, size);
        yield resize(originalFile, resizedFile, size);
        logs.imageResized(resizedFile);
        // Uploading the resized image.
        logs.imageUploading(resizedFilePath);
        yield bucket.upload(resizedFile, {
            destination: resizedFilePath,
            metadata,
        });
        logs.imageUploaded(resizedFilePath);
        return { size, success: true };
    }
    catch (err) {
        logs.error(err);
        return { size, success: false };
    }
    finally {
        try {
            // Make sure the local resized file is cleaned up to free up disk space.
            if (resizedFile) {
                logs.tempResizedFileDeleting(resizedFilePath);
                fs.unlinkSync(resizedFile);
                logs.tempResizedFileDeleted(resizedFilePath);
            }
        }
        catch (err) {
            logs.errorDeleting(err);
        }
    }
});
