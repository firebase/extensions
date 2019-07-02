"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    cacheControlHeader: process.env.CACHE_CONTROL_HEADER,
    maxHeight: process.env.IMG_MAX_HEIGHT,
    maxWidth: process.env.IMG_MAX_WIDTH,
    signedUrlsPath: process.env.SIGNED_URLS_PATH,
    signedUrlsExpirationDate: process.env.SIGNED_URLS_EXPIRATION_DATE,
};
