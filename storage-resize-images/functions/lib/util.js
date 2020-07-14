"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractFileNameWithoutExtension = void 0;
const path = require("path");
exports.extractFileNameWithoutExtension = (filePath, ext) => {
    return path.basename(filePath, ext);
};
