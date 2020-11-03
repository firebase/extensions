"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resizeImage = exports.resize = void 0;
const os = require("os");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const uuidv4_1 = require("uuidv4");
const config_1 = require("./config");
const logs = require("./logs");
function resize(originalFile, resizedFile, size) {
    let height, width;
    if (size.indexOf(",") !== -1) {
        [width, height] = size.split(",");
    }
    else if (size.indexOf("x") !== -1) {
        [width, height] = size.split("x");
    }
    else {
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
exports.resize = resize;
exports.resizeImage = async ({ bucket, originalFile, fileDir, fileNameWithoutExtension, fileExtension, contentType, size, objectMetadata, remoteFile, filePath, }) => {
    const resizedFileName = `${fileNameWithoutExtension}_${size}${fileExtension}`;
    // Path where resized image will be uploaded to in Storage.
    const resizedFilePath = path.normalize(config_1.default.resizedImagesPath
        ? path.join(fileDir, config_1.default.resizedImagesPath, resizedFileName)
        : path.join(fileDir, resizedFileName));
    let resizedFile;
    try {
        resizedFile = path.join(os.tmpdir(), resizedFileName);
        // Cloud Storage files.
        const metadata = {
            contentDisposition: objectMetadata.contentDisposition,
            contentEncoding: objectMetadata.contentEncoding,
            contentLanguage: objectMetadata.contentLanguage,
            contentType: contentType,
            metadata: objectMetadata.metadata || {},
        };
        metadata.metadata.resizedImage = true;
        if (config_1.default.cacheControlHeader) {
            metadata.cacheControl = config_1.default.cacheControlHeader;
        }
        else {
            metadata.cacheControl = objectMetadata.cacheControl;
        }
        // If the original image has a download token, add a
        // new token to the image being resized #323
        if (metadata.metadata.firebaseStorageDownloadTokens) {
            metadata.metadata.firebaseStorageDownloadTokens = uuidv4_1.uuid();
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
        if (config_1.default.deleteOriginalFile === config_1.deleteImage.onSuccess) {
            if (remoteFile) {
                try {
                    logs.remoteFileDeleting(filePath);
                    await remoteFile.delete();
                    logs.remoteFileDeleted(filePath);
                }
                catch (err) {
                    logs.errorDeleting(err);
                }
            }
        }
        return { size, success: true };
    }
    catch (err) {
        logs.error(err);
        return { size, success: false };
    }
    finally {
        try {
            // Make sure the local resized file is cleaned up to free up disk space.
            if (resizedFile) {
                logs.tempResizedFileDeleting(resizedFilePath);
                fs.unlinkSync(resizedFile);
                logs.tempResizedFileDeleted(resizedFilePath);
            }
        }
        catch (err) {
            logs.errorDeleting(err);
        }
    }
};
