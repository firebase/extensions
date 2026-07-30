/**
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

import * as admin from "firebase-admin";

export interface CliConfig {
  kind: "CONFIG";
  projectId: string;
  bigQueryProjectId: string;
  sourceCollectionPath: string;
  datasetId: string;
  tableId: string;
  batchSize: number;
  queryCollectionGroup: boolean;
  datasetLocation: string;
  multiThreaded: boolean;
  useNewSnapshotQuerySyntax: boolean;
  useEmulator: boolean;
  rawChangeLogName: string;
  cursorPositionFile: string;
  failedBatchOutput?: string;
  transformFunctionUrl?: string;
  firestoreInstanceId: string;
}

export interface CliConfigError {
  kind: "ERROR";
  errors: string[];
}

export interface SerializableQuery {
  startAt?: {
    before: boolean;
    values: Array<{
      referenceValue: string;
      valueType: string;
    }>;
  };
  endAt?: {
    before: boolean;
    values: Array<{
      referenceValue: string;
      valueType: string;
    }>;
  };
  limit?: number;
  offset?: number;
}

export interface QueryOptions
  extends admin.firestore.Query<admin.firestore.DocumentSnapshot<any>> {
  _queryOptions: SerializableQuery;
}
