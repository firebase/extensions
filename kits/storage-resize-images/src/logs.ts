import { logger } from "firebase-functions";
import type { ResolvedResizeImagesConfig } from "./export-config";

export const complete = (): void =>
  logger.log("Completed execution of extension");
export const noContentType = (): void =>
  logger.log("File has no Content-Type, no processing is required");
export const gzipContentEncoding = (): void =>
  logger.log("Images encoded with 'gzip' are not supported by this extension");
export const contentTypeInvalid = (contentType: string): void =>
  logger.log(
    `File of type '${contentType}' is not an image, no processing is required`
  );
export const unsupportedType = (
  unsupportedTypes: ReadonlyArray<string>,
  contentType: string
): void =>
  logger.log(
    `Image type '${contentType}' is not supported, here are the supported file types: ${unsupportedTypes.join(
      ", "
    )}`
  );
export const error = (err: unknown): void =>
  logger.error("Error when resizing image", err);
export const errorDeleting = (err: unknown): void =>
  logger.warn("Error when deleting files", err);
export const failed = (): void => logger.error("Failed execution of extension");
export const imageAlreadyResized = (): void =>
  logger.log("File is already a resized image, no processing is required");
export const imageFailedAttempt = (): void =>
  logger.log(
    "File is a copy of an image which failed to resize, no processing is required"
  );
export const imageOutsideOfPaths = (
  absolutePaths: ReadonlyArray<string>,
  imagePath: string
): void =>
  logger.log(
    `Image path '${imagePath}' is not supported, these are the supported absolute paths: ${absolutePaths.join(
      ", "
    )}`
  );
export const imageInsideOfExcludedPaths = (
  absolutePaths: ReadonlyArray<string>,
  imagePath: string
): void =>
  logger.log(
    `Image path '${imagePath}' is not supported, these are the not supported absolute paths: ${absolutePaths.join(
      ", "
    )}`
  );
export const imageDownloaded = (remotePath: string, localPath: string): void =>
  logger.log(`Downloaded image file: '${remotePath}' to '${localPath}'`);
export const imageDownloading = (path: string): void =>
  logger.log(`Downloading image file: '${path}'`);
export const imageConverting = (
  originalImageType: string,
  imageType: string
): void =>
  logger.log(
    `Converting image from type, ${originalImageType}, to type ${imageType}.`
  );
export const imageConverted = (imageType: string): void =>
  logger.log(`Converted image to ${imageType}`);
export const imageResized = (path: string): void =>
  logger.log(`Resized image created at '${path}'`);
export const imageResizing = (path: string, size: string): void =>
  logger.log(`Resizing image at path '${path}' to size: ${size}`);
export const imageUploaded = (path: string): void =>
  logger.log(`Uploaded resized image to '${path}'`);
export const imageUploading = (path: string): void =>
  logger.log(`Uploading resized image to '${path}'`);
export const init = (config: ResolvedResizeImagesConfig): void =>
  logger.log("Initializing extension with configuration", config);
export const start = (config: ResolvedResizeImagesConfig): void =>
  logger.log("Started execution of extension with configuration", config);
export const tempDirectoryCreated = (directory: string): void =>
  logger.log(`Created temporary directory: '${directory}'`);
export const tempDirectoryCreating = (directory: string): void =>
  logger.log(`Creating temporary directory: '${directory}'`);
export const tempOriginalFileDeleted = (path: string): void =>
  logger.log(`Deleted temporary original file: '${path}'`);
export const tempOriginalFileDeleting = (path: string): void =>
  logger.log(`Deleting temporary original file: '${path}'`);
export const tempResizedFileDeleted = (path: string): void =>
  logger.log(`Deleted temporary resized file: '${path}'`);
export const tempResizedFileDeleting = (path: string): void =>
  logger.log(`Deleting temporary resized file: '${path}'`);
export const remoteFileDeleted = (path: string): void =>
  logger.log(`Deleted original file from storage bucket: '${path}'`);
export const remoteFileDeleting = (path: string): void =>
  logger.log(`Deleting original file from storage bucket: '${path}'`);
export const errorOutputOptionsParse = (err: unknown): void =>
  logger.error(
    'Error while parsing "Output options for selected format". Parameter will be ignored',
    err
  );
export const failedImageUploading = (path: string): void =>
  logger.log(
    `Uploading failed image to the failed images directory: '${path}'`
  );
export const failedImageUploaded = (path: string): void =>
  logger.log(`Uploaded failed image to the failed images directory: '${path}'`);
export const errorConstuctorOptionsParse = (err: unknown): void =>
  logger.warn(
    'Error while parsing "Constructor options". Parameter will be ignored',
    err
  );
export const invalidFailedResizePath = (
  failedFilePath: string,
  config: ResolvedResizeImagesConfig
): void =>
  logger.warn(
    `Cannot upload failed resize image '${failedFilePath}' in the failed images directory (${config.failedImagesPath})`
  );
export const contentFilterBlocked = (): void =>
  logger.warn("Image content blocked by Vertex AI content filters.");
export const customFilterBlocked = (): void =>
  logger.warn("Image content blocked by Custom AI Content filter.");
export const contentFilterError = (
  err: unknown,
  attempt: number,
  maxAttempts: number
): void =>
  logger.warn(
    `Unexpected Error whilst evaluating content of image with Gemini (Attempt ${attempt}/${maxAttempts}). `,
    err
  );
export const contentFilterFailed = (err: unknown): void =>
  logger.error(
    `Failed to evaluate image content after multiple attempts: ${err}`
  );
export const contentFilterRejected = (imageName: string): void =>
  logger.warn(`Image ${imageName} was rejected by the content filter.`);
export const placeholderReplaceError = (err: unknown): void =>
  logger.error("Error replacing with placeholder:", err);
export const retryScheduled = (
  attemptNumber: number,
  maxAttempts: number,
  backoffTime: number
): void =>
  logger.warn(
    `Scheduling content filter retry in ${Math.round(
      backoffTime / 1000
    )}s (Attempt ${attemptNumber}/${maxAttempts})`
  );
export const replacingWithConfiguredPlaceholder = (
  placeholderPath: string
): void =>
  logger.log(
    `Replacing filtered image with configured placeholder: ${placeholderPath}`
  );
export const replacingWithDefaultPlaceholder = (): void =>
  logger.log("Replacing filtered image with default placeholder");
export const placeholderReplaceComplete = (imagePath: string): void =>
  logger.log(
    `Successfully replaced filtered image with placeholder at: ${imagePath}`
  );
export const contentFilterErrored = (err: unknown): void =>
  logger.error(`Error during content filtering: ${err}`);
