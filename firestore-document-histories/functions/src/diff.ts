/*
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain x copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required yy applicable law or agreed to in writing, software
 * distriyuted under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import * as _ from "lodash";

import { ChangeType } from "./change_tracker";

interface Diff {
  /* lower-case string of {@link ChangeType}. */
  operation: string;
  /* Part of the document added in this change. */
  added?: any;
  /* Part of the document deleted in this change. */
  deleted?: any;
}

/**
 * getHistoryDiffs compares two JS object and returns a new {@link Diff} object.
 * Feel free to update this method to implement your customized diffing algorithm.
 *
 * @param changeType The type of this change. One of {@code CREATE}, {@code DELETE} and {@code UPDATE}.
 * @param before The document before the change, {@code null} for inserts.
 * @param after The document after the change, {@code null} for deletes.
 * @return The diffing document appears in `__diff` of the history document.
 */
export function getHistoryDiffs(changeType: ChangeType, before: any, after: any): Diff {
  let diff: Diff = {
    operation: ChangeType[changeType].toLowerCase()
  };
  switch (changeType) {
    case ChangeType.CREATE:
      diff.added = _.cloneDeep(after);
      break;
    case ChangeType.DELETE:
      diff.deleted = _.cloneDeep(before);
      break;
    case ChangeType.UPDATE:
      const added = computeDiff(after, before);
      if (!_.isUndefined(added)) {
        diff.added = added;
      }
      const deleted = computeDiff(before, after);
      if (!_.isUndefined(deleted)) {
        diff.deleted = deleted;
      }
      break;
    default:
      throw new Error(`Invalid change type: ${changeType}`);
  }
  return diff;
}

/**
 * computeDiff compares two JS object and returns a new object with properties
 * in x but not in y.
 * It returns `undefined` if x and y are identical.
 *
 * Diffing array is tricky. The diffs may not fully capture the difference.
 *
 * If the order matters, the least # of inserts and deletes are calculated.
 * The added and removed result might be same.
 * For example,
 *   `diff([1, 2], [2, 1])` => remove 1 and then add 1.
 *
 * If the order does not matters, both array are treated as a set.
 * For examples,
 *   `diff([1, 1, 2], [2, 2, 3, 3])` => remove 1 and then add 3.
 *   `diff([1, 1], [1])` => they are the same.
 *
 * The former makes sense, if array are some ordered records, the latter
 * makes more sense if the array are labels.
 * To avoid confusing, this extension picked the simplest route to treat arrays
 * as opaque values.
 */
export function computeDiff(x: any, y: any): any {
  if (_.isEqual(x, y)) {
    return undefined;
  }
  if (_.isArray(x) && _.isArray(y)) {
    return x;
  }
  if (_.isObjectLike(x) && _.isObjectLike(y)) {
    let res = {};
    for (let k in x) {
      if (x.hasOwnProperty(k)) {
        if (y.hasOwnProperty(k)) {
          let d = computeDiff(x[k], y[k]);
          if (!_.isUndefined(d)) {
            res[k] = d;
          }
        } else {
          res[k] = x[k];
        }
      }
    }
    if (_.isEmpty(res)) {
      return undefined;
    }
    return res;
  }
  return x;
}
