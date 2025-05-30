import PQueue from "p-queue";

/**
 * Supported file types
 */
export const supportedContentTypes = [
  "image/jpg",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/webp",
  "image/gif",
  "image/avif",
];

export const supportedImageContentTypeMap = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  tif: "image/tif",
  tiff: "image/tiff",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  jfif: "image/jpeg",
};

export const supportedExtensions = Object.keys(
  supportedImageContentTypeMap
).map((type) => `.${type}`);

export type RetryQueueItem = {
  priority: number;
  task: () => Promise<any>;
};

export const globalRetryQueue = new PQueue({ concurrency: 3, autoStart: true });
