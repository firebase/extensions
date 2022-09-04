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
exports.queryRange = exports.containsManyUpdates = exports.isUpdatedFrequently = void 0;
function isUpdatedFrequently(shard) {
    if (!shard.exists)
        return false;
    // has it been updated in the past 30 seconds?
    return Date.now() / 1000 - shard.updateTime.seconds < 30;
}
exports.isUpdatedFrequently = isUpdatedFrequently;
/**
 * Partials are updated by appending to their internal "_updates_" array.
 * It grows unbounded and requires periodic compaction. This function
 * checks if partial shards has grown too big.
 */
function containsManyUpdates(partial) {
    if (!partial.exists)
        return false;
    const data = partial.data();
    return "_updates_" in data && data["_updates_"].length > 10;
}
exports.containsManyUpdates = containsManyUpdates;
/**
 * Constructs a collection group query to read all shards within provided range.
 */
function queryRange(db, collectionId, start, end, limit) {
    let query = db.collectionGroup(collectionId).orderBy("__name__");
    if (start !== "") {
        query = query.startAt(start);
    }
    if (end !== "") {
        query = query.endBefore(end);
    }
    query = query.limit(limit);
    return query;
}
exports.queryRange = queryRange;
