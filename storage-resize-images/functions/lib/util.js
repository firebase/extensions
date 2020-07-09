"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
exports.extractFileNameWithoutExtension = (filePath, ext) => {
    return path.basename(filePath, ext);
};
