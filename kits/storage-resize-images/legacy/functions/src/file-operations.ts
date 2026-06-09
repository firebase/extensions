import * as path from "path";
import { ObjectMetadata } from "firebase-functions/v1/storage";
import { Bucket, File } from "@google-cloud/storage";
import * as logs from "./logs";
import { v4 as uuidv4 } from "uuid";
import { mkdirp } from "mkdirp";
import * as os from "os";
import * as fs from "fs";
import { config } from "./config";
import { countNegativeTraversals } from "./util";

/**
 * Downloads the original file to a temporary location
 */
export async function downloadOriginalFile(
  bucket: Bucket,
  filePath: string,
  verbose: boolean
): Promise<[string, File]> {
  const localFile = path.join(os.tmpdir(), uuidv4());
  const tempLocalDir = path.dirname(localFile);

  // Create the temp directory
  !verbose || logs.tempDirectoryCreating(tempLocalDir);
  await mkdirp(tempLocalDir);
  !verbose || logs.tempDirectoryCreated(tempLocalDir);

  // Download file from bucket
  const remoteFile = bucket.file(filePath);
  !verbose || logs.imageDownloading(filePath);
  await remoteFile.download({ destination: localFile });
  !verbose || logs.imageDownloaded(filePath, localFile);

  return [localFile, remoteFile];
}

/**
 * Handles failed image processing
 */
export async function handleFailedImage(
  bucket: Bucket,
  localFile: string,
  object: ObjectMetadata,
  parsedPath: path.ParsedPath,
  contentFilterFailed: boolean
): Promise<void> {
  if (!config.failedImagesPath) {
    return;
  }

  const filePath = object.name;
  const fileDir = parsedPath.dir;
  const fileExtension = parsedPath.ext;
  const fileNameWithoutExtension = path.basename(filePath, fileExtension);

  // Check for negative traversal in the configuration
  if (countNegativeTraversals(config.failedImagesPath)) {
    logs.invalidFailedResizePath(config.failedImagesPath, config);
    return;
  }

  // Find the base directory
  const baseDir = filePath.substring(0, filePath.lastIndexOf("/") + 1);

  // Set the failed path
  const failedFilePath = path.join(
    fileDir,
    config.failedImagesPath,
    `${fileNameWithoutExtension}${fileExtension}`
  );

  // Normalize for gcp storage
  const normalizedPath = path.normalize(failedFilePath);

  // Check if safe path
  if (!normalizedPath.startsWith(baseDir)) {
    logs.invalidFailedResizePath(failedFilePath, config);
    return;
  }

  // Upload the failed image
  logs.failedImageUploading(failedFilePath);

  // Add metadata for failures
  const metadataObj: Record<string, string> = {
    resizeFailed: "true",
  };

  if (contentFilterFailed) {
    metadataObj["contentFilterFailed"] = "true";
  }

  await bucket.upload(localFile, {
    destination: failedFilePath,
    metadata: { metadata: metadataObj },
  });

  logs.failedImageUploaded(failedFilePath);
}

/**
 * Deletes a temporary file
 */
export async function deleteTempFile(
  localFile: string,
  filePath: string,
  verbose: boolean
): Promise<void> {
  !verbose || logs.tempOriginalFileDeleting(filePath);
  try {
    fs.unlinkSync(localFile);
  } catch (err) {
    logs.errorDeleting(err);
  }
  !verbose || logs.tempOriginalFileDeleted(filePath);
}

/**
 * Deletes the remote original file
 */
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
