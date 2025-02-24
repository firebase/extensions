import * as path from "path";

import * as logs from "./logs";
import { config } from "./config";
import { supportedContentTypes } from "./resize-image";
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

  if (object.metadata && object.metadata.resizedImage === "true") {
    logs.imageAlreadyResized();
    return false;
  }
  if (object.metadata && object.metadata.resizeFailed) {
    logs.imageFailedAttempt();
    return false;
  }

  return true;
}
