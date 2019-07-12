"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Copyright 2019 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const functions = require("firebase-functions");
const config_1 = require("./config");
const logs = require("./logs");
logs.init();
exports.rtdblimit = functions.handler.database.ref.onCreate((snapshot) => __awaiter(this, void 0, void 0, function* () {
    logs.start();
    try {
        const parentRef = snapshot.ref.parent;
        const parentSnapshot = yield parentRef.once("value");
        logs.childCount(parentRef.path, parentSnapshot.numChildren());
        if (parentSnapshot.numChildren() > config_1.default.maxCount) {
            let childCount = 0;
            const updates = {};
            parentSnapshot.forEach((child) => {
                if (++childCount <= parentSnapshot.numChildren() - config_1.default.maxCount) {
                    updates[child.key] = null;
                }
            });
            logs.pathTruncating(parentRef.path, config_1.default.maxCount);
            yield parentRef.update(updates);
            logs.pathTruncated(parentRef.path, config_1.default.maxCount);
        }
        else {
            logs.pathSkipped(parentRef.path);
        }
        logs.complete();
    }
    catch (err) {
        logs.error(err);
    }
}));
