"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isImage = (contentType) => contentType.startsWith("image/");
exports.isResizedImage = (fileName, suffix) => fileName.endsWith(suffix);
