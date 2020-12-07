"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.modifyImage = exports.supportedImageContentTypeMap = exports.supportedContentTypes = exports.convertType = exports.resize = void 0;
const os = require("os");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const uuidv4_1 = require("uuidv4");
const config_1 = require("./config");
const logs = require("./logs");
function resize(file, size) {
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
    return sharp(file)
        .rotate()
        .resize(parseInt(width, 10), parseInt(height, 10), {
        fit: "inside",
        withoutEnlargement: true,
    })
        .toBuffer();
}
exports.resize = resize;
function convertType(buffer) {
    const { imageType } = config_1.default;
    if (imageType === "jpg" || imageType === "jpeg") {
        return sharp(buffer)
            .jpeg()
            .toBuffer();
    }
    else if (imageType === "png") {
        return sharp(buffer)
            .png()
            .toBuffer();
    }
    else if (imageType === "webp") {
        return sharp(buffer)
            .webp()
            .toBuffer();
    }
    else if (imageType === "tiff") {
        return sharp(buffer)
            .tiff()
            .toBuffer();
    }
    return buffer;
}
exports.convertType = convertType;
/**
 * Supported file types
 */
exports.supportedContentTypes = [
    "image/jpeg",
    "image/png",
    "image/tiff",
    "image/webp",
];
exports.supportedImageContentTypeMap = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    tiff: "image/tiff",
    webp: "image/webp",
};
const supportedExtensions = Object.keys(exports.supportedImageContentTypeMap).map((type) => `.${type}`);
exports.modifyImage = async ({ bucket, originalFile, fileDir, fileNameWithoutExtension, fileExtension, contentType, size, objectMetadata, }) => {
    const { imageType } = config_1.default;
    const hasImageTypeConfigSet = imageType !== "false";
    const imageContentType = hasImageTypeConfigSet
        ? exports.supportedImageContentTypeMap[imageType]
        : contentType;
    const modifiedExtensionName = fileExtension && hasImageTypeConfigSet ? `.${imageType}` : fileExtension;
    let modifiedFileName;
    if (supportedExtensions.includes(fileExtension)) {
        modifiedFileName = `${fileNameWithoutExtension}_${size}${modifiedExtensionName}`;
    }
    else {
        // Fixes https://github.com/firebase/extensions/issues/476
        modifiedFileName = `${fileNameWithoutExtension}${fileExtension}_${size}`;
    }
    // Path where modified image will be uploaded to in Storage.
    const modifiedFilePath = path.normalize(config_1.default.resizedImagesPath
        ? path.join(fileDir, config_1.default.resizedImagesPath, modifiedFileName)
        : path.join(fileDir, modifiedFileName));
    let modifiedFile;
    try {
        modifiedFile = path.join(os.tmpdir(), modifiedFileName);
        // Cloud Storage files.
        const metadata = {
            contentDisposition: objectMetadata.contentDisposition,
            contentEncoding: objectMetadata.contentEncoding,
            contentLanguage: objectMetadata.contentLanguage,
            contentType: imageContentType,
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
        // Generate a resized image buffer using Sharp.
        logs.imageResizing(modifiedFile, size);
        let modifiedImageBuffer = await resize(originalFile, size);
        logs.imageResized(modifiedFile);
        // Generate a converted image type buffer using Sharp.
        if (hasImageTypeConfigSet) {
            logs.imageConverting(fileExtension, config_1.default.imageType);
            modifiedImageBuffer = await convertType(modifiedImageBuffer);
            logs.imageConverted(config_1.default.imageType);
        }
        // Generate a image file using Sharp.
        await sharp(modifiedImageBuffer).toFile(modifiedFile);
        // Uploading the modified image.
        logs.imageUploading(modifiedFilePath);
        await bucket.upload(modifiedFile, {
            destination: modifiedFilePath,
            metadata,
        });
        logs.imageUploaded(modifiedFile);
        return { size, success: true };
    }
    catch (err) {
        logs.error(err);
        return { size, success: false };
    }
    finally {
        try {
            // Make sure the local resized file is cleaned up to free up disk space.
            if (modifiedFile) {
                logs.tempResizedFileDeleting(modifiedFilePath);
                fs.unlinkSync(modifiedFile);
                logs.tempResizedFileDeleted(modifiedFilePath);
            }
        }
        catch (err) {
            logs.errorDeleting(err);
        }
    }
};
