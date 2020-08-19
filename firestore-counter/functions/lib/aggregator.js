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
exports.Aggregator = exports.NumericUpdate = void 0;
const firebase_admin_1 = require("firebase-admin");
const uuid = require("uuid");
class NumericUpdate {
    constructor() {
        this.data = {};
    }
    /**
     * Merges numeric values from an arbitrary deep json into the NumericUpdate object.
     *  - it ignores non-numeric leaves
     *  - if there's a type mismatch ('number' vs 'object') current data will be overridden
     * @param from An object with numeric values to merge from.
     */
    mergeFrom(from) {
        NumericUpdate.mergeRecursive(from, this.data, false);
    }
    /**
     * Subtracts numeric values in an arbitrary deep json from the NumericUpdate object.
     *  - it ignores non-numeric leaves
     *  - if there's a type mismatch ('number' vs 'object') current data will be overridden
     * @param from An object with numeric values to merge from.
     */
    subtractFrom(from) {
        NumericUpdate.mergeRecursive(from, this.data, true);
    }
    /**
     * Exports an object with modified fields in the counter.
     * @param counter The counter data to be updated.
     */
    toCounterUpdate(counter) {
        NumericUpdate.addCommonFieldsRecursive(counter, this.data);
        return this.data;
    }
    /**
     * Exports an update object for partial shard.
     *
     * Resulting operation will append current data to an array "_updates_".
     */
    toPartialUpdate(uuidv4) {
        if (this.isNoop())
            return {};
        return {
            _updates_: firebase_admin_1.firestore.FieldValue.arrayUnion({
                _id_: uuidv4(),
                _data_: this.data,
            }),
        };
    }
    toPartialShard(uuidv4) {
        return {
            _updates_: [
                {
                    _id_: uuidv4(),
                    _data_: this.data,
                },
            ],
        };
    }
    isNoop() {
        return NumericUpdate.isNoop(this.data);
    }
    static mergeRecursive(from, to, subtract) {
        for (let key in from) {
            if (typeof from[key] === "number") {
                if (key in to && typeof to[key] === "number") {
                    to[key] += subtract ? -from[key] : from[key];
                }
                else {
                    // Create a new node if doesn't exist or override if not a number.
                    to[key] = subtract ? -from[key] : from[key];
                }
            }
            else if (typeof from[key] === "object") {
                if (key in to === false || typeof to[key] !== "object") {
                    to[key] = {};
                }
                NumericUpdate.mergeRecursive(from[key], to[key], subtract);
            }
        }
    }
    static addCommonFieldsRecursive(from, to) {
        for (let key in to) {
            if (typeof to[key] === "number" && typeof from[key] === "number") {
                to[key] += from[key];
            }
            else if (typeof to[key] === "object" && typeof from[key] === "object") {
                NumericUpdate.addCommonFieldsRecursive(from[key], to[key]);
            }
        }
    }
    /**
     * Return true only if object contains only numeric fields and they are all 0.
     */
    static isNoop(doc) {
        for (let key in doc) {
            if (typeof doc[key] === "number") {
                if (doc[key] !== 0)
                    return false;
            }
            else if (typeof doc[key] === "object") {
                if (!NumericUpdate.isNoop(doc[key]))
                    return false;
            } /* type is not a number nor object */
            else {
                return false;
            }
        }
        return true;
    }
}
exports.NumericUpdate = NumericUpdate;
class Aggregator {
    constructor(uuidv4 = uuid.v4) {
        this.uuidv4 = uuidv4;
    }
    /**
     * Aggregates increments from shards and partials and returns an update object suitable for
     * DocumentRef.update() call.
     * @param counter Current snap of the main counter document. null means we aggregate to partial.
     * @param partials Shard snapshots with partial aggregations.
     * @param shards Shard snapshots with counter increments.
     */
    aggregate(counter, partials, shards) {
        const update = new NumericUpdate();
        shards.forEach((shard) => {
            if (!shard.exists)
                return;
            const data = shard.data();
            update.mergeFrom(data);
        });
        partials.forEach((partial) => {
            if (!partial.exists)
                return;
            const data = partial.data();
            data["_updates_"].forEach((u) => {
                update.mergeFrom(u["_data_"]);
            });
        });
        return counter === null
            ? update.toPartialUpdate(this.uuidv4)
            : update.toCounterUpdate(counter.exists ? counter.data() : {});
    }
    /**
     * Returns an update object that will subtract the sum of all the fields in a partial.
     * @param partial Snapshot with partial aggregations to be subtracted.
     */
    subtractPartial(partial) {
        const update = new NumericUpdate();
        if (partial.exists) {
            const data = partial.data();
            data["_updates_"].forEach((u) => {
                update.subtractFrom(u["_data_"]);
            });
        }
        return update.toPartialUpdate(this.uuidv4);
    }
}
exports.Aggregator = Aggregator;
