"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startsWithArray = exports.extractFileNameWithoutExtension = void 0;
const path = require("path");
exports.extractFileNameWithoutExtension = (filePath, ext) => {
    return path.basename(filePath, ext);
};
exports.startsWithArray = (userInputPaths, imagePath) => {
    for (let userPath of userInputPaths) {
        console.warn("starting >>>", userPath, userInputPaths);
        const trimmedUserPath = userPath
            .trim()
            .replace(/\*/g, "([a-zA-Z0-9_-.\n/]*)");
        console.warn("Trimmed user path >>>", trimmedUserPath);
        const regex = new RegExp("^" + trimmedUserPath + "(?:/.*|$)");
        console.warn("testing >>>", regex, imagePath);
        if (regex.test(imagePath)) {
            console.warn("worked >>>", regex);
            return true;
        }
    }
    return false;
};
