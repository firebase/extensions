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

import type { ResolvedExportConfig } from "../src/export-config";
import type { TransferRunPayload, TransferRunState } from "../src/types";

export const baseConfig: ResolvedExportConfig = {
  projectId: "test",
  displayName: "Transactions Rollup",
  datasetId: "destination_dataset_id",
  tableName: "transactions",
  queryString: "Select * from `test-project.transaction_data.transactions`",
  schedule: "every 15 minutes",
  location: "us-central1",
  bigqueryDatasetLocation: "us",
  instanceId: "firestore-bigquery-scheduler",
  pubsubTopic: "transfer_runs",
  firestoreCollection: "transferConfigs",
  logLevel: "silent",
};

export const liveTransferConfig = () => ({
  name: "projects/409146382768/locations/us/transferConfigs/642f3a36-0000-2fbb-ad1d-001a114e2fa6",
  destinationDatasetId: "destination_dataset_id",
  displayName: "Transactions Rollup",
  dataSourceId: "scheduled_query",
  params: {
    fields: {
      query: {
        stringValue:
          "Select * from `test-project.transaction_data.transactions`",
      },
      destination_table_name_template: {
        stringValue: 'transactions_{run_time|"%H%M%S"}',
      },
      write_disposition: { stringValue: "WRITE_TRUNCATE" },
      partitioning_field: { stringValue: "" },
    },
  },
  schedule: "every 15 minutes",
  notificationPubsubTopic: "projects/test/topics/transfer_runs",
});

export function runPayload(
  overrides: Partial<TransferRunPayload> = {}
): TransferRunPayload {
  return {
    name: "projects/test/locations/us/transferConfigs/config-1/runs/run-1",
    runTime: "2026-08-01T12:34:56Z",
    state: "SUCCEEDED" as TransferRunState,
    destinationDatasetId: "destination_dataset_id",
    dataSourceId: "scheduled_query",
    schedule: "every 15 minutes",
    scheduleTime: "2026-08-01T12:34:00Z",
    startTime: "2026-08-01T12:34:10Z",
    endTime: "2026-08-01T12:34:50Z",
    updateTime: "2026-08-01T12:34:55Z",
    userId: "user",
    notificationPubsubTopic: "projects/test/topics/transfer_runs",
    params: {
      destination_table_name_template: 'transactions_{run_time|"%H%M%S"}',
      partitioning_field: "",
      query: "q",
      write_disposition: "WRITE_TRUNCATE",
    },
    emailPreferences: {},
    errorStatus: {},
    ...overrides,
  };
}

interface FakeDoc {
  id: string;
  data: Record<string, unknown>;
}

/**
 * Minimal in-memory Firestore fake covering the operations the handlers use:
 * collection().where().get(), collection().doc().set()/get(),
 * collection().add(), and runTransaction with get/set.
 */
export function makeFakeFirestore(seed: Record<string, FakeDoc[]> = {}) {
  const collections = new Map<string, Map<string, Record<string, unknown>>>();
  for (const [path, docs] of Object.entries(seed)) {
    collections.set(path, new Map(docs.map((d) => [d.id, d.data])));
  }
  let autoId = 0;

  function getCollection(path: string) {
    if (!collections.has(path)) {
      collections.set(path, new Map());
    }
    return collections.get(path)!;
  }

  function makeDocRef(path: string, id: string) {
    return {
      id,
      async get() {
        const data = getCollection(path).get(id);
        return { exists: data !== undefined, data: () => data };
      },
      async set(data: Record<string, unknown>) {
        getCollection(path).set(id, data);
      },
    };
  }

  const db = {
    collection(path: string) {
      return {
        doc(id: string) {
          return makeDocRef(path, id);
        },
        async add(data: Record<string, unknown>) {
          const id = `auto-${autoId++}`;
          getCollection(path).set(id, data);
          return makeDocRef(path, id);
        },
        where(field: string, _op: string, value: unknown) {
          return {
            async get() {
              const docs = [...getCollection(path).entries()]
                .filter(([, data]) => data[field] === value)
                .map(([id, data]) => ({ id, data: () => data }));
              return { size: docs.length, docs };
            },
          };
        },
      };
    },
    async runTransaction(
      fn: (transaction: {
        get: (ref: ReturnType<typeof makeDocRef>) => Promise<{
          exists: boolean;
          data: () => Record<string, unknown> | undefined;
        }>;
        set: (
          ref: ReturnType<typeof makeDocRef>,
          data: Record<string, unknown>
        ) => void;
      }) => Promise<void>
    ) {
      await fn({
        get: (ref) => ref.get(),
        set: (ref, data) => {
          void ref.set(data);
        },
      });
    },
    /** Test-only: read a doc's raw data. */
    _get(path: string, id: string) {
      return getCollection(path).get(id);
    },
    /** Test-only: list a collection's docs. */
    _list(path: string) {
      return [...getCollection(path).entries()];
    },
  };

  return db;
}
