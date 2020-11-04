import * as os from "os";
import * as sharp from "sharp";
import * as path from "path";
import * as fs from "fs";

import { Bucket, File } from "@google-cloud/storage";
import { ObjectMetadata } from "firebase-functions/lib/providers/storage";
import { uuid } from "uuidv4";

import config, { deleteImage } from "./config";
import * as logs from "./logs";

export interface ResizedImageResult {
  size: string;
  success: boolean;
}

export function resize(originalFile, resizedFile, size) {
  let height, width;
  if (size.indexOf(",") !== -1) {
    [width, height] = size.split(",");
  } else if (size.indexOf("x") !== -1) {
    [width, height] = size.split("x");
  } else {
    throw new Error("height and width are not delimited by a ',' or a 'x'");
  }

  return sharp(originalFile)
    .rotate()
    .resize(parseInt(width, 10), parseInt(height, 10), {
      fit: "inside",
      withoutEnlargement: true,
    })
    .toFile(resizedFile);
}

export const resizeImage = async ({
  bucket,
  originalFile,
  fileDir,
  fileNameWithoutExtension,
  fileExtension,
  contentType,
  size,
  objectMetadata,
  remoteFile,
  filePath,
}: {
  bucket: Bucket;
  originalFile: string;
  fileDir: string;
  fileNameWithoutExtension: string;
  fileExtension: string;
  contentType: string;
  size: string;
  objectMetadata: ObjectMetadata;
  remoteFile: File;
  filePath: string;
}): Promise<ResizedImageResult> => {
  const resizedFileName = `${fileNameWithoutExtension}_${size}${fileExtension}`;
  // Path where resized image will be uploaded to in Storage.
  const resizedFilePath = path.normalize(
    config.resizedImagesPath
      ? path.join(fileDir, config.resizedImagesPath, resizedFileName)
      : path.join(fileDir, resizedFileName)
  );
  let resizedFile: string;

  try {
    resizedFile = path.join(os.tmpdir(), resizedFileName);

    // Cloud Storage files.
    const metadata: { [key: string]: any } = {
      contentDisposition: objectMetadata.contentDisposition,
      contentEncoding: objectMetadata.contentEncoding,
      contentLanguage: objectMetadata.contentLanguage,
      contentType: contentType,
      metadata: objectMetadata.metadata || {},
    };
    metadata.metadata.resizedImage = true;
    if (config.cacheControlHeader) {
      metadata.cacheControl = config.cacheControlHeader;
    } else {
      metadata.cacheControl = objectMetadata.cacheControl;
    }

    // If the original image has a download token, add a
    // new token to the image being resized #323
    if (metadata.metadata.firebaseStorageDownloadTokens) {
      metadata.metadata.firebaseStorageDownloadTokens = uuid();
    }

    // Generate a resized image using Sharp.
    logs.imageResizing(resizedFile, size);

    await resize(originalFile, resizedFile, size);

    logs.imageResized(resizedFile);

    // Uploading the resized image.
    logs.imageUploading(resizedFilePath);
    await bucket.upload(resizedFile, {
      destination: resizedFilePath,
      metadata,
    });
    logs.imageUploaded(resizedFilePath);

    if (config.deleteOriginalFile === deleteImage.onSuccess) {
      if (remoteFile) {
        try {
          logs.remoteFileDeleting(filePath);
          await remoteFile.delete();
          logs.remoteFileDeleted(filePath);
        } catch (err) {
          logs.errorDeleting(err);
        }
      }
    }

    return { size, success: true };
  } catch (err) {
    logs.error(err);
    return { size, success: false };
  } finally {
    try {
      // Make sure the local resized file is cleaned up to free up disk space.
      if (resizedFile) {
        logs.tempResizedFileDeleting(resizedFilePath);
        fs.unlinkSync(resizedFile);
        logs.tempResizedFileDeleted(resizedFilePath);
      }
    } catch (err) {
      logs.errorDeleting(err);
    }
  }
};
