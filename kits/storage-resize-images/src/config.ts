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
import type { DeleteOriginalFile, ResizeImagesConfig } from "./export-config";

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

const params = {
  bucket: defineString("IMG_BUCKET", {
    default: storageBucket,
    input: BUCKET_PICKER,
  }),
  sizes: defineString("IMG_SIZES", { default: "200x200" }),
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
  includePathList: defineString("INCLUDE_PATH_LIST", { default: "" }),
  excludePathList: defineString("EXCLUDE_PATH_LIST", { default: "" }),
  failedImagesPath: defineString("FAILED_IMAGES_PATH", { default: "" }),
  cacheControlHeader: defineString("CACHE_CONTROL_HEADER", { default: "" }),
  imageTypes: defineList("IMAGE_TYPE", {
    default: ["false"],
    input: multiSelect([...IMAGE_TYPE_OPTIONS]),
  }),
  outputOptions: defineString("OUTPUT_OPTIONS", { default: "" }),
  sharpOptions: defineString("SHARP_OPTIONS", { default: "{}" }),
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
