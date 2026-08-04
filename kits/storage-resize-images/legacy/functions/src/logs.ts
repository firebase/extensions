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
import { Config } from "./config";

export const complete = () => {
  logger.log("Completed execution of extension");
};

export const noContentType = () => {
  logger.log("File has no Content-Type, no processing is required");
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
  logger.warn("Error when deleting files", err);
};

export const failed = () => {
  logger.error("Failed execution of extension");
};

export const imageAlreadyResized = () => {
  logger.log("File is already a resized image, no processing is required");
};

export const imageFailedAttempt = () => {
  logger.log(
    "File is a copy of an image which failed to resize, no processing is required"
  );
};

export const imageOutsideOfPaths = (
  absolutePaths: string[],
  imagePath: string
) => {
  logger.log(
    `Image path '${imagePath}' is not supported, these are the supported absolute paths: ${absolutePaths.join(
      ", "
    )}`
  );
};

export const imageInsideOfExcludedPaths = (
  absolutePaths: string[],
  imagePath: string
) => {
  logger.log(
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
  logger.log(
    `Converting image from type, ${originalImageType}, to type ${imageType}.`
  );
};

export const imageConverted = (imageType: string) => {
  logger.log(`Converted image to ${imageType}`);
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

export const init = (config: Config) => {
  logger.log("Initializing extension with configuration", config);
};

export const start = (config: Config) => {
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

export const errorOutputOptionsParse = (err: any) => {
  logger.error(
    `Error while parsing "Output options for selected format". Parameter will be ignored`,
    err
  );
};

export const startBackfill = () => {
  logger.log("Starting backfill job. Checking for existing images to resize.");
};

export const continueBackfill = (fileName: string) => {
  logger.log(`Checking if '${fileName}' needs to resized`);
};

export const backfillComplete = (success: number, failures: number) => {
  logger.log(
    `Finished backfill. Successfully resized ${success} images. Failed to resize ${failures} images.`
  );
};
export const failedImageUploading = (path: string) => {
  logger.log(
    `Uploading failed image to the failed images directory: '${path}'`
  );
};

export const failedImageUploaded = (path: string) => {
  logger.log(`Uploaded failed image to the failed images directory: '${path}'`);
};

export function errorConstuctorOptionsParse(err: any) {
  logger.warn(
    `Error while parsing "Constructor options". Parameter will be ignored`,
    err
  );
}

export function invalidFailedResizePath(
  failedFilePath: string,
  config: Config
) {
  logger.warn(
    `Cannot upload failed resize image '${failedFilePath}' in the failed images directory (${config.failedImagesPath})`
  );
}

// Content filter specific logging functions
export const contentFilterBlocked = () => {
  logger.warn("Image content blocked by Vertex AI content filters.");
};

export const customFilterBlocked = () => {
  logger.warn("Image content blocked by Custom AI Content filter.");
};

export const contentFilterError = (
  err: Error,
  attempt: number,
  maxAttempts: number
) => {
  logger.warn(
    `Unexpected Error whilst evaluating content of image with Gemini (Attempt ${attempt}/${maxAttempts}). `,
    err
  );
};

export const contentFilterFailed = (err: Error) => {
  logger.error(
    `Failed to evaluate image content after multiple attempts: ${err}`
  );
};

export const contentFilterStart = (
  filterLevel: string | null,
  hasCustomPrompt: boolean
) => {
  if (filterLevel === null && !hasCustomPrompt) {
    logger.log("Content filtering disabled, skipping check");
  } else {
    logger.log(
      `Starting content filtering with level: ${
        filterLevel || "NONE"
      }, custom prompt: ${hasCustomPrompt ? "YES" : "NO"}`
    );
  }
};

export const contentFilterRejected = (imageName: string) => {
  logger.warn(`Image ${imageName} was rejected by the content filter.`);
};

export const placeholderReplaceError = (err: Error) => {
  logger.error(`Error replacing with placeholder:`, err);
};

export const retryScheduled = (
  attemptNumber: number,
  maxAttempts: number,
  backoffTime: number
) => {
  logger.warn(
    `Scheduling content filter retry in ${Math.round(
      backoffTime / 1000
    )}s (Attempt ${attemptNumber}/${maxAttempts})`
  );
};

// Image data URL operations
export const imageDataUrlCreated = (filePath: string) => {
  logger.log(`Created data URL from image: ${filePath}`);
};

// Vertex AI operations
export const vertexAiInitialized = () => {
  logger.log("Initialized Vertex AI client for content checking");
};

// Safety settings
export const safetySettingsCreated = (filterLevel: string) => {
  logger.log(`Created safety settings with filter level: ${filterLevel}`);
};

// General utility logging
export const operationStart = (operation: string) => {
  logger.log(`Starting operation: ${operation}`);
};

export const operationComplete = (operation: string) => {
  logger.log(`Completed operation: ${operation}`);
};

export const configValueUsed = (configName: string, value: any) => {
  logger.log(`Using configuration value for ${configName}: ${value}`);
};

// Placeholder image handling
export const replacingWithConfiguredPlaceholder = (placeholderPath: string) => {
  logger.log(
    `Replacing filtered image with configured placeholder: ${placeholderPath}`
  );
};

export const replacingWithDefaultPlaceholder = () => {
  logger.log("Replacing filtered image with default placeholder");
};

export const placeholderReplaceComplete = (imagePath: string) => {
  logger.log(
    `Successfully replaced filtered image with placeholder at: ${imagePath}`
  );
};

export const contentFilterErrored = (err: Error) => {
  logger.error(`Error during content filtering: ${err}`);
};
