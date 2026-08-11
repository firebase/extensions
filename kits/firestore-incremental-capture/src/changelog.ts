/*
 * Copyright 2026 Google LLC
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

/** How a captured document changed. */
export type ChangeType = "CREATE" | "UPDATE" | "DELETE";

/**
 * One row of the BigQuery changelog.
 *
 * `beforeData` and `afterData` are JSON strings rather than objects because the
 * columns are BigQuery `JSON`, and because the Dataflow pipeline parses them
 * with Gson. See {@link serializeDocument} for the value encoding.
 */
export interface ChangelogRow {
  documentId: string;
  documentPath: string;
  beforeData: string;
  afterData: string;
  changeType: ChangeType;
  /** RFC 3339 event time, matching the BigQuery `TIMESTAMP` column. */
  timestamp: string;
}

/**
 * Schema of the changelog table.
 *
 * The Dataflow pipeline queries these columns by name
 * (`IncrementalCaptureLog`), so the column names are part of the contract
 * between the kit and `pipeline/`.
 */
export const CHANGELOG_SCHEMA = [
  { name: "documentId", type: "STRING", mode: "REQUIRED" },
  { name: "documentPath", type: "STRING", mode: "REQUIRED" },
  { name: "beforeData", type: "JSON" },
  { name: "afterData", type: "JSON" },
  { name: "changeType", type: "STRING", mode: "REQUIRED" },
  { name: "timestamp", type: "TIMESTAMP", mode: "REQUIRED" },
] as const;
