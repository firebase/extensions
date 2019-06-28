"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const httpErrors = require("./errors");
const logs = require("./logs");
exports.pathExists = (path) => {
    if (!path) {
        logs.pathMissing();
        throw httpErrors.invalidArgument("path");
    }
};
exports.userHasClaim = (token) => {
    const hasCustomClaim = token && token.fsdelete;
    if (!hasCustomClaim) {
        logs.userMissingClaim();
        throw httpErrors.permissionDenied();
    }
};
exports.userIsAuthenticated = (auth) => {
    const isAuthenticated = auth && auth.uid;
    if (!isAuthenticated) {
        logs.userUnauthenticated();
        throw httpErrors.unauthenticated();
    }
};
