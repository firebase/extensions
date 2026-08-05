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
import type { Bucket, File } from "@google-cloud/storage";
import { mkdirp } from "mkdirp";
import { v4 as uuidv4 } from "uuid";
import type { ResolvedResizeImagesConfig } from "./export-config";
import * as logs from "./logs";
import { countNegativeTraversals, type StorageObjectMetadata } from "./util";

export async function downloadOriginalFile(
  bucket: Bucket,
  filePath: string,
  verbose: boolean
): Promise<[string, File]> {
  const localFile = path.join(os.tmpdir(), uuidv4());
  const tempLocalDir = path.dirname(localFile);

  if (verbose) logs.tempDirectoryCreating(tempLocalDir);
  await mkdirp(tempLocalDir);
  if (verbose) logs.tempDirectoryCreated(tempLocalDir);

  const remoteFile = bucket.file(filePath);
  if (verbose) logs.imageDownloading(filePath);
  await remoteFile.download({ destination: localFile });
  if (verbose) logs.imageDownloaded(filePath, localFile);

  return [localFile, remoteFile];
}

export async function handleFailedImage(
  bucket: Bucket,
  localFile: string,
  object: StorageObjectMetadata,
  parsedPath: path.ParsedPath,
  contentFilterFailed: boolean,
  config: ResolvedResizeImagesConfig
): Promise<void> {
  if (!config.failedImagesPath) {
    return;
  }

  const filePath = object.name;
  const fileDir = parsedPath.dir;
  const fileExtension = parsedPath.ext;
  const fileNameWithoutExtension = path.basename(filePath, fileExtension);

  if (countNegativeTraversals(config.failedImagesPath)) {
    logs.invalidFailedResizePath(config.failedImagesPath, config);
    return;
  }

  const baseDir = filePath.substring(0, filePath.lastIndexOf("/") + 1);
  const failedFilePath = path.join(
    fileDir,
    config.failedImagesPath,
    `${fileNameWithoutExtension}${fileExtension}`
  );
  const normalizedPath = path.normalize(failedFilePath);

  if (!normalizedPath.startsWith(baseDir)) {
    logs.invalidFailedResizePath(failedFilePath, config);
    return;
  }

  logs.failedImageUploading(failedFilePath);

  const metadataObj: Record<string, string> = {
    resizeFailed: "true",
  };

  if (contentFilterFailed) {
    metadataObj.contentFilterFailed = "true";
  }

  await bucket.upload(localFile, {
    destination: failedFilePath,
    metadata: { metadata: metadataObj },
  });

  logs.failedImageUploaded(failedFilePath);
}

export async function deleteTempFile(
  localFile: string,
  filePath: string,
  verbose: boolean
): Promise<void> {
  if (verbose) logs.tempOriginalFileDeleting(filePath);
  try {
    fs.unlinkSync(localFile);
  } catch (err) {
    logs.errorDeleting(err);
  }
  if (verbose) logs.tempOriginalFileDeleted(filePath);
}

export async function deleteRemoteFile(
  remoteFile: File,
  filePath: string
): Promise<void> {
  try {
    logs.remoteFileDeleting(filePath);
    await remoteFile.delete();
    logs.remoteFileDeleted(filePath);
  } catch (err) {
    logs.errorDeleting(err);
  }
}
