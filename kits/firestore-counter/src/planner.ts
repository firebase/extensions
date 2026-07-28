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

import type { DocumentSnapshot } from "firebase-admin/firestore";
import * as path from "path";

/**
 * There are two types of shards: "shard" and "partial".
 *
 * "shard" is incremented by client application and, since each app instance has its own unique
 * shard, these are not contended.
 * "partial" contains partial aggregation from up to 499 "shards" and is updated by worker. These
 * update frequently and workers modify them using array transforms rather than transaction to
 * avoid contention.
 * "counter" is not a shard but the main document that aggregates all increments from all shards
 *
 * Planner takes a list of shards (these can be partials or shards) and decides how to aggregate
 * them to avoid contention.
 */

interface AggregationPlan {
  aggregate: string; // a document path to store this aggregation
  isPartial: boolean; // is the aggregate a partial shard or the main counter
  shards: DocumentSnapshot[]; // shards to be aggregated
  partials: DocumentSnapshot[]; // partials to be aggregated
}

export class Planner {
  /**
   * Takes all the shard snapshots and creates aggregation plans.
   * @param start Beginning of document range for this worker.
   * @param snaps List of shard snapshots to aggregate.
   */
  public static planAggregations(
    start: string,
    snaps: DocumentSnapshot[]
  ): AggregationPlan[] {
    if (snaps.length === 0) return [];

    const result: AggregationPlan[] = [];

    const prefixLen = Planner.aggrPrefixLen(
      start,
      snaps[snaps.length - 1].ref.path
    );
    let [aggregate, isPartial] = Planner.constructAggregate(
      snaps[snaps.length - 1].ref.path,
      prefixLen
    );
    let shards: DocumentSnapshot[] = [];
    let partials: DocumentSnapshot[] = [];
    for (let i = snaps.length - 1; i >= 0; i--) {
      const [newAggregate, newIsPartial] = Planner.constructAggregate(
        snaps[i].ref.path,
        prefixLen
      );
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
      } else {
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

  protected static constructAggregate(
    shard: string,
    prefixLen
  ): [string, boolean] {
    if (prefixLen === 0) return [path.dirname(path.dirname(shard)), false];

    const collection = path.dirname(shard);
    shard = path.basename(shard);
    shard = Planner.decodeShard(shard);

    // Make sure we're making a progress.
    if (shard.length <= prefixLen) prefixLen--;

    shard = shard.substring(0, Math.min(prefixLen, 4));
    shard = Planner.encodeShard(shard);
    return [path.join(collection, shard), true];
  }

  protected static aggrPrefixLen(start: string, end: string): number {
    if (start === "") return 0;
    if (path.dirname(start) !== path.dirname(end)) return 0;

    const shard1 = Planner.decodeShard(path.basename(start));
    const shard2 = Planner.decodeShard(path.basename(end));
    if (shard1.length !== shard2.length) return 0;

    for (let i = 0; i < Math.min(shard1.length, 4); i++) {
      if (shard1.charAt(i) !== shard2.charAt(i)) return i + 1;
    }
    return 4;
  }

  protected static decodeShard(shard: string): string {
    while (shard.charAt(0) === "\t") shard = shard.substring(1);
    return shard;
  }

  protected static encodeShard(shard: string): string {
    while (shard.length < 5) shard = "\t" + shard;
    return shard;
  }

  protected static isPartialShard(shard: string): boolean {
    return path.basename(shard).charAt(0) === "\t";
  }
}
