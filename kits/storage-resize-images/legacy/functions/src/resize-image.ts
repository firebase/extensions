import * as os from "os";
import sharp from "sharp";
import * as path from "path";
import * as fs from "fs";

import { Bucket } from "@google-cloud/storage";
import { uuid } from "uuidv4";

import { config } from "./config";
import * as logs from "./logs";
import { ObjectMetadata } from "firebase-functions/v1/storage";
import { convertPathToPosix, convertType } from "./util";
import { supportedExtensions, supportedImageContentTypeMap } from "./global";

export interface ResizedImageResult {
  size: string;
  outputFilePath: string;
  success: boolean;
}

export function resize(file, size) {
  let height, width;
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

  /**
   * Allows customisation of sharp constructor options
   * Maintains the original config for failOnError
   * Ensure animated option overrides custom options
   */
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
}: {
  bucket: Bucket;
  originalFile: string;
  parsedPath: path.ParsedPath;
  contentType: string;
  size: string;
  objectMetadata: ObjectMetadata;
  format: string;
}): Promise<ResizedImageResult> => {
  const {
    ext: fileExtension,
    dir: fileDir,
    name: fileNameWithoutExtension,
  } = parsedPath;
  const shouldFormatImage = format !== "false";
  const imageContentType = shouldFormatImage
    ? supportedImageContentTypeMap[format]
    : contentType;
  const modifiedExtensionName =
    fileExtension && shouldFormatImage ? `.${format}` : fileExtension;

  let modifiedFileName;

  if (supportedExtensions.includes(fileExtension.toLowerCase())) {
    modifiedFileName = `${fileNameWithoutExtension}_${size}${modifiedExtensionName}`;
  } else {
    // Fixes https://github.com/firebase/extensions/issues/476
    modifiedFileName = `${fileNameWithoutExtension}${fileExtension}_${size}`;
  }

  // Path where modified image will be uploaded to in Storage.
  const modifiedFilePath = getModifiedFilePath(
    fileDir,
    config.resizedImagesPath,
    modifiedFileName
  );
  let modifiedFile: string;

  try {
    modifiedFile = path.join(os.tmpdir(), uuid());

    // filename\*=utf-8''  selects any string match the filename notation.
    // [^;\s]+ searches any following string until either a space or semi-colon.
    const metadata = constructMetadata(
      modifiedFileName,
      imageContentType,
      objectMetadata
    );

    // Generate a resized image buffer using Sharp.
    logs.imageResizing(modifiedFile, size);
    let modifiedImageBuffer = await resize(originalFile, size);
    logs.imageResized(modifiedFile);

    // Generate a converted image type buffer using Sharp.

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

    // Generate a image file using Sharp.
    await sharp(modifiedImageBuffer, { animated: config.animated }).toFile(
      modifiedFile
    );

    // Uploading the modified image.
    logs.imageUploading(modifiedFilePath);
    const uploadResponse = await bucket.upload(modifiedFile, {
      destination: modifiedFilePath,
      metadata,
    });
    logs.imageUploaded(modifiedFile);

    // Make uploaded image public.
    if (config.makePublic) {
      await uploadResponse[0].makePublic();
    }

    return { size, outputFilePath: modifiedFilePath, success: true };
  } catch (err) {
    logs.error(err);
    return { size, outputFilePath: modifiedFilePath, success: false };
  } finally {
    try {
      // Make sure the local resized file is cleaned up to free up disk space.
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
  objectMetadata: ObjectMetadata
) => {
  // filename\*=utf-8''  selects any string match the filename notation.
  // [^;\s]+ searches any following string until either a space or semi-colon.
  const contentDisposition =
    objectMetadata && objectMetadata.contentDisposition
      ? objectMetadata.contentDisposition.replace(
          /(filename\*=utf-8''[^;\s]+)/,
          `filename*=utf-8''${modifiedFileName}`
        )
      : "";

  // Cloud Storage files.
  const metadata: { [key: string]: any } = {
    contentDisposition,
    contentEncoding: objectMetadata.contentEncoding,
    contentLanguage: objectMetadata.contentLanguage,
    contentType: imageContentType,
    metadata: objectMetadata.metadata ? { ...objectMetadata.metadata } : {},
  };
  metadata.metadata.resizedImage = true;
  if (config.cacheControlHeader) {
    metadata.cacheControl = config.cacheControlHeader;
  } else {
    metadata.cacheControl = objectMetadata.cacheControl;
  }

  // If the original image has a download token, add a
  // new token to the image being resized #323
  if (
    config.regenerateToken &&
    metadata.metadata.firebaseStorageDownloadTokens
  ) {
    metadata.metadata.firebaseStorageDownloadTokens = uuid();
  }
  return metadata;
};

export const getModifiedFilePath = (
  fileDir,
  resizedImagesPath,
  modifiedFileName
) => {
  return convertPathToPosix(
    path.posix.normalize(
      resizedImagesPath
        ? path.posix.join(fileDir, resizedImagesPath, modifiedFileName)
        : path.posix.join(fileDir, modifiedFileName)
    )
  );
};

/**
 * Resizes images to all configured sizes and formats
 */
export async function resizeImages(
  bucket: Bucket,
  localFile: string,
  parsedPath: path.ParsedPath,
  objectMetadata: ObjectMetadata
): Promise<PromiseSettledResult<ResizedImageResult>[]> {
  // Get a unique list of image types and sizes
  const imageTypes = new Set(config.imageTypes);
  const imageSizes = new Set(config.imageSizes);

  const tasks: Promise<ResizedImageResult>[] = [];

  // Create resize tasks for all format/size combinations
  imageTypes.forEach((format) => {
    imageSizes.forEach((size) => {
      tasks.push(
        modifyImage({
          bucket,
          originalFile: localFile,
          parsedPath,
          contentType: objectMetadata.contentType,
          size,
          objectMetadata,
          format,
        })
      );
    });
  });

  // Execute all resize tasks
  return await Promise.allSettled(tasks);
}
