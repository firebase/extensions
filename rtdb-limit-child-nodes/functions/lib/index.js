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
exports.rtdblimit = void 0;
const functions = require("firebase-functions");
const config_1 = require("./config");
const logs = require("./logs");
logs.init();
// https://stackoverflow.com/questions/37872478/how-to-get-firebase-database-reference-full-path
function fullPath(ref) {
    return ref.toString().substring(ref.root.toString().length - 1);
}
function cleanPath(path) {
    const lastIndex = path.length - 1;
    if (path[lastIndex] === "/") {
        return path.substring(0, lastIndex);
    }
    return path;
}
const configPath = cleanPath(config_1.default.nodePath);
exports.rtdblimit = functions.database.ref(`${configPath}/{nodeId}`).onCreate(async (snapshot) => {
    logs.start();
    try {
        const parentRef = snapshot.ref.parent;
        const parentSnapshot = await parentRef.once("value");
        const path = fullPath(parentRef);
        logs.childCount(path, parentSnapshot.numChildren());
        if (parentSnapshot.numChildren() > config_1.default.maxCount) {
            let childCount = 0;
            const updates = {};
            parentSnapshot.forEach((child) => {
                if (++childCount <= parentSnapshot.numChildren() - config_1.default.maxCount) {
                    updates[child.key] = null;
                }
            });
            logs.pathTruncating(path, config_1.default.maxCount);
            await parentRef.update(updates);
            logs.pathTruncated(path, config_1.default.maxCount);
        }
        else {
            logs.pathSkipped(path);
        }
        logs.complete();
    }
    catch (err) {
        logs.error(err);
    }
});
