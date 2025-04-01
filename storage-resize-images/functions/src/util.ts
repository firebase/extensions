import * as path from "path";

import { FileMetadata } from "@google-cloud/storage";
import { ObjectMetadata } from "firebase-functions/v1/storage";
import { v4 as uuidv4 } from "uuid";
import * as os from "os";
import * as fs from "fs";
import * as functions from "firebase-functions/v1";
import { Bucket } from "@google-cloud/storage";
import sharp from "sharp";
import * as logs from "./logs";
import { supportedContentTypes, supportedExtensions } from "./global";

export const startsWithArray = (
  userInputPaths: string[],
  imagePath: string
) => {
  for (let userPath of userInputPaths) {
    const trimmedUserPath = userPath
      .trim()
      .replace(/\*/g, "([a-zA-Z0-9_\\-\\+.\\s\\/]*)?");

    const regex = new RegExp("^" + trimmedUserPath + "(?:/.*|$)");

    if (regex.test(imagePath)) {
      return true;
    }
  }
  return false;
};

export function countNegativeTraversals(path: string): number {
  return (path.match(/\/\.\.\//g) || []).length;
}

export function convertPathToPosix(
  filePath: string,
  removeWindowsDrive?: boolean
): string {
  const winSep = path.win32.sep;
  const posixSep = path.posix.sep;

  // likely Windows (as contains windows path separator)
  if (filePath.includes(winSep) && removeWindowsDrive) {
    // handle drive (e.g. C:)
    filePath = filePath.substring(2);
  }

  // replace Windows path separator with posix path separator
  return filePath.split(winSep).join(posixSep);
}

export function convertToObjectMetadata(
  fileMetadata: FileMetadata
): ObjectMetadata {
  const { acl, metadata, ...rest } = fileMetadata;

  // Convert metadata values to strings, defaulting to an empty string for null/undefined values
  // This is necessary because of a mismatch between the expected type of metadata and the actual type
  const convertedMetadata = metadata
    ? Object.fromEntries(
        Object.entries(metadata).map(([key, value]) => [
          key,
          value?.toString() ?? "",
        ])
      )
    : undefined;

  const convertedAcl =
    acl?.map((aclEntry) => ({
      kind: aclEntry.kind,
      id: aclEntry.id,
      selfLink: aclEntry.selfLink,
      bucket: aclEntry.bucket,
      object: aclEntry.object,
      generation: aclEntry.generation,
      entity: aclEntry.entity,
      role: aclEntry.role,
      entityId: aclEntry.entityId,
      domain: aclEntry.domain,
      projectTeam: aclEntry.projectTeam
        ? {
            projectNumber: aclEntry.projectTeam.projectNumber,
            team: aclEntry.projectTeam.team,
          }
        : undefined,
      etag: aclEntry.etag,
    }))[0] || undefined;

  return {
    kind: "storage#object",
    id: rest.id,
    bucket: rest.bucket,
    storageClass: rest.storageClass,
    size: rest.size?.toString(),
    timeCreated: rest.timeCreated,
    updated: rest.updated,
    selfLink: rest.selfLink,
    name: rest.name,
    generation: rest.generation?.toString(),
    contentType: rest.contentType,
    metageneration: rest.metageneration?.toString(),
    timeDeleted: rest.timeDeleted,
    timeStorageClassUpdated: rest.timeStorageClassUpdated,
    md5Hash: rest.md5Hash,
    mediaLink: rest.mediaLink,
    contentEncoding: rest.contentEncoding,
    contentDisposition: rest.contentDisposition,
    contentLanguage: rest.contentLanguage,
    cacheControl: rest.cacheControl,
    metadata: convertedMetadata,
    owner: rest.owner,
    crc32c: rest.crc32c,
    componentCount: rest.componentCount?.toString(),
    etag: rest.etag,
    customerEncryption: rest.customerEncryption,
    acl: convertedAcl ? [convertedAcl] : undefined,
  };
}

/**
 * Replaces the original file with configured placeholder
 */
export async function replaceWithConfiguredPlaceholder(
  localFile: string,
  bucket: Bucket,
  placeholderPath: string
): Promise<void> {
  try {
    functions.logger.info(
      `Replacing filtered image with placeholder from ${placeholderPath}`
    );

    const placeholderFile = bucket.file(placeholderPath);
    const tempPlaceholder = path.join(os.tmpdir(), uuidv4());

    await placeholderFile.download({ destination: tempPlaceholder });

    // Swap original with placeholder
    fs.unlinkSync(localFile);
    fs.copyFileSync(tempPlaceholder, localFile);
    fs.unlinkSync(tempPlaceholder);

    functions.logger.info(`Successfully replaced with placeholder image`);
  } catch (err) {
    functions.logger.error(`Error replacing with placeholder:`, err);
    functions.logger.info(`Falling back to default local placeholder.`);

    // Fall back to default placeholder
    await replaceWithDefaultPlaceholder(localFile);
  }
}

/**
 * Replaces the original file with default placeholder
 */
export async function replaceWithDefaultPlaceholder(
  localFile: string
): Promise<void> {
  const localPlaceholderFile = path.join(__dirname, "placeholder.png");

  // Make a copy of the default placeholder instead of using it directly
  const tempPlaceholder = path.join(os.tmpdir(), uuidv4());
  fs.copyFileSync(localPlaceholderFile, tempPlaceholder);

  // Delete the original file
  fs.unlinkSync(localFile);

  // Replace with the placeholder
  fs.renameSync(tempPlaceholder, localFile);
}

export function validateFile(file: FileMetadata): boolean {
  return (
    supportedContentTypes.includes(file.contentType) ||
    supportedExtensions.includes(path.extname(file.name).toLowerCase())
  );
}

export function convertType(buffer, format, allowedOutputOptions, animated) {
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

  if (format === "jpeg") {
    return sharp(buffer).jpeg(jpeg).toBuffer();
  }

  if (format === "jpg") {
    return sharp(buffer).jpeg(jpg).toBuffer();
  }

  if (format === "png") {
    return sharp(buffer).png(png).toBuffer();
  }

  if (format === "webp") {
    return sharp(buffer, { animated }).webp(webp).toBuffer();
  }

  if (format === "tif") {
    return sharp(buffer).tiff(tif).toBuffer();
  }

  if (format === "tiff") {
    return sharp(buffer).tiff(tiff).toBuffer();
  }

  if (format === "gif") {
    return sharp(buffer, { animated }).gif().toBuffer();
  }

  if (format === "avif") {
    return sharp(buffer).avif(avif).toBuffer();
  }

  return buffer;
}
