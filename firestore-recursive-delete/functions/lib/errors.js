"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions = require("firebase-functions");
exports.invalidArgument = (argument) => new functions.https.HttpsError("invalid-argument", `Must specify a '${argument}' argument.`);
exports.permissionDenied = () => new functions.https.HttpsError("permission-denied", "User must have the 'fsdelete' custom claim set to 'true'");
exports.unauthenticated = () => new functions.https.HttpsError("unauthenticated", "User must be authenticated to call this function");
exports.unknown = (e) => new functions.https.HttpsError("unknown", JSON.stringify(e));
