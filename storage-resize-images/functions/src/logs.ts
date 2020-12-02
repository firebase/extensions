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

import { logger } from "firebase-functions";
import config from "./config";

export const complete = () => {
  logger.log("Completed execution of extension");
};

export const noContentType = () => {
  logger.log(`File has no Content-Type, no processing is required`);
};

export const gzipContentEncoding = () => {
  logger.log("Images encoded with 'gzip' are not supported by this extension");
};

export const contentTypeInvalid = (contentType: string) => {
  logger.log(
    `File of type '${contentType}' is not an image, no processing is required`
  );
};

export const unsupportedType = (
  unsupportedTypes: string[],
  contentType: string
) => {
  logger.log(
    `Image type '${contentType}' is not supported, here are the supported file types: ${unsupportedTypes.join(
      ", "
    )}`
  );
};

export const error = (err: Error) => {
  logger.error("Error when resizing image", err);
};

export const errorDeleting = (err: Error) => {
  logger.warn("Error when deleting temporary files", err);
};

export const failed = () => {
  logger.log("Failed execution of extension");
};

export const imageAlreadyResized = () => {
  logger.log("File is already a resized image, no processing is required");
};

export const imageOutsideOfPaths = (
  absolutePaths: string[],
  imagePath: string
) => {
  console.log(
    `Image path '${imagePath}' is not supported, these are the supported absolute paths: ${absolutePaths.join(
      ", "
    )}`
  );
};

export const imageInsideOfExcludedPaths = (
  absolutePaths: string[],
  imagePath: string
) => {
  console.log(
    `Image path '${imagePath}' is not supported, these are the not supported absolute paths: ${absolutePaths.join(
      ", "
    )}`
  );
};

export const imageDownloaded = (remotePath: string, localPath: string) => {
  logger.log(`Downloaded image file: '${remotePath}' to '${localPath}'`);
};

export const imageDownloading = (path: string) => {
  logger.log(`Downloading image file: '${path}'`);
};

export const imageConverting = (
  originalImageType: string,
  imageType: string
) => {
  console.log(
    `Converting image from type, ${originalImageType}, to type ${imageType}.`
  );
};

export const imageConverted = (imageType: string) => {
  console.log(`Converted image to ${imageType}`);
};

export const imageResized = (path: string) => {
  logger.log(`Resized image created at '${path}'`);
};

export const imageResizing = (path: string, size: string) => {
  logger.log(`Resizing image at path '${path}' to size: ${size}`);
};

export const imageUploaded = (path: string) => {
  logger.log(`Uploaded resized image to '${path}'`);
};

export const imageUploading = (path: string) => {
  logger.log(`Uploading resized image to '${path}'`);
};

export const init = () => {
  logger.log("Initializing extension with configuration", config);
};

export const start = () => {
  logger.log("Started execution of extension with configuration", config);
};

export const tempDirectoryCreated = (directory: string) => {
  logger.log(`Created temporary directory: '${directory}'`);
};

export const tempDirectoryCreating = (directory: string) => {
  logger.log(`Creating temporary directory: '${directory}'`);
};

export const tempOriginalFileDeleted = (path: string) => {
  logger.log(`Deleted temporary original file: '${path}'`);
};

export const tempOriginalFileDeleting = (path: string) => {
  logger.log(`Deleting temporary original file: '${path}'`);
};

export const tempResizedFileDeleted = (path: string) => {
  logger.log(`Deleted temporary resized file: '${path}'`);
};

export const tempResizedFileDeleting = (path: string) => {
  logger.log(`Deleting temporary resized file: '${path}'`);
};

export const remoteFileDeleted = (path: string) => {
  logger.log(`Deleted original file from storage bucket: '${path}'`);
};

export const remoteFileDeleting = (path: string) => {
  logger.log(`Deleting original file from storage bucket: '${path}'`);
};
