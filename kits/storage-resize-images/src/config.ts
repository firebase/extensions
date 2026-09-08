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
    label: "Cloud Storage bucket for images",
    description:
      "To which Cloud Storage bucket will you upload images that you want to resize? Resized images will be stored in this bucket. Depending on your extension configuration, original images are either kept or deleted. It is recommended to create a separate bucket for this extension. For more information, refer to the [pre-installation guide](https://firebase.google.com/products/extensions/storage-resize-images).",

    default: storageBucket,
    input: BUCKET_PICKER,
  }),
  sizes: defineString("IMG_SIZES", {
    label: "Sizes of resized images",
    description:
      "What sizes of images would you like (in pixels)? Enter the sizes as a comma-separated list of WIDTHxHEIGHT values. Learn more about [how this parameter works](https://firebase.google.com/products/extensions/storage-resize-images).",

    default: "200x200",
    input: {
      text: {
        example: "200x200",

        validationRegex: /^\d+x(\d+,\d+x)*\d+$/,
        validationErrorMessage:
          "Invalid sizes, must be a comma-separated list of WIDTHxHEIGHT values.",
      },
    },
  }),
  deleteOriginal: defineString("DELETE_ORIGINAL_FILE", {
    label: "Deletion of original file",
    description:
      "Do you want to automatically delete the original file from the Cloud Storage bucket? Warning: these deletions cannot be undone.",

    default: "false",
    input: select({
      "Don't delete": "false",
      "Delete on any resize attempt": "true",
      "Delete only on successful resize attempts": "on_success",
    }),
  }),
  makePublic: defineBoolean("MAKE_PUBLIC", {
    label: "Make resized images public",
    description:
      "Do you want to make the resized images public automatically? So you can access them by URL. For example: https://storage.googleapis.com/{bucket}/{path}",

    default: false,
  }),
  resizedImagesPath: defineString("RESIZED_IMAGES_PATH", {
    label: "Cloud Storage path for resized images",
    description:
      "A relative path in which to store resized images. For example, if you specify a path here of `thumbs` and you upload an image to `/images/original.jpg`, then the resized image is stored at `/images/thumbs/original_200x200.jpg`. If you prefer to store resized images at the root of your bucket, leave this field empty.",
    default: "",
    input: { text: { example: "thumbnails" } },
  }),
  includePathList: defineString("INCLUDE_PATH_LIST", {
    label: "Paths that contain images you want to resize",
    description:
      "Restrict storage-resize-images to only resize images in specific locations in your Storage bucket by  supplying a comma-separated list of absolute paths. For example, specifying the paths `/users/pictures,/restaurants/menuItems` will resize any images found in any subdirectories of `/users/pictures` and `/restaurants/menuItems`.\nYou may also use wildcard notation for directories in the path. For example, `/users/*/pictures` would include any images in any subdirectories of `/users/foo/pictures` as well as any images in subdirectories of `/users/bar/pictures`, but also any images in subdirectories of `/users/any/level/of/subdirectories/pictures`. \nIf you prefer not to explicitly restrict to certain directories of your Storage bucket, leave this field empty.",

    default: "",
    input: absolutePathListInput("/users/avatars,/design/pictures"),
  }),
  excludePathList: defineString("EXCLUDE_PATH_LIST", {
    label: "List of absolute paths not included for resized images",
    description:
      "Ensure storage-resize-images does *not* resize images in _specific locations_ in your Storage bucket by  supplying a comma-separated list of absolute paths. For example, to *exclude* the images  stored in the `/foo/alpha` and its subdirectories and `/bar/beta` and its subdirectories, specify the paths `/foo/alpha,/bar/beta`.\nYou may also use wildcard notation for directories in the path. For example, `/users/*/pictures` would exclude any images in any subdirectories of `/users/foo/pictures` as well as any images in subdirectories of `/users/bar/pictures`, but also any images in subdirectories of `/users/any/level/of/subdirectories/pictures`.\nIf you prefer to resize every image uploaded to your Storage bucket, leave this field empty.",

    default: "",
    input: absolutePathListInput(
      "/users/avatars/thumbs,/design/pictures/thumbs"
    ),
  }),
  failedImagesPath: defineString("FAILED_IMAGES_PATH", {
    label: "Cloud Storage path for failed images",
    description:
      "A relative path in which to store failed images. For example, if you specify a path here of `failed` and you upload an image to `/images/original.jpg`, then resizing failed, the image will be stored at `/images/failed/original.jpg`.\nLeave this field empty if you do not want to store failed images in a separate directory.",

    default: "",
    input: {
      text: {
        example: "failed",

        validationRegex: /^([^\/.]*|)$/,
        validationErrorMessage: 'Values cannot include "/", ".".',
      },
    },
  }),
  cacheControlHeader: defineString("CACHE_CONTROL_HEADER", {
    label: "Cache-Control header for resized images",
    description:
      "This extension automatically copies any `Cache-Control` metadata from the original image to the resized images. For the resized images, do you want to overwrite this copied `Cache-Control` metadata or add `Cache-Control` metadata? Learn more about [`Cache-Control` headers](https://developer.mozilla.org/docs/Web/HTTP/Headers/Cache-Control). If you prefer not to overwrite or add `Cache-Control` metadata, leave this field empty.",
    default: "",
    input: { text: { example: "max-age=86400" } },
  }),
  imageTypes: defineList("IMAGE_TYPE", {
    label: "Convert image to preferred types",
    description:
      "The image types you'd like your source image to convert to.  The default for this option will be to keep the original file type as the destination file type.",

    default: ["false"],
    input: multiSelect({
      jpeg: "jpeg",
      webp: "webp",
      png: "png",
      tiff: "tiff",
      gif: "gif",
      avif: "avif",
      original: "false",
    }),
  }),
  outputOptions: defineString("OUTPUT_OPTIONS", {
    label: "Output options for selected formats",
    description:
      'Provide an optional output option as a stringified object containing Sharp Output Options for selected image types conversion. eg. `{"jpeg": { "quality": 5, "chromaSubsampling": "4:4:4" }, "png": { "palette": true }}` and `{"png":{"compressionLevel":9}}`. The `"compressionLevel": 9` specifies the level of compression for PNG images. Higher numbers here indicate greater compression, leading to smaller file sizes at the cost of potentially increased processing time and possible loss of image quality.',

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
    label: "Sharp constructor options for resizing images",
    description:
      'Provide an optional stringified Sharp ResizeOptions object to customize resizing behavior, eg. `{ "fastShrinkOnLoad": false, "position": "centre", "fit": "inside" }` The `"fit": "inside"` option ensures the image fits within given dimensions, maintaining aspect ratio, scaling down as needed without cropping or distortion. Learn more about [`Sharp constructor options`](https://sharp.pixelplumbing.com/api-resize#resize).',

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
    label: "GIF and WEBP animated option",
    description: "Keep animation of GIF and WEBP formats.",

    default: true,
    input: select({ True: true, "No (1st frame only)": false }),
  }),
  memory: defineInt("FUNCTION_MEMORY", {
    label: "Cloud Function memory",
    description:
      "Memory of the function responsible of resizing images.  Choose how much memory to give to the function that resize images. (For animated GIF => GIF we recommend using a minimum of 2GB).",

    default: 1024,
    input: select({
      "512 MB": 512,
      "1 GB": 1024,
      "2 GB": 2048,
      "4 GB": 4096,
      "8 GB": 8192,
    }),
  }),
  regenerateToken: defineBoolean("REGENERATE_TOKEN", {
    label: "Assign new access token",
    description:
      "Should resized images have a new access token assigned to them,  different from the original image?",

    default: true,
  }),
  contentFilterLevel: defineString("CONTENT_FILTER_LEVEL", {
    label: "Content filter level",
    description:
      "Set the level of content filtering to apply to uploaded images. Choose 'OFF' to disable content filtering entirely, 'BLOCK_ONLY_HIGH' to block only high-severity inappropriate content, 'BLOCK_MEDIUM_AND_ABOVE' for medium and high severity content, or 'BLOCK_LOW_AND_ABOVE' for the strictest filtering (blocks low, medium, and high severity content).",

    default: "OFF",
    input: select({
      "Off (No filtering)": "OFF",
      "Low strictness (Block only high severity content)": "BLOCK_ONLY_HIGH",
      "Medium strictness (Block medium and high severity content)":
        "BLOCK_MEDIUM_AND_ABOVE",
      "High strictness (Block low, medium, and high severity content)":
        "BLOCK_LOW_AND_ABOVE",
    }),
  }),
  customFilterPrompt: defineString("CUSTOM_FILTER_PROMPT", {
    label: "Custom content filter prompt",
    description:
      'Optionally, provide a custom prompt for content filtering. This allows you to define specific criteria for filtering beyond the standard categories. Note that this prompt should be a yes/no question. For example, "Does this image contain a cat?" will filter out images that Gemini thinks contain a cat. This is additional filtering on top of whichever content filtering level you choose. Leave empty to use just your selected built-in content filtering configuration.',
    default: "",
    input: {
      text: {
        example: "Does this image contain violent or threatening content?",
      },
    },
  }),
  placeholderImagePath: defineString("PLACEHOLDER_IMAGE_PATH", {
    label: "Path to placeholder image",
    description:
      "Optionally, specify a path to a placeholder image to use when an uploaded image is blocked by content filtering. This should be a relative path within your storage bucket. If not provided, a default placeholder image is used.",

    default: "",
    input: {
      text: {
        example: "placeholders/blocked-content.jpg",

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
