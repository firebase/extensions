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
exports.convertType = exports.generateResizedImage = void 0;
const admin = require("firebase-admin");
const fs = require("fs");
const functions = require("firebase-functions");
const mkdirp = require("mkdirp");
const os = require("os");
const path = require("path");
const sharp = require("sharp");
const uuidv4_1 = require("uuidv4");
const config_1 = require("./config");
const logs = require("./logs");
const util_1 = require("./util");
sharp.cache(false);
// Initialize the Firebase Admin SDK
admin.initializeApp();
logs.init();
/**
 * Supported file types
 */
const supportedContentTypes = [
    "image/jpeg",
    "image/png",
    "image/tiff",
    "image/webp",
];
const supportedImageContentTypeMap = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    tiff: "image/tiff",
    webp: "image/webp",
};
/**
 * When an image is uploaded in the Storage bucket, we generate a resized image automatically using
 * the Sharp image converting library.
 */
exports.generateResizedImage = functions.storage.object().onFinalize(async (object) => {
    logs.start();
    const { contentType } = object; // This is the image MIME type
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
    if (!supportedContentTypes.includes(contentType)) {
        logs.unsupportedType(supportedContentTypes, contentType);
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
            tasks.push(modifyImage({
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
function resize(file, size) {
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
    return sharp(file)
        .rotate()
        .resize(parseInt(width, 10), parseInt(height, 10), {
        fit: "inside",
        withoutEnlargement: true,
    })
        .toBuffer();
}
function convertType(buffer) {
    const { imageType } = config_1.default;
    if (imageType === "jpg" || imageType === "jpeg") {
        return sharp(buffer)
            .jpeg()
            .toBuffer();
    }
    else if (imageType === "png") {
        return sharp(buffer)
            .png()
            .toBuffer();
    }
    else if (imageType === "webp") {
        return sharp(buffer)
            .webp()
            .toBuffer();
    }
    else if (imageType === "tiff") {
        return sharp(buffer)
            .tiff()
            .toBuffer();
    }
    return buffer;
}
exports.convertType = convertType;
const modifyImage = async ({ bucket, originalFile, fileDir, fileNameWithoutExtension, fileExtension, contentType, size, objectMetadata, }) => {
    const { imageType } = config_1.default;
    const hasImageTypeConfigSet = imageType !== "false";
    const imageContentType = hasImageTypeConfigSet
        ? supportedImageContentTypeMap[imageType]
        : contentType;
    const modifiedExtensionName = fileExtension && hasImageTypeConfigSet ? `.${imageType}` : fileExtension;
    const modifiedFileName = `${fileNameWithoutExtension}_${size}${modifiedExtensionName}`;
    // Path where modified image will be uploaded to in Storage.
    const modifiedFilePath = path.normalize(config_1.default.resizedImagesPath
        ? path.join(fileDir, config_1.default.resizedImagesPath, modifiedFileName)
        : path.join(fileDir, modifiedFileName));
    let modifiedFile;
    try {
        modifiedFile = path.join(os.tmpdir(), modifiedFileName);
        // Cloud Storage files.
        const metadata = {
            contentDisposition: objectMetadata.contentDisposition,
            contentEncoding: objectMetadata.contentEncoding,
            contentLanguage: objectMetadata.contentLanguage,
            contentType: imageContentType,
            metadata: objectMetadata.metadata || {},
        };
        metadata.metadata.resizedImage = true;
        if (config_1.default.cacheControlHeader) {
            metadata.cacheControl = config_1.default.cacheControlHeader;
        }
        else {
            metadata.cacheControl = objectMetadata.cacheControl;
        }
        // If the original image has a download token, add a
        // new token to the image being resized #323
        if (metadata.metadata.firebaseStorageDownloadTokens) {
            metadata.metadata.firebaseStorageDownloadTokens = uuidv4_1.uuid();
        }
        // Generate a resized image buffer using Sharp.
        logs.imageResizing(modifiedFile, size);
        let modifiedImageBuffer = await resize(originalFile, size);
        logs.imageResized(modifiedFile);
        // Generate a converted image type buffer using Sharp.
        if (hasImageTypeConfigSet) {
            logs.imageConverting(fileExtension, config_1.default.imageType);
            modifiedImageBuffer = await convertType(modifiedImageBuffer);
            logs.imageConverted(config_1.default.imageType);
        }
        // Generate a image file using Sharp.
        await sharp(modifiedImageBuffer).toFile(modifiedFile);
        // Uploading the modified image.
        logs.imageUploading(modifiedFilePath);
        await bucket.upload(modifiedFile, {
            destination: modifiedFilePath,
            metadata,
        });
        logs.imageUploaded(modifiedFilePath);
        return { size, success: true };
    }
    catch (err) {
        logs.error(err);
        return { size, success: false };
    }
    finally {
        try {
            // Make sure the local resized file is cleaned up to free up disk space.
            if (modifiedFile) {
                logs.tempResizedFileDeleting(modifiedFilePath);
                fs.unlinkSync(modifiedFile);
                logs.tempResizedFileDeleted(modifiedFilePath);
            }
        }
        catch (err) {
            logs.errorDeleting(err);
        }
    }
};
