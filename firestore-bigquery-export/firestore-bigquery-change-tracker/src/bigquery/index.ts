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

import * as bigquery from "@google-cloud/bigquery";
import * as firebase from "firebase-admin";
import traverse from "traverse";
import { firestoreToBQTable } from "./schema";
import { latestConsistentSnapshotView } from "./snapshot";

import {
  ChangeType,
  FirestoreEventHistoryTracker,
  FirestoreDocumentChangeEvent,
} from "../tracker";
import * as logs from "../logs";

export interface FirestoreBigQueryEventHistoryTrackerConfig {
  datasetId: string;
  tableId: string;
}

/**
 * An FirestoreEventHistoryTracker that exports data to BigQuery.
 *
 * When the first event is received, it creates necessary BigQuery resources:
 * - Dataset: {@link FirestoreBigQueryEventHistoryTrackerConfig#datasetId}.
 * - Table: Raw change log table {@link FirestoreBigQueryEventHistoryTracker#rawChangeLogTableName}.
 * - View: Latest view {@link FirestoreBigQueryEventHistoryTracker#rawLatestView}.
 * If any subsequent data export fails, it will attempt to reinitialize.
 */
export class FirestoreBigQueryEventHistoryTracker
  implements FirestoreEventHistoryTracker {
  bq: bigquery.BigQuery;
  initialized: boolean = false;

  constructor(public config: FirestoreBigQueryEventHistoryTrackerConfig) {
    this.bq = new bigquery.BigQuery();
  }

  async record(events: FirestoreDocumentChangeEvent[]) {
    await this.initialize();

    const rows = events.map((event) => {
      return {
        insertId: event.eventId,
        json: {
          timestamp: event.timestamp,
          event_id: event.eventId,
          document_name: event.documentName,
          operation: ChangeType[event.operation],
          data: JSON.stringify(this.serializeData(event.data)),
        },
      };
    });
    await this.insertData(rows);
  }

  serializeData(eventData: any) {
    if (typeof eventData === "undefined") {
      return undefined;
    }

    const data = traverse(eventData).map((property) => {
      if (property instanceof firebase.firestore.DocumentReference) {
        return property.path;
      }

      return property;
    });

    return data;
  }

  /**
   * Inserts rows of data into the BigQuery raw change log table.
   */
  private async insertData(rows: bigquery.RowMetadata[]) {
    const options = {
      skipInvalidRows: false,
      ignoreUnknownValues: false,
      raw: true,
    };
    try {
      const dataset = this.bq.dataset(this.config.datasetId);
      const table = dataset.table(this.rawChangeLogTableName());
      logs.dataInserting(rows.length);
      await table.insert(rows, options);
      logs.dataInserted(rows.length);
    } catch (e) {
      // Reinitializing in case the destintation table is modified.
      this.initialized = false;
      throw e;
    }
  }

  /**
   * Creates the BigQuery resources with the expected schema for {@link FirestoreEventHistoryTracker}.
   * After the first invokation, it skips initialization assuming these resources are still there.
   */
  private async initialize() {
    if (this.initialized) {
      return;
    }
    await this.initializeDataset();
    await this.initializeRawChangeLogTable();
    await this.initializeLatestView();
    this.initialized = true;
  }

  /**
   * Creates the specified dataset if it doesn't already exists.
   */
  private async initializeDataset() {
    const dataset = this.bq.dataset(this.config.datasetId);
    const [datasetExists] = await dataset.exists();
    if (datasetExists) {
      logs.bigQueryDatasetExists(this.config.datasetId);
    } else {
      logs.bigQueryDatasetCreating(this.config.datasetId);
      await dataset.create();
      logs.bigQueryDatasetCreated(this.config.datasetId);
    }
    return dataset;
  }

  /**
   * Creates the raw change log table if it doesn't already exist.
   * TODO: Validate that the BigQuery schema is correct if the table does exist,
   */
  private async initializeRawChangeLogTable() {
    const changelogName = this.rawChangeLogTableName();
    const dataset = this.bq.dataset(this.config.datasetId);
    const table = dataset.table(changelogName);
    const [tableExists] = await table.exists();

    if (tableExists) {
      logs.bigQueryTableAlreadyExists(table.id, dataset.id);
    } else {
      logs.bigQueryTableCreating(changelogName);
      const options = {
        // `friendlyName` needs to be here to satisfy TypeScript
        friendlyName: changelogName,
        schema: firestoreToBQTable(),
      };
      await table.create(options);
      logs.bigQueryTableCreated(changelogName);
    }
    return table;
  }

  /**
   * Creates the latest snapshot view, which returns only latest operations
   * of all existing documents over the raw change log table.
   */
  private async initializeLatestView() {
    const dataset = this.bq.dataset(this.config.datasetId);
    const view = dataset.table(this.rawLatestView());
    const [viewExists] = await view.exists();

    if (viewExists) {
      logs.bigQueryViewAlreadyExists(view.id, dataset.id);
    } else {
      const latestSnapshot = latestConsistentSnapshotView(
        this.config.datasetId,
        this.rawChangeLogTableName()
      );
      logs.bigQueryViewCreating(this.rawLatestView(), latestSnapshot.query);
      const options = {
        friendlyName: this.rawLatestView(),
        view: latestSnapshot,
      };
      await view.create(options);
      logs.bigQueryViewCreated(this.rawLatestView());
    }
    return view;
  }

  private rawChangeLogTableName(): string {
    return `${this.config.tableId}_raw_changelog`;
  }

  private rawLatestView(): string {
    return `${this.config.tableId}_raw_latest`;
  }
}
