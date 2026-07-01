import PQueue from "p-queue";

export const SUPPORTED_CONTENT_TYPES = [
  "image/jpg",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

export const SUPPORTED_IMAGE_CONTENT_TYPE_MAP = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  tif: "image/tif",
  tiff: "image/tiff",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  jfif: "image/jpeg",
} as const satisfies Record<string, string>;

export const SUPPORTED_EXTENSIONS = Object.keys(
  SUPPORTED_IMAGE_CONTENT_TYPE_MAP
).map((type) => `.${type}`);

export type RetryQueueItem = {
  priority: number;
  task: () => Promise<unknown>;
};

export const GLOBAL_RETRY_QUEUE = new PQueue({
  concurrency: 3,
  autoStart: true,
});
