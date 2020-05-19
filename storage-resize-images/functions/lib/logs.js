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
exports.remoteFileDeleting = exports.remoteFileDeleted = exports.tempResizedFileDeleting = exports.tempResizedFileDeleted = exports.tempOriginalFileDeleting = exports.tempOriginalFileDeleted = exports.tempDirectoryCreating = exports.tempDirectoryCreated = exports.start = exports.init = exports.imageUploading = exports.imageUploaded = exports.imageResizing = exports.imageResized = exports.imageDownloading = exports.imageDownloaded = exports.imageAlreadyResized = exports.failed = exports.errorDeleting = exports.error = exports.contentTypeInvalid = exports.noContentType = exports.complete = void 0;
const config_1 = require("./config");
exports.complete = () => {
    console.log("Completed execution of extension");
};
exports.noContentType = () => {
    console.log(`File has no Content-Type, no processing is required`);
};
exports.contentTypeInvalid = (contentType) => {
    console.log(`File of type '${contentType}' is not an image, no processing is required`);
};
exports.error = (err) => {
    console.error("Error when resizing image", err);
};
exports.errorDeleting = (err) => {
    console.warn("Error when deleting temporary files", err);
};
exports.failed = () => {
    console.log("Failed execution of extension");
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
exports.imageResizing = (path, size) => {
    console.log(`Resizing image at path '${path}' to size: ${size}`);
};
exports.imageUploaded = (path) => {
    console.log(`Uploaded resized image to '${path}'`);
};
exports.imageUploading = (path) => {
    console.log(`Uploading resized image to '${path}'`);
};
exports.init = () => {
    console.log("Initializing extension with configuration", config_1.default);
};
exports.start = () => {
    console.log("Started execution of extension with configuration", config_1.default);
};
exports.tempDirectoryCreated = (directory) => {
    console.log(`Created temporary directory: '${directory}'`);
};
exports.tempDirectoryCreating = (directory) => {
    console.log(`Creating temporary directory: '${directory}'`);
};
exports.tempOriginalFileDeleted = (path) => {
    console.log(`Deleted temporary original file: '${path}'`);
};
exports.tempOriginalFileDeleting = (path) => {
    console.log(`Deleting temporary original file: '${path}'`);
};
exports.tempResizedFileDeleted = (path) => {
    console.log(`Deleted temporary resized file: '${path}'`);
};
exports.tempResizedFileDeleting = (path) => {
    console.log(`Deleting temporary resized file: '${path}'`);
};
exports.remoteFileDeleted = (path) => {
    console.log(`Deleted original file from storage bucket: '${path}'`);
};
exports.remoteFileDeleting = (path) => {
    console.log(`Deleting original file from storage bucket: '${path}'`);
};
