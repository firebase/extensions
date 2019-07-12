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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const functions = require("firebase-functions");
const tools = require("firebase-tools");
const assertions = require("./assertions");
const httpErrors = require("./errors");
const logs = require("./logs");
logs.init();
exports.fsdelete = functions.https.onCall((data, context) => __awaiter(this, void 0, void 0, function* () {
    logs.start();
    const { auth } = context;
    assertions.userIsAuthenticated(auth);
    const { token, uid } = auth;
    assertions.userHasClaim(token);
    const { path: deletePath } = data;
    assertions.pathExists(deletePath);
    logs.deletePath(uid, deletePath);
    try {
        yield tools.firestore.delete(deletePath, {
            project: process.env.PROJECT_ID,
            recursive: true,
            yes: true,
        });
        logs.success(deletePath);
        return {
            path: deletePath,
        };
    }
    catch (err) {
        logs.error(deletePath, err);
        throw httpErrors.unknown(err);
    }
}));
