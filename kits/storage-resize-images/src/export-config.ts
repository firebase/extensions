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

import type { MemoryOption } from "firebase-functions/v2/options";

export type SafetyThreshold =
  | "BLOCK_LOW_AND_ABOVE"
  | "BLOCK_MEDIUM_AND_ABOVE"
  | "BLOCK_ONLY_HIGH"
  | "BLOCK_NONE";

export type ContentFilterLevel = SafetyThreshold | "OFF";
export type DeleteOriginalFile = "true" | "false" | "on_success";

export const DELETE_IMAGE = {
  always: 0,
  never: 1,
  onSuccess: 2,
} as const;

export type DeleteImage = (typeof DELETE_IMAGE)[keyof typeof DELETE_IMAGE];

export interface ResizeImagesConfig {
  bucket: string;
  sizes: ReadonlyArray<string> | string;
  deleteOriginal?: DeleteOriginalFile | boolean;
  makePublic?: boolean;
  includePathList?: ReadonlyArray<string> | string;
  excludePathList?: ReadonlyArray<string> | string;
  imageTypes?: ReadonlyArray<string> | string;
  outputOptions?: string;
  sharpOptions?: string;
  isAnimated?: boolean;
  memory?: MemoryOption | number | string;
  regenerateToken?: boolean;
  contentFilterLevel?: ContentFilterLevel;
  customFilterPrompt?: string;
  placeholderImagePath?: string;
  cacheControlHeader?: string;
  resizedImagesPath?: string;
  failedImagesPath?: string;
  region?: string;
  projectId?: string;
}

export interface ResolvedResizeImagesConfig {
  bucket: string;
  imageSizes: ReadonlyArray<string>;
  deleteOriginalFile: DeleteImage;
  makePublic: boolean;
  includePathList?: ReadonlyArray<string>;
  excludePathList?: ReadonlyArray<string>;
  imageTypes: ReadonlyArray<string>;
  outputOptions?: string;
  sharpOptions: string;
  animated: boolean;
  memory: MemoryOption;
  regenerateToken: boolean;
  contentFilterLevel: SafetyThreshold | null;
  customFilterPrompt: string | null;
  placeholderImagePath: string | null;
  cacheControlHeader?: string;
  resizedImagesPath?: string;
  failedImagesPath?: string;
  region?: string;
  projectId?: string;
}

const DEFAULT_MEMORY: MemoryOption = "1GiB";
const DEFAULT_IMAGE_TYPE = "false";
const MEMORY_OPTIONS = {
  "512": "512MiB",
  "1024": "1GiB",
  "2048": "2GiB",
  "4096": "4GiB",
  "8192": "8GiB",
} as const satisfies Record<string, MemoryOption>;

const HARM_BLOCK_THRESHOLD_MAP = {
  BLOCK_LOW_AND_ABOVE: "BLOCK_LOW_AND_ABOVE",
  BLOCK_MEDIUM_AND_ABOVE: "BLOCK_MEDIUM_AND_ABOVE",
  BLOCK_ONLY_HIGH: "BLOCK_ONLY_HIGH",
  BLOCK_NONE: "BLOCK_NONE",
  OFF: null,
} as const satisfies Record<ContentFilterLevel, SafetyThreshold | null>;

function toArray(param: ReadonlyArray<string> | string | undefined) {
  if (typeof param === "string") {
    return param ? param.split(",") : undefined;
  }
  return param;
}

function deleteOriginalFile(
  deleteType: DeleteOriginalFile | boolean | undefined
) {
  switch (deleteType) {
    case true:
    case "true":
      return DELETE_IMAGE.always;
    case false:
    case "false":
    case undefined:
      return DELETE_IMAGE.never;
    default:
      return DELETE_IMAGE.onSuccess;
  }
}

function allowAnimated(sharpOptions = "{}", isAnimated = true): boolean {
  const ops = JSON.parse(sharpOptions) as { animated?: unknown };
  if (ops?.animated) {
    return true;
  }
  return isAnimated;
}

export function convertHarmBlockThreshold(
  level?: ContentFilterLevel
): SafetyThreshold | null {
  if (!level) {
    return null;
  }
  if (level in HARM_BLOCK_THRESHOLD_MAP) {
    return HARM_BLOCK_THRESHOLD_MAP[level];
  }
  throw new Error(`Invalid HarmBlockThreshold: ${level}`);
}

function normalizeMemory(memory: ResizeImagesConfig["memory"]): MemoryOption {
  if (memory === undefined) {
    return DEFAULT_MEMORY;
  }
  const normalized = String(memory);
  if (normalized in MEMORY_OPTIONS) {
    return MEMORY_OPTIONS[normalized as keyof typeof MEMORY_OPTIONS];
  }
  return normalized as MemoryOption;
}

export function resolveResizeImagesConfig(
  config: ResizeImagesConfig
): ResolvedResizeImagesConfig {
  const sharpOptions = config.sharpOptions || "{}";
  return {
    bucket: config.bucket,
    imageSizes: toArray(config.sizes) ?? [],
    deleteOriginalFile: deleteOriginalFile(config.deleteOriginal),
    makePublic: config.makePublic ?? false,
    includePathList: toArray(config.includePathList),
    excludePathList: toArray(config.excludePathList),
    imageTypes: toArray(config.imageTypes) ?? [DEFAULT_IMAGE_TYPE],
    outputOptions: config.outputOptions,
    sharpOptions,
    animated: allowAnimated(sharpOptions, config.isAnimated ?? true),
    memory: normalizeMemory(config.memory),
    regenerateToken: config.regenerateToken ?? true,
    contentFilterLevel: convertHarmBlockThreshold(config.contentFilterLevel),
    customFilterPrompt: config.customFilterPrompt || null,
    placeholderImagePath: config.placeholderImagePath || null,
    cacheControlHeader: config.cacheControlHeader,
    resizedImagesPath: config.resizedImagesPath,
    failedImagesPath: config.failedImagesPath,
    region: config.region ?? process.env.FUNCTION_REGION,
    projectId: config.projectId,
  };
}
