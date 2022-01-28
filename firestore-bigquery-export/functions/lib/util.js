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
exports.getCollectionPathParams = exports.getDocumentId = exports.getChangeType = void 0;
const config_1 = require("./config");
const fbct_1 = require("@posiek07/fbct");
function getChangeType(change) {
    if (!change.after.exists) {
        return fbct_1.ChangeType.DELETE;
    }
    if (!change.before.exists) {
        return fbct_1.ChangeType.CREATE;
    }
    return fbct_1.ChangeType.UPDATE;
}
exports.getChangeType = getChangeType;
function getDocumentId(change) {
    if (change.after.exists) {
        return change.after.id;
    }
    return change.before.id;
}
exports.getDocumentId = getDocumentId;
function getCollectionPathParams(change) {
    if (change.after.exists) {
        return getWildcardParamsValues(change.after.ref.path);
    }
    return getWildcardParamsValues(change.before.ref.path);
}
exports.getCollectionPathParams = getCollectionPathParams;
function getWildcardParamsValues(path) {
    const pathArray = path
        .split("/")
        .filter(($, i) => i % 2)
        .slice(0, -1);
    const collectionArray = config_1.default.collectionPath
        .split("/")
        .filter(($, i) => i % 2)
        .map((value) => value.replace(/[{}]/g, ""));
    return convertEqualStringArraysToObj(collectionArray, pathArray);
}
function convertEqualStringArraysToObj(a, b) {
    if (a.length != b.length || a.length == 0 || b.length == 0) {
        return null;
    }
    let obj = {};
    a.forEach((k, i) => {
        obj[k] = b[i];
    });
    return obj;
}
