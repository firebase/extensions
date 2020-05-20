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
exports.Planner = void 0;
const path = require("path");
class Planner {
    /**
     * Takes all the shard snapshots and creates aggregation plans.
     * @param start Beginning of document range for this worker.
     * @param snaps List of shard snapshots to aggregate.
     */
    static planAggregations(start, snaps) {
        if (snaps.length === 0)
            return [];
        let result = [];
        let prefixLen = Planner.aggrPrefixLen(start, snaps[snaps.length - 1].ref.path);
        let [aggregate, isPartial] = Planner.constructAggregate(snaps[snaps.length - 1].ref.path, prefixLen);
        let shards = [];
        let partials = [];
        for (let i = snaps.length - 1; i >= 0; i--) {
            let [newAggregate, newIsPartial] = Planner.constructAggregate(snaps[i].ref.path, prefixLen);
            if (newAggregate !== aggregate) {
                shards.reverse();
                partials.reverse();
                result.push({
                    aggregate: aggregate,
                    isPartial: isPartial,
                    shards: shards,
                    partials: partials,
                });
                aggregate = newAggregate;
                isPartial = newIsPartial;
                shards = [];
                partials = [];
            }
            if (Planner.isPartialShard(snaps[i].ref.path)) {
                partials.push(snaps[i]);
            }
            else {
                shards.push(snaps[i]);
            }
        }
        shards.reverse();
        partials.reverse();
        result.push({
            aggregate: aggregate,
            isPartial: isPartial,
            shards: shards,
            partials: partials,
        });
        result.reverse();
        return result;
    }
    static constructAggregate(shard, prefixLen) {
        if (prefixLen === 0)
            return [path.dirname(path.dirname(shard)), false];
        let collection = path.dirname(shard);
        shard = path.basename(shard);
        shard = Planner.decodeShard(shard);
        // Make sure we're making a progress.
        if (shard.length <= prefixLen)
            prefixLen--;
        shard = shard.substring(0, Math.min(prefixLen, 4));
        shard = Planner.encodeShard(shard);
        return [path.join(collection, shard), true];
    }
    static aggrPrefixLen(start, end) {
        if (start === "")
            return 0;
        if (path.dirname(start) !== path.dirname(end))
            return 0;
        const shard1 = Planner.decodeShard(path.basename(start));
        const shard2 = Planner.decodeShard(path.basename(end));
        if (shard1.length !== shard2.length)
            return 0;
        for (let i = 0; i < Math.min(shard1.length, 4); i++) {
            if (shard1.charAt(i) !== shard2.charAt(i))
                return i + 1;
        }
        return 4;
    }
    static decodeShard(shard) {
        while (shard.charAt(0) === "\t")
            shard = shard.substring(1);
        return shard;
    }
    static encodeShard(shard) {
        while (shard.length < 5)
            shard = "\t" + shard;
        return shard;
    }
    static isPartialShard(shard) {
        return path.basename(shard).charAt(0) === "\t";
    }
}
exports.Planner = Planner;
