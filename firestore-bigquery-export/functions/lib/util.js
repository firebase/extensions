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
exports.getDocumentTree = exports.getDocumentId = exports.getChangeType = void 0;
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
function getDocumentTree(change) {
    if (change.after.exists) {
        return getFirestoreJsonTree(change.after.ref.path);
    }
    return getFirestoreJsonTree(change.before.ref.path);
}
exports.getDocumentTree = getDocumentTree;
function getFirestoreJsonTree(path) {
    return path.split("/").reduce((acc, value, index) => {
        let object = { id: "", type: "", parent: null };
        if (index % 2 === 1) {
            object.id = value;
            object.type = "document";
        }
        else {
            object.id = value;
            object.type = "collection";
        }
        object.parent = acc;
        return object;
    }, null);
}

console.log(JSON.stringify(getFirestoreJsonTree("collectionID/348128348/bigQueryTimestamp10/TObmosD16Gg5siavxE3H/subcollection/pFSm9rZjxhAwtfWQsPpK")))
