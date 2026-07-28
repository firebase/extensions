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

import { firestore } from "firebase-admin";

/**
 * Represents a document range that a single worker is responsible for.
 * 'start' and 'end' are paths to documents (the documents don't have to exist).
 */
export interface Slice {
  start: string; // a path to a first document (inclusive) in the slice
  end: string; // a path to a last document (exclusive) in the slice
}

/**
 * Each worker writes these stats at the end of successful run.
 */
export interface WorkerStats {
  lastSuccessfulRun: number; // epoch of last run
  shardsAggregated: number; // # of shards aggregated
  splits: string[]; // aggregated shards sampled every 100th element
  rounds: number; // number of aggregation rounds
  roundsCapped: number; // number of rounds that hit the query limit of 499 shards
}

export function isUpdatedFrequently(
  shard: firestore.DocumentSnapshot
): boolean {
  if (!shard.exists) return false;
  // has it been updated in the past 30 seconds?
  return Date.now() / 1000 - shard.updateTime.seconds < 30;
}

/**
 * Partials are updated by appending to their internal "_updates_" array.
 * It grows unbounded and requires periodic compaction. This function
 * checks if partial shards has grown too big.
 */
export function containsManyUpdates(
  partial: firestore.DocumentSnapshot
): boolean {
  if (!partial.exists) return false;
  const data = partial.data();
  return "_updates_" in data && data["_updates_"].length > 10;
}

/**
 * Constructs a collection group query to read all shards within provided range.
 */
export function queryRange(
  db: firestore.Firestore,
  collectionId: string,
  start: string,
  end: string,
  limit: number
): firestore.Query {
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
