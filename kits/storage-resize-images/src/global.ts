/**
 * Copyright 2026 Google LLC
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
