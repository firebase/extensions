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
exports.remoteFileDeleting = exports.remoteFileDeleted = exports.tempResizedFileDeleting = exports.tempResizedFileDeleted = exports.tempOriginalFileDeleting = exports.tempOriginalFileDeleted = exports.tempDirectoryCreating = exports.tempDirectoryCreated = exports.start = exports.init = exports.imageUploading = exports.imageUploaded = exports.imageResizing = exports.imageResized = exports.imageDownloading = exports.imageDownloaded = exports.imageAlreadyResized = exports.failed = exports.errorDeleting = exports.error = exports.unsupportedType = exports.contentTypeInvalid = exports.noContentType = exports.complete = void 0;
const firebase_functions_1 = require("firebase-functions");
const config_1 = require("./config");
exports.complete = () => {
    firebase_functions_1.logger.log("Completed execution of extension");
};
exports.noContentType = () => {
    firebase_functions_1.logger.log(`File has no Content-Type, no processing is required`);
};
exports.contentTypeInvalid = (contentType) => {
    firebase_functions_1.logger.log(`File of type '${contentType}' is not an image, no processing is required`);
};
exports.unsupportedType = (unsupportedTypes, contentType) => {
    firebase_functions_1.logger.log(`Image type '${contentType}' is not supported, here are the supported file types: ${unsupportedTypes.join(", ")}`);
};
exports.error = (err) => {
    console.error("Error when resizing image", err);
};
exports.errorDeleting = (err) => {
    console.warn("Error when deleting temporary files", err);
};
exports.failed = () => {
    firebase_functions_1.logger.log("Failed execution of extension");
};
exports.imageAlreadyResized = () => {
    firebase_functions_1.logger.log("File is already a resized image, no processing is required");
};
exports.imageDownloaded = (remotePath, localPath) => {
    firebase_functions_1.logger.log(`Downloaded image file: '${remotePath}' to '${localPath}'`);
};
exports.imageDownloading = (path) => {
    firebase_functions_1.logger.log(`Downloading image file: '${path}'`);
};
exports.imageResized = (path) => {
    firebase_functions_1.logger.log(`Resized image created at '${path}'`);
};
exports.imageResizing = (path, size) => {
    firebase_functions_1.logger.log(`Resizing image at path '${path}' to size: ${size}`);
};
exports.imageUploaded = (path) => {
    firebase_functions_1.logger.log(`Uploaded resized image to '${path}'`);
};
exports.imageUploading = (path) => {
    firebase_functions_1.logger.log(`Uploading resized image to '${path}'`);
};
exports.init = () => {
    firebase_functions_1.logger.log("Initializing extension with configuration", config_1.default);
};
exports.start = () => {
    firebase_functions_1.logger.log("Started execution of extension with configuration", config_1.default);
};
exports.tempDirectoryCreated = (directory) => {
    firebase_functions_1.logger.log(`Created temporary directory: '${directory}'`);
};
exports.tempDirectoryCreating = (directory) => {
    firebase_functions_1.logger.log(`Creating temporary directory: '${directory}'`);
};
exports.tempOriginalFileDeleted = (path) => {
    firebase_functions_1.logger.log(`Deleted temporary original file: '${path}'`);
};
exports.tempOriginalFileDeleting = (path) => {
    firebase_functions_1.logger.log(`Deleting temporary original file: '${path}'`);
};
exports.tempResizedFileDeleted = (path) => {
    firebase_functions_1.logger.log(`Deleted temporary resized file: '${path}'`);
};
exports.tempResizedFileDeleting = (path) => {
    firebase_functions_1.logger.log(`Deleting temporary resized file: '${path}'`);
};
exports.remoteFileDeleted = (path) => {
    firebase_functions_1.logger.log(`Deleted original file from storage bucket: '${path}'`);
};
exports.remoteFileDeleting = (path) => {
    firebase_functions_1.logger.log(`Deleting original file from storage bucket: '${path}'`);
};
