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
const configuration = () => ({
    location: process.env.LOCATION,
});
exports.deletePath = (userId, path) => {
    console.log(`User: ${userId} has requested to delete path: '${path}'`);
};
exports.error = (path, e) => {
    console.error(`Error when trying to delete: '${path}'`, e);
};
exports.init = () => {
    console.log("Initialising mod with configuration", configuration());
};
exports.pathMissing = () => {
    console.warn("Unable to delete, no 'path' is specified");
};
exports.start = () => {
    console.log("Started mod execution with configuration", configuration());
};
exports.success = (path) => {
    console.log(`Path: '${path}' was successfully deleted`);
};
exports.userMissingClaim = () => {
    console.warn("Unable to delete, the user does not have the 'fsdelete' custom claim");
};
exports.userUnauthenticated = () => {
    console.warn("Unable to delete, the user is unauthenticated");
};
