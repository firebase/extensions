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
const config_1 = require("./config");
exports.contentTypeInvalid = (contentType) => {
    console.log(`File of type '${contentType}' is not an image, no processing is required`);
};
exports.error = (err) => {
    console.error("Error resizing image", err);
};
exports.errorDeleting = (err) => {
    console.warn("There was a problem deleting temporary files", err);
};
exports.imageAlreadyResized = () => {
    console.log("File is already a resized image, no processing is required");
};
exports.imageDownloaded = (remotePath, localPath) => {
    console.log(`Downloaded image file: '${remotePath}' to '${localPath}'`);
};
exports.imageDownloading = (path) => {
    console.log(`Downloading image file: '${path}'`);
};
exports.imageResized = (path) => {
    console.log(`Resized image created at '${path}'`);
};
exports.imageResizing = (width, height) => {
    console.log(`Resizing image file to size: ${width}x${height}`);
};
exports.imageUploaded = (path) => {
    console.log(`Uploaded resized image to '${path}'`);
};
exports.imageUploading = (path) => {
    console.log(`Uploading resized image to '${path}'`);
};
exports.init = () => {
    console.log("Initialising mod with configuration", config_1.default);
};
exports.signedUrlsGenerated = () => {
    console.log("Generated Signed URLs");
};
exports.signedUrlsGenerating = () => {
    console.log("Generating signed URLs");
};
exports.signedUrlsNotConfigured = () => {
    console.log("Signed URLS are not configured, skipping");
};
exports.signedUrlsSaved = (path) => {
    console.log(`Saved signed URLs to database at: '${path}'`);
};
exports.signedUrlsSaving = (path) => {
    console.log(`Saving signed URLs in database at: '${path}'`);
};
exports.start = () => {
    console.log("Started mod execution with configuration", config_1.default);
};
exports.tempDirectoryCreated = (directory) => {
    console.log(`Created temporary directory: '${directory}'`);
};
exports.tempDirectoryCreating = (directory) => {
    console.log(`Creating temporary directory: '${directory}'`);
};
exports.tempFilesDeleted = () => {
    console.log("Deleted temporary files");
};
exports.tempFilesDeleting = () => {
    console.log("Deleting temporary files");
};
