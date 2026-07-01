import {
  defineBoolean,
  defineInt,
  defineString,
  projectID,
} from "firebase-functions/params";
import type { DeleteOriginalFile, ResizeImagesConfig } from "./export-config";

const params = {
  bucket: defineString("IMG_BUCKET"),
  sizes: defineString("IMG_SIZES", { default: "200x200" }),
  deleteOriginal: defineString("DELETE_ORIGINAL_FILE", { default: "false" }),
  makePublic: defineBoolean("MAKE_PUBLIC", { default: false }),
  resizedImagesPath: defineString("RESIZED_IMAGES_PATH", { default: "" }),
  includePathList: defineString("INCLUDE_PATH_LIST", { default: "" }),
  excludePathList: defineString("EXCLUDE_PATH_LIST", { default: "" }),
  failedImagesPath: defineString("FAILED_IMAGES_PATH", { default: "" }),
  cacheControlHeader: defineString("CACHE_CONTROL_HEADER", { default: "" }),
  imageTypes: defineString("IMAGE_TYPE", { default: "false" }),
  outputOptions: defineString("OUTPUT_OPTIONS", { default: "" }),
  sharpOptions: defineString("SHARP_OPTIONS", { default: "{}" }),
  isAnimated: defineBoolean("IS_ANIMATED", { default: true }),
  memory: defineInt("FUNCTION_MEMORY", { default: 1024 }),
  regenerateToken: defineBoolean("REGENERATE_TOKEN", { default: true }),
  contentFilterLevel: defineString("CONTENT_FILTER_LEVEL", { default: "OFF" }),
  customFilterPrompt: defineString("CUSTOM_FILTER_PROMPT", { default: "" }),
  placeholderImagePath: defineString("PLACEHOLDER_IMAGE_PATH", { default: "" }),
  region: defineString("LOCATION", { default: "us-central1" }),
};

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
    region: params.region.value(),
    projectId: projectID.value(),
  };
}
