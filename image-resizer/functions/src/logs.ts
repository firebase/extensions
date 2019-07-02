import config from "./config";

export const contentTypeInvalid = (contentType: string) => {
  console.log(
    `File of type '${contentType}' is not an image, no processing is required`
  );
};

export const error = (err: Error) => {
  console.error("Error resizing image", err);
};

export const errorDeleting = (err: Error) => {
  console.warn("There was a problem deleting temporary files", err);
};

export const imageAlreadyResized = () => {
  console.log("File is already a resized image, no processing is required");
};

export const imageDownloaded = (remotePath: string, localPath: string) => {
  console.log(`Downloaded image file: '${remotePath}' to '${localPath}'`);
};

export const imageDownloading = (path: string) => {
  console.log(`Downloading image file: '${path}'`);
};

export const imageResized = (path: string) => {
  console.log(`Resized image created at '${path}'`);
};

export const imageResizing = (width: string, height: string) => {
  console.log(`Resizing image file to size: ${width}x${height}`);
};

export const imageUploaded = (path: string) => {
  console.log(`Uploaded resized image to '${path}'`);
};

export const imageUploading = (path: string) => {
  console.log(`Uploading resized image to '${path}'`);
};

export const init = () => {
  console.log("Initialising mod with configuration", config);
};

export const signedUrlsGenerated = () => {
  console.log("Generated Signed URLs");
};

export const signedUrlsGenerating = () => {
  console.log("Generating signed URLs");
};

export const signedUrlsNotConfigured = () => {
  console.log("Signed URLS are not configured, skipping");
};

export const signedUrlsSaved = (path: string) => {
  console.log(`Saved signed URLs to database at: '${path}'`);
};

export const signedUrlsSaving = (path: string) => {
  console.log(`Saving signed URLs in database at: '${path}'`);
};

export const start = () => {
  console.log("Started mod execution with configuration", config);
};

export const tempDirectoryCreated = (directory: string) => {
  console.log(`Created temporary directory: '${directory}'`);
};

export const tempDirectoryCreating = (directory: string) => {
  console.log(`Creating temporary directory: '${directory}'`);
};

export const tempFilesDeleted = () => {
  console.log("Deleted temporary files");
};

export const tempFilesDeleting = () => {
  console.log("Deleting temporary files");
};
