"use strict";
/*
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const functions = require("firebase-functions");
exports.internal = (e) => new functions.https.HttpsError("internal", "Internal error", e);
exports.invalidApiKey = () => new functions.https.HttpsError("unauthenticated", "Your SendGrid API key is invalid, expired or revoked");
exports.invalidDocPathField = () => new functions.https.HttpsError("invalid-argument", "DocPath or field are invalid");
exports.missingToken = () => new functions.https.HttpsError("invalid-argument", "Invitation token invalid or expired");
exports.unauthenticated = () => new functions.https.HttpsError("unauthenticated", "User must be authenticated to call this function");
