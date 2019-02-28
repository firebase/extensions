/*
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import { firestore } from "firebase-admin";
import { FieldPath, FieldValue } from "@google-cloud/firestore";

export class NumericUpdate {
  private _data: { [key: string]: any } = {};
  get data() {return this._data; }

  /**
   * Merges numeric values from an arbitrary deep json into the NumericUpdate object.
   *  - it ignores non-numeric leaves
   *  - if there's a type mismatch ('number' vs 'object') current data will be overriden
   * @param from An object with numeric values to merge from.
   */
  public mergeFrom(from: { [key: string]: any }) {
    NumericUpdate.mergeRecursive(from, this._data);
  }

  /**
   * Exports an object with modified fields in the counter.
   * @param counter The counter data to be updated.
   */
  public toCounterUpdate(counter: { [key: string]: any }): { [key: string]: any } {
    NumericUpdate.addCommonFieldsRecursive(counter, this._data);
    return this._data;
  }

  /**
   * Exports an update object for partial shard.
   * 
   * Resulting operation will append current data to an array "_updates_".
   */
  public toPartialUpdate(): { [key: string]: any } {
    return { '_updates_': FieldValue.arrayUnion({
                '_timestamp_': FieldValue.serverTimestamp(),
                '_data_': this._data
              })
            };
  }

  private static mergeRecursive(from: {[key: string]: any}, to: {[key: string]: any}) {
    for (let key in from) {
      if (typeof from[key] === 'number') {
        if (key in to && typeof to[key] === 'number') {
          to[key] += from[key];
        } else {
          // Create a new node if doesn't exist or override if not a number.
          to[key] = from[key];
        }
      } else if (typeof from[key] === 'object') {
        if (key in to === false || typeof to[key] !== 'object') {
          to[key] = {};
        }
        NumericUpdate.mergeRecursive(from[key], to[key]);
      }
    }
  }

  private static addCommonFieldsRecursive(from: {[key: string]: any}, to: {[key: string]: any}) {
    for (let key in to) {
      if (typeof to[key] === 'number' && typeof from[key] === 'number') {
        to[key] += from[key];
      } else if (typeof to[key] === 'object' && typeof from[key] === 'object') {
        NumericUpdate.addCommonFieldsRecursive(from[key], to[key]);
      }
    }
  }
}

export class Aggregator {
  /**
   * Aggregates increments from shards and partials and returns an update object suitable for
   * DocumentRef.update() call.
   * @param counter Current snap of the main counter document. null means we aggregate to partial.
   * @param partials Shard snapshots with partial aggregations.
   * @param shards Shard snapshots with counter increments.
   *
   * TODO: Use numeric transforms instead of array transforms for partial aggregations.
   */
  public static aggregate(
    counter: firestore.DocumentSnapshot | null,
    partials: firestore.DocumentSnapshot[],
    shards: firestore.DocumentSnapshot[]): { [key: string]: any } {
    const update = new NumericUpdate();
    shards.forEach((shard) => {
      if (!shard.exists) return;
      const data = shard.data();
      update.mergeFrom(data);
    });
    partials.forEach((partial) => {
      if (!partial.exists) return;
      const data = partial.data();
      data['_updates_'].forEach((u) => {
        update.mergeFrom(u['_data_']);
      });
    });
    return (counter === null)
      ? update.toPartialUpdate()
      : update.toCounterUpdate(counter.data());
  }
}
