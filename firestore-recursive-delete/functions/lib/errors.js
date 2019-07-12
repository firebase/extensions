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
exports.invalidArgument = (argument) => new functions.https.HttpsError("invalid-argument", `Must specify a '${argument}' argument.`);
exports.permissionDenied = () => new functions.https.HttpsError("permission-denied", "User must have the 'fsdelete' custom claim set to 'true'");
exports.unauthenticated = () => new functions.https.HttpsError("unauthenticated", "User must be authenticated to call this function");
exports.unknown = (e) => new functions.https.HttpsError("unknown", JSON.stringify(e));
