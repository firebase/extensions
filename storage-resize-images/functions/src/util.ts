import * as path from "path";

import { FileMetadata } from "@google-cloud/storage";
import { ObjectMetadata } from "firebase-functions/v1/storage";

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
  removeDrive?: boolean
): string {
  const winSep = path.win32.sep;
  const posixSep = path.posix.sep;

  // likely Windows (as contains windows path separator)
  if (filePath.includes(winSep) && removeDrive) {
    // handle drive (e.g. C:)
    filePath = filePath.substring(2);
  }

  // replace Windows path separator with posix path separator
  return filePath.split(winSep).join(posixSep);
}

export function convertToObjectMetadata(
  fileMetadata: FileMetadata
): ObjectMetadata {
  const { acl, ...rest } = fileMetadata;

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
    metadata: rest.metadata,
    owner: rest.owner,
    crc32c: rest.crc32c,
    componentCount: rest.componentCount?.toString(),
    etag: rest.etag,
    customerEncryption: rest.customerEncryption,
    acl: convertedAcl ? [convertedAcl] : undefined,
  };
}
