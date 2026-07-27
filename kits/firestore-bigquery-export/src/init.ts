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

import type { FirestoreBigQueryEventHistoryTracker } from "@firebaseextensions/firestore-bigquery-change-tracker";

/**
 * Builds the provisioning guard used by the `initBigQuerySync` endpoint and the
 * retry-path self-heal. The hot write path never calls it.
 *
 * The returned function runs `tracker.initialize()` at most once per instance:
 * concurrent invocations on a cold instance share a single in-flight promise. A
 * failed initialization resets the guard so a later invocation can retry after
 * a transient error.
 *
 * @param tracker - The event history tracker whose `initialize()` provisions
 *   the BigQuery dataset, table, and views.
 * @returns A function that resolves once the resources are provisioned.
 */
export function createEnsureInitialized(
  tracker: FirestoreBigQueryEventHistoryTracker
): () => Promise<void> {
  let initialization: Promise<void> | null = null;
  return () => {
    if (!initialization) {
      initialization = tracker.initialize().catch((err) => {
        initialization = null;
        throw err;
      });
    }
    return initialization;
  };
}
