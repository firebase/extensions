"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startsWithArray = exports.extractFileNameWithoutExtension = void 0;
const path = require("path");
exports.extractFileNameWithoutExtension = (filePath, ext) => {
    return path.basename(filePath, ext);
};
exports.startsWithArray = (userInputPaths, imagePath) => {
    for (let userPath of userInputPaths) {
        const trimmedUserPath = userPath
            .trim()
            .replace(/\*/g, "([a-zA-Z0-9_\\-.\\s\\/]*)?");
        const regex = new RegExp("^" + trimmedUserPath + "(?:/.*|$)");
        if (regex.test(imagePath)) {
            return true;
        }
    }
    return false;
};
