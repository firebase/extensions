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

import {
  BUCKET_PICKER,
  defineBoolean,
  defineInt,
  defineList,
  defineString,
  multiSelect,
  projectID,
  select,
  storageBucket,
} from "firebase-functions/params";
import {
  validateAbsolutePathList,
  type DeleteOriginalFile,
  type ResizeImagesConfig,
} from "./export-config";

const IMAGE_TYPE_OPTIONS = [
  "jpeg",
  "webp",
  "png",
  "tiff",
  "gif",
  "avif",
  "false",
] as const;
const MEMORY_OPTIONS = [512, 1024, 2048, 4096, 8192] as const;
const CONTENT_FILTER_OPTIONS = [
  "OFF",
  "BLOCK_ONLY_HIGH",
  "BLOCK_MEDIUM_AND_ABOVE",
  "BLOCK_LOW_AND_ABOVE",
] as const;
const ABSOLUTE_PATH_LIST_VALIDATION = {
  validationRegex: /^(?:(\/[^\s\/\,]+)+(\,(\/[^\s\/\,]+)+)*|)$/,
  validationErrorMessage:
    "Invalid paths, must be a comma-separated list of absolute path values.",
};

function absolutePathListInput(example: string) {
  return {
    text: {
      example,
      ...ABSOLUTE_PATH_LIST_VALIDATION,
    },
  };
}

const params = {
  bucket: defineString("IMG_BUCKET", {
    default: storageBucket,
    input: BUCKET_PICKER,
  }),
  sizes: defineString("IMG_SIZES", {
    default: "200x200",
    input: {
      text: {
        validationRegex: /^\d+x(\d+,\d+x)*\d+$/,
        validationErrorMessage:
          "Invalid sizes, must be a comma-separated list of WIDTHxHEIGHT values.",
      },
    },
  }),
  deleteOriginal: defineString("DELETE_ORIGINAL_FILE", {
    default: "false",
    input: select({
      "Don't delete": "false",
      "Delete on any resize attempt": "true",
      "Delete only on successful resize attempts": "on_success",
    }),
  }),
  makePublic: defineBoolean("MAKE_PUBLIC", {
    default: false,
  }),
  resizedImagesPath: defineString("RESIZED_IMAGES_PATH", { default: "" }),
  includePathList: defineString("INCLUDE_PATH_LIST", {
    default: "",
    input: absolutePathListInput("/users/avatars,/design/pictures"),
  }),
  excludePathList: defineString("EXCLUDE_PATH_LIST", {
    default: "",
    input: absolutePathListInput(
      "/users/avatars/thumbs,/design/pictures/thumbs"
    ),
  }),
  failedImagesPath: defineString("FAILED_IMAGES_PATH", {
    default: "",
    input: {
      text: {
        validationRegex: /^([^\/.]*|)$/,
        validationErrorMessage: 'Values cannot include "/", ".".',
      },
    },
  }),
  cacheControlHeader: defineString("CACHE_CONTROL_HEADER", { default: "" }),
  imageTypes: defineList("IMAGE_TYPE", {
    default: ["false"],
    input: multiSelect([...IMAGE_TYPE_OPTIONS]),
  }),
  outputOptions: defineString("OUTPUT_OPTIONS", {
    default: "",
    input: {
      text: {
        // Extension regex, with an empty branch added: the param is optional.
        validationRegex: /^(?:({(.*?)})|)$/,
        validationErrorMessage: "Please provide a valid JSON object.",
      },
    },
  }),
  sharpOptions: defineString("SHARP_OPTIONS", {
    default: "{}",
    input: {
      text: {
        // Extension regex, with an empty branch added: the param is optional.
        validationRegex: /^(?:({(.*?)})|)$/,
        validationErrorMessage: "Please provide a valid JSON object.",
      },
    },
  }),
  isAnimated: defineBoolean("IS_ANIMATED", {
    default: true,
  }),
  memory: defineInt("FUNCTION_MEMORY", {
    default: 1024,
    input: select([...MEMORY_OPTIONS]),
  }),
  regenerateToken: defineBoolean("REGENERATE_TOKEN", {
    default: true,
  }),
  contentFilterLevel: defineString("CONTENT_FILTER_LEVEL", {
    default: "OFF",
    input: select([...CONTENT_FILTER_OPTIONS]),
  }),
  customFilterPrompt: defineString("CUSTOM_FILTER_PROMPT", { default: "" }),
  placeholderImagePath: defineString("PLACEHOLDER_IMAGE_PATH", {
    default: "",
    input: {
      text: {
        // Extension regex, with an empty branch added: the param is optional.
        validationRegex:
          /^(?:([a-zA-Z0-9_\-\.\/]+)\.(png|jpg|jpeg|gif|webp)|)$/,
        validationErrorMessage:
          "Please provide a valid image path within your bucket.",
      },
    },
  }),
};

export const CONFIG_EXPRESSIONS = {
  bucket: params.bucket,
  memory: params.memory,
} as const;

export function validatePathListsFromEnv(): void {
  validateAbsolutePathList(process.env.INCLUDE_PATH_LIST, "includePathList");
  validateAbsolutePathList(process.env.EXCLUDE_PATH_LIST, "excludePathList");
}

function optional(value: string): string | undefined {
  return value.length > 0 ? value : undefined;
}

export function configFromEnv(): ResizeImagesConfig {
  return {
    bucket: params.bucket.value(),
    sizes: params.sizes.value(),
    deleteOriginal: params.deleteOriginal.value() as DeleteOriginalFile,
    makePublic: params.makePublic.value(),
    resizedImagesPath: optional(params.resizedImagesPath.value()),
    includePathList: optional(params.includePathList.value()),
    excludePathList: optional(params.excludePathList.value()),
    failedImagesPath: optional(params.failedImagesPath.value()),
    cacheControlHeader: optional(params.cacheControlHeader.value()),
    imageTypes: params.imageTypes.value(),
    outputOptions: optional(params.outputOptions.value()),
    sharpOptions: params.sharpOptions.value(),
    isAnimated: params.isAnimated.value(),
    memory: params.memory.value(),
    regenerateToken: params.regenerateToken.value(),
    contentFilterLevel:
      params.contentFilterLevel.value() as ResizeImagesConfig["contentFilterLevel"],
    customFilterPrompt: optional(params.customFilterPrompt.value()),
    placeholderImagePath: optional(params.placeholderImagePath.value()),
    region: process.env.FUNCTION_REGION,
    projectId: projectID.value(),
  };
}
