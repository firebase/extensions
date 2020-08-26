"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startsWithArray = exports.extractFileNameWithoutExtension = void 0;
const path = require("path");
exports.extractFileNameWithoutExtension = (filePath, ext) => {
    return path.basename(filePath, ext);
};
exports.startsWithArray = (arraySearch, text) => {
    for (let search of arraySearch) {
        if (text.startsWith(search)) {
            return true;
        }
    }
    return false;
};
