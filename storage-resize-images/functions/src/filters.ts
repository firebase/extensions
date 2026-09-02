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

import * as path from "path";

import * as logs from "./logs";
import { config } from "./config";
import { supportedContentTypes } from "./global";
import { convertPathToPosix, startsWithArray } from "./util";
import { ObjectMetadata } from "firebase-functions/v1/storage";

export function shouldResize(object: ObjectMetadata): boolean {
  const { contentType } = object; // This is the image MIME type

  let tmpFilePath = convertPathToPosix(
    path.resolve("/", path.dirname(object.name)),
    true
  ); // Absolute path to dirname

  if (!contentType) {
    logs.noContentType();
    return false;
  }

  if (!contentType.startsWith("image/")) {
    logs.contentTypeInvalid(contentType);
    return false;
  }

  if (object.contentEncoding === "gzip") {
    logs.gzipContentEncoding();
    return false;
  }

  if (!supportedContentTypes.includes(contentType)) {
    logs.unsupportedType(supportedContentTypes, contentType);
    return false;
  }

  if (
    config.includePathList &&
    !startsWithArray(config.includePathList, tmpFilePath)
  ) {
    logs.imageOutsideOfPaths(config.includePathList, tmpFilePath);
    return false;
  }

  if (
    config.excludePathList &&
    startsWithArray(config.excludePathList, tmpFilePath)
  ) {
    logs.imageInsideOfExcludedPaths(config.excludePathList, tmpFilePath);
    return false;
  }

  // Skip if this is a resized image we created previously. Some uploads may
  // store custom metadata as a boolean (true) rather than string "true",
  // so handle both to ensure idempotence.
  if (
    object.metadata &&
    (object.metadata.resizedImage === "true" ||
      (object.metadata as any).resizedImage === true)
  ) {
    logs.imageAlreadyResized();
    return false;
  }
  if (object.metadata && object.metadata.resizeFailed) {
    logs.imageFailedAttempt();
    return false;
  }

  return true;
}
