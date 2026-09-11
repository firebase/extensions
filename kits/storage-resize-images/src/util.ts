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

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { Bucket, FileMetadata } from "@google-cloud/storage";
import { logger } from "firebase-functions";
import sharp from "sharp";
import { SUPPORTED_CONTENT_TYPES, SUPPORTED_EXTENSIONS } from "./global";
import * as logs from "./logs";

export interface StorageObjectMetadata {
  bucket: string;
  name: string;
  contentType?: string;
  contentEncoding?: string;
  contentDisposition?: string;
  contentLanguage?: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
  [key: string]: unknown;
}

export const startsWithArray = (
  userInputPaths: ReadonlyArray<string>,
  imagePath: string
): boolean => {
  for (const userPath of userInputPaths) {
    const trimmedUserPath = userPath
      .trim()
      .replace(/\*/g, "([a-zA-Z0-9_\\-\\+.\\s\\/]*)?");
    const regex = new RegExp(`^${trimmedUserPath}(?:/.*|$)`);

    if (regex.test(imagePath)) {
      return true;
    }
  }
  return false;
};

export function countNegativeTraversals(filePath: string): number {
  return (filePath.match(/\/\.\.\//g) || []).length;
}

export function convertPathToPosix(
  filePath: string,
  removeWindowsDrive?: boolean
): string {
  const winSep = path.win32.sep;
  const posixSep = path.posix.sep;
  let normalizedPath = filePath;

  if (normalizedPath.includes(winSep) && removeWindowsDrive) {
    normalizedPath = normalizedPath.substring(2);
  }

  return normalizedPath.split(winSep).join(posixSep);
}

export function convertToObjectMetadata(
  fileMetadata: FileMetadata
): StorageObjectMetadata {
  const { acl, metadata, ...rest } = fileMetadata;
  const convertedMetadata = metadata
    ? Object.fromEntries(
        Object.entries(metadata).map(([key, value]) => [
          key,
          value?.toString() ?? "",
        ])
      )
    : undefined;

  return {
    ...rest,
    bucket: rest.bucket ?? "",
    name: rest.name ?? "",
    metadata: convertedMetadata,
    acl,
  };
}

export async function replaceWithConfiguredPlaceholder(
  localFile: string,
  bucket: Bucket,
  placeholderPath: string
): Promise<void> {
  try {
    logger.info(
      `Replacing filtered image with placeholder from ${placeholderPath}`
    );

    const placeholderFile = bucket.file(placeholderPath);
    const tempPlaceholder = path.join(os.tmpdir(), crypto.randomUUID());

    await placeholderFile.download({ destination: tempPlaceholder });

    fs.unlinkSync(localFile);
    fs.copyFileSync(tempPlaceholder, localFile);
    fs.unlinkSync(tempPlaceholder);

    logger.info("Successfully replaced with placeholder image");
  } catch (err) {
    logger.error("Error replacing with placeholder:", err);
    logger.info("Falling back to default local placeholder.");
    await replaceWithDefaultPlaceholder(localFile);
  }
}

export async function replaceWithDefaultPlaceholder(
  localFile: string
): Promise<void> {
  const localPlaceholderFile = path.join(__dirname, "placeholder.png");
  const tempPlaceholder = path.join(os.tmpdir(), crypto.randomUUID());
  fs.copyFileSync(localPlaceholderFile, tempPlaceholder);
  fs.unlinkSync(localFile);
  fs.renameSync(tempPlaceholder, localFile);
}

export function validateFile(file: FileMetadata): boolean {
  return (
    SUPPORTED_CONTENT_TYPES.includes(
      file.contentType as (typeof SUPPORTED_CONTENT_TYPES)[number]
    ) ||
    SUPPORTED_EXTENSIONS.includes(path.extname(file.name ?? "").toLowerCase())
  );
}

export function convertType(
  buffer: Buffer,
  format: string,
  allowedOutputOptions: string | undefined,
  animated: boolean
): Promise<Buffer> {
  let outputOptions = {
    jpeg: {},
    jpg: {},
    png: {},
    webp: {},
    tiff: {},
    tif: {},
    avif: {},
  };
  if (allowedOutputOptions) {
    try {
      outputOptions = JSON.parse(allowedOutputOptions);
    } catch (e) {
      logs.errorOutputOptionsParse(e);
    }
  }
  const { jpeg, jpg, png, webp, tiff, tif, avif } = outputOptions;

  if (format === "jpeg") return sharp(buffer).jpeg(jpeg).toBuffer();
  if (format === "jpg") return sharp(buffer).jpeg(jpg).toBuffer();
  if (format === "png") return sharp(buffer).png(png).toBuffer();
  if (format === "webp")
    return sharp(buffer, { animated }).webp(webp).toBuffer();
  if (format === "tif") return sharp(buffer).tiff(tif).toBuffer();
  if (format === "tiff") return sharp(buffer).tiff(tiff).toBuffer();
  if (format === "gif") return sharp(buffer, { animated }).gif().toBuffer();
  if (format === "avif") return sharp(buffer).avif(avif).toBuffer();

  return Promise.resolve(buffer);
}
