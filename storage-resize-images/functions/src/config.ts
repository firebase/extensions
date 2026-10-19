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
import { supportedImageContentTypeMap } from "./global";

export type SafetyThreshold =
  | "BLOCK_LOW_AND_ABOVE"
  | "BLOCK_MEDIUM_AND_ABOVE"
  | "BLOCK_ONLY_HIGH"
  | "BLOCK_NONE";

export enum deleteImage {
  always = 0,
  never,
  onSuccess,
}

function deleteOriginalFile(deleteType) {
  switch (deleteType) {
    case "true":
      return deleteImage.always;
    case "false":
      return deleteImage.never;
    default:
      return deleteImage.onSuccess;
  }
}

function paramToArray(param) {
  return typeof param === "string" ? param.split(",") : undefined;
}

/**
 * IMAGE_TYPE value that keeps the original file type instead of converting
 * to a preferred type. See extension.yaml for the declared options.
 */
const KEEP_ORIGINAL_IMAGE_TYPE = "false";

const supportedImageTypes = new Set([
  ...Object.keys(supportedImageContentTypeMap),
  KEEP_ORIGINAL_IMAGE_TYPE,
]);

/**
 * Parses the IMAGE_TYPE parameter and rejects values that are not a
 * supported image type. Without this check, an out-of-band value (for
 * example from a hand-edited .env file) silently produces an unconverted
 * file with a bogus extension instead of failing fast.
 *
 * Empty entries are ignored: they are what a deployed function receives
 * when the multiSelect parameter has nothing selected.
 */
function paramToImageTypes(param) {
  const imageTypes = paramToArray(param)?.filter(
    (imageType) => imageType !== ""
  );
  if (imageTypes) {
    const invalidTypes = imageTypes.filter(
      (imageType) => !supportedImageTypes.has(imageType)
    );
    if (invalidTypes.length > 0) {
      throw new Error(
        `Invalid IMAGE_TYPE value(s): ${invalidTypes.join(
          ", "
        )}. Supported values are: ${Array.from(supportedImageTypes).join(
          ", "
        )}.`
      );
    }
  }
  return imageTypes;
}

function allowAnimated(sharpOptions = "{}", overrideIsAnimated) {
  const ops = JSON.parse(sharpOptions);
  if (ops && ops.animated) {
    return true;
  }

  return overrideIsAnimated === "true" || undefined ? true : false;
}

const harmBlockThresholdMap: Record<string, SafetyThreshold | null> = {
  BLOCK_LOW_AND_ABOVE: "BLOCK_LOW_AND_ABOVE",
  BLOCK_MEDIUM_AND_ABOVE: "BLOCK_MEDIUM_AND_ABOVE",
  BLOCK_ONLY_HIGH: "BLOCK_ONLY_HIGH",
  OFF: null,
};

export const convertHarmBlockThreshold = (
  level?: string
): SafetyThreshold | null => {
  if (!level) {
    return null;
  }

  if (level in harmBlockThresholdMap) {
    return harmBlockThresholdMap[level];
  }
  throw new Error(`Invalid HarmBlockThreshold: ${level}`);
};

export const config = {
  bucket: process.env.IMG_BUCKET,
  cacheControlHeader: process.env.CACHE_CONTROL_HEADER,
  // Backfill feature disabled - commented out to preserve code
  // doBackfill: process.env.DO_BACKFILL === "true",
  imageSizes: process.env.IMG_SIZES.split(","),
  regenerateToken: process.env.REGENERATE_TOKEN == "true",
  makePublic: process.env.MAKE_PUBLIC === "true",
  resizedImagesPath: process.env.RESIZED_IMAGES_PATH,
  includePathList: paramToArray(process.env.INCLUDE_PATH_LIST),
  excludePathList: paramToArray(process.env.EXCLUDE_PATH_LIST),
  failedImagesPath: process.env.FAILED_IMAGES_PATH,
  deleteOriginalFile: deleteOriginalFile(process.env.DELETE_ORIGINAL_FILE),
  imageTypes: paramToImageTypes(process.env.IMAGE_TYPE),
  sharpOptions: process.env.SHARP_OPTIONS || "{}",
  outputOptions: process.env.OUTPUT_OPTIONS,
  animated: allowAnimated(process.env.SHARP_OPTIONS, process.env.IS_ANIMATED),
  location: process.env.LOCATION,
  projectId: process.env.PROJECT_ID,
  contentFilterLevel: convertHarmBlockThreshold(
    process.env.CONTENT_FILTER_LEVEL
  ),
  customFilterPrompt: process.env.CUSTOM_FILTER_PROMPT || null,
  placeholderImagePath: process.env.PLACEHOLDER_IMAGE_PATH || null,
  // backfillBatchSize: Number(process.env.BACKFILL_BATCH_SIZE) || 3,
};

export type Config = typeof config;
