"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const httpErrors = require("./errors");
const logs = require("./logs");
exports.docPathFieldValid = (docPath, field) => {
    const valid = docPath && field;
    if (!valid) {
        logs.docPathFieldInvalid(docPath, field);
        throw httpErrors.invalidDocPathField();
    }
};
exports.invitationExists = (snapshot, invitationId) => {
    const { exists } = snapshot;
    if (!exists) {
        logs.invitationDoesNotExist(invitationId);
        throw httpErrors.missingToken();
    }
};
exports.userIsAuthenticated = (auth) => {
    const isAuthenticated = auth && auth.uid;
    if (!isAuthenticated) {
        logs.userUnauthenticated();
        throw httpErrors.unauthenticated();
    }
};
