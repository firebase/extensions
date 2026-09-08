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

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { Bucket } from "@google-cloud/storage";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import type { ResolvedResizeImagesConfig } from "./export-config";
import {
  SUPPORTED_EXTENSIONS,
  SUPPORTED_IMAGE_CONTENT_TYPE_MAP,
} from "./global";
import * as logs from "./logs";
import {
  convertPathToPosix,
  convertType,
  type StorageObjectMetadata,
} from "./util";

export interface ResizedImageResult {
  size: string;
  outputFilePath: string;
  success: boolean;
}

export function resize(
  file: string,
  size: string,
  config: ResolvedResizeImagesConfig
): Promise<Buffer> {
  let height: string;
  let width: string;
  if (size.indexOf(",") !== -1) {
    [width, height] = size.split(",");
  } else if (size.indexOf("x") !== -1) {
    [width, height] = size.split("x");
  } else {
    throw new Error("height and width are not delimited by a ',' or a 'x'");
  }

  let sharpOptions = {};
  try {
    sharpOptions = JSON.parse(config.sharpOptions);
  } catch (e) {
    logs.errorConstuctorOptionsParse(e);
  }

  const ops = {
    failOnError: false,
    ...(sharpOptions || {}),
    animated: config.animated,
  };

  return sharp(file, ops)
    .rotate()
    .resize(parseInt(width, 10), parseInt(height, 10), {
      fit: "inside",
      withoutEnlargement: true,
      ...sharpOptions,
    })
    .toBuffer();
}

export const modifyImage = async ({
  bucket,
  originalFile,
  parsedPath,
  contentType,
  size,
  objectMetadata,
  format,
  config,
}: {
  bucket: Bucket;
  originalFile: string;
  parsedPath: path.ParsedPath;
  contentType: string;
  size: string;
  objectMetadata: StorageObjectMetadata;
  format: string;
  config: ResolvedResizeImagesConfig;
}): Promise<ResizedImageResult> => {
  const {
    ext: fileExtension,
    dir: fileDir,
    name: fileNameWithoutExtension,
  } = parsedPath;
  const shouldFormatImage = format !== "false";
  const imageContentType = shouldFormatImage
    ? SUPPORTED_IMAGE_CONTENT_TYPE_MAP[
        format as keyof typeof SUPPORTED_IMAGE_CONTENT_TYPE_MAP
      ]
    : contentType;
  const modifiedExtensionName =
    fileExtension && shouldFormatImage ? `.${format}` : fileExtension;
  const modifiedFileName = SUPPORTED_EXTENSIONS.includes(
    fileExtension.toLowerCase()
  )
    ? `${fileNameWithoutExtension}_${size}${modifiedExtensionName}`
    : `${fileNameWithoutExtension}${fileExtension}_${size}`;
  const modifiedFilePath = getModifiedFilePath(
    fileDir,
    config.resizedImagesPath,
    modifiedFileName
  );
  let modifiedFile: string | undefined;

  try {
    modifiedFile = path.join(os.tmpdir(), uuidv4());
    const metadata = constructMetadata(
      modifiedFileName,
      imageContentType,
      objectMetadata,
      config
    );

    logs.imageResizing(modifiedFile, size);
    let modifiedImageBuffer = await resize(originalFile, size, config);
    logs.imageResized(modifiedFile);

    if (shouldFormatImage) {
      logs.imageConverting(fileExtension, format);
      modifiedImageBuffer = await convertType(
        modifiedImageBuffer,
        format,
        config.outputOptions,
        config.animated
      );
      logs.imageConverted(format);
    }

    await sharp(modifiedImageBuffer, { animated: config.animated }).toFile(
      modifiedFile
    );

    logs.imageUploading(modifiedFilePath);
    const uploadResponse = await bucket.upload(modifiedFile, {
      destination: modifiedFilePath,
      metadata,
    });
    logs.imageUploaded(modifiedFile);

    if (config.makePublic) {
      await uploadResponse[0].makePublic();
    }

    return { size, outputFilePath: modifiedFilePath, success: true };
  } catch (err) {
    logs.error(err);
    return { size, outputFilePath: modifiedFilePath, success: false };
  } finally {
    try {
      if (modifiedFile) {
        logs.tempResizedFileDeleting(modifiedFilePath);
        fs.unlinkSync(modifiedFile);
        logs.tempResizedFileDeleted(modifiedFilePath);
      }
    } catch (err) {
      logs.errorDeleting(err);
    }
  }
};

export const constructMetadata = (
  modifiedFileName: string,
  imageContentType: string,
  objectMetadata: StorageObjectMetadata,
  config: ResolvedResizeImagesConfig
): Record<string, unknown> => {
  const contentDisposition = objectMetadata.contentDisposition
    ? objectMetadata.contentDisposition.replace(
        /(filename\*=utf-8''[^;\s]+)/,
        `filename*=utf-8''${modifiedFileName}`
      )
    : "";
  const metadata: Record<string, unknown> = {
    contentDisposition,
    contentEncoding: objectMetadata.contentEncoding,
    contentLanguage: objectMetadata.contentLanguage,
    contentType: imageContentType,
    metadata: objectMetadata.metadata ? { ...objectMetadata.metadata } : {},
  };
  const customMetadata = metadata.metadata as Record<string, string>;
  customMetadata.resizedImage = "true";
  metadata.cacheControl =
    config.cacheControlHeader || objectMetadata.cacheControl;

  if (config.regenerateToken && customMetadata.firebaseStorageDownloadTokens) {
    customMetadata.firebaseStorageDownloadTokens = uuidv4();
  }
  return metadata;
};

export const getModifiedFilePath = (
  fileDir: string,
  resizedImagesPath: string | undefined,
  modifiedFileName: string
): string =>
  convertPathToPosix(
    path.posix.normalize(
      resizedImagesPath
        ? path.posix.join(fileDir, resizedImagesPath, modifiedFileName)
        : path.posix.join(fileDir, modifiedFileName)
    )
  );

export async function resizeImages(
  bucket: Bucket,
  localFile: string,
  parsedPath: path.ParsedPath,
  objectMetadata: StorageObjectMetadata,
  config: ResolvedResizeImagesConfig
): Promise<PromiseSettledResult<ResizedImageResult>[]> {
  const imageTypes = new Set(config.imageTypes);
  const imageSizes = new Set(config.imageSizes);
  const tasks: Promise<ResizedImageResult>[] = [];

  imageTypes.forEach((format) => {
    imageSizes.forEach((size) => {
      tasks.push(
        modifyImage({
          bucket,
          originalFile: localFile,
          parsedPath,
          contentType: objectMetadata.contentType ?? "",
          size,
          objectMetadata,
          format,
          config,
        })
      );
    });
  });

  return Promise.allSettled(tasks);
}
