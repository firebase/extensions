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

import * as functions from "firebase-functions";

export const internal = (e: Error) =>
  new functions.https.HttpsError("internal", "Internal error", e);

export const invalidApiKey = () =>
  new functions.https.HttpsError(
    "unauthenticated",
    "Your SendGrid API key is invalid, expired or revoked"
  );

export const invalidDocPathField = () =>
  new functions.https.HttpsError(
    "invalid-argument",
    "DocPath or field are invalid"
  );

export const missingToken = () =>
  new functions.https.HttpsError(
    "invalid-argument",
    "Invitation token invalid or expired"
  );

export const unauthenticated = () =>
  new functions.https.HttpsError(
    "unauthenticated",
    "User must be authenticated to call this function"
  );
