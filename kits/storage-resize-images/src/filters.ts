import * as path from "node:path";

import type { ResolvedResizeImagesConfig } from "./export-config";
import { SUPPORTED_CONTENT_TYPES } from "./global";
import * as logs from "./logs";
import {
  convertPathToPosix,
  type StorageObjectMetadata,
  startsWithArray,
} from "./util";

export function shouldResize(
  object: StorageObjectMetadata,
  config: ResolvedResizeImagesConfig
): boolean {
  const { contentType } = object;
  const tmpFilePath = convertPathToPosix(
    path.resolve("/", path.dirname(object.name)),
    true
  );

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

  if (
    !SUPPORTED_CONTENT_TYPES.includes(
      contentType as (typeof SUPPORTED_CONTENT_TYPES)[number]
    )
  ) {
    logs.unsupportedType(SUPPORTED_CONTENT_TYPES, contentType);
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

  if (object.metadata?.resizedImage === "true") {
    logs.imageAlreadyResized();
    return false;
  }

  if (object.metadata?.resizeFailed) {
    logs.imageFailedAttempt();
    return false;
  }

  return true;
}
