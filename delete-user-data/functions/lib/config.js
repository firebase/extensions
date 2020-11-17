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
exports.default = {
    location: process.env.LOCATION,
    firestorePaths: process.env.FIRESTORE_PATHS,
    firestoreDeleteMode: process.env.FIRESTORE_DELETE_MODE,
    rtdbPaths: process.env.RTDB_PATHS,
    storagePaths: process.env.STORAGE_PATHS,
    SELECTED_DATABASE_INSTANCE: process.env.SELECTED_DATABASE_INSTANCE,
};
