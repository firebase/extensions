"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions = require("firebase-functions");
exports.internal = (e) => new functions.https.HttpsError("internal", JSON.stringify(e));
exports.invalidDocPathField = () => new functions.https.HttpsError("invalid-argument", "DocPath or field are invalid");
exports.missingToken = () => new functions.https.HttpsError("invalid-argument", "Invitation token invalid or expired");
exports.unauthenticated = () => new functions.https.HttpsError("unauthenticated", "User must be authenticated to call this function");
