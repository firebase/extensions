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
import {
  firestoreToBQTable,
  latestConsistentSnapshotView
} from "./schema";
import { ChangeType, FirestoreEventHistoryTracker, FirestoreDocumentChangeEvent } from "../firestoreEventHistoryTracker";
import * as logs from "../logs";

export class FirestoreBigQueryEventHistoryTracker implements FirestoreEventHistoryTracker {
  bq: bigquery.BigQuery;

  constructor(public config: any, public schemaInitialized: boolean = false) {
    this.bq = new bigquery.BigQuery();
  }

  async record(events: FirestoreDocumentChangeEvent | FirestoreDocumentChangeEvent[]) {
    if (!this.schemaInitialized) {
      this.initializeSchema(this.config.datasetId, this.config.tableName);
      this.schemaInitialized = true;
    }
    const rows = (Array.isArray(events) ? events : [events]).map(event => {
      return this.buildDataRow(
        // Use the function's event ID to protect against duplicate executions
        event.eventId,
        event.operation,
        event.timestamp,
        event.name,
        event.documentId,
        event.data);
    });
    await this.insertData(this.config.datasetId, this.config.tableName, rows);
  }

  /**
   * Ensure that the defined Firestore schema exists within BigQuery and
   * contains the correct information.
   *
   *
   * NOTE: This currently gets executed on every cold start of the function.
   * Ideally this would run once when the mod is installed if that were
   * possible in the future.
   */
  async initializeSchema(datasetId: string, tableName: string) {
    logs.bigQuerySchemaInitializing();

    const realTableName = rawTableName(tableName);

    await this.initializeDataset(datasetId);
    await this.initializeTable(datasetId, realTableName);
    await this.initializeLatestView(datasetId, realTableName);

    logs.bigQuerySchemaInitialized();
  };

  buildDataRow(
    insertId: string,
    changeType: ChangeType,
    timestamp: string,
    key: string,
    id: string,
    data?: Object
  ): bigquery.RowMetadata {
    const serializedChange = serializeChangeType(changeType);
    return {
      timestamp,
      insertId,
      key: key,
      id,
      operation: serializedChange,
      data: JSON.stringify(data)
    };
  };

  /**
   * Insert a row of data into the BigQuery `raw` data table
   */
  async insertData(
    datasetId: string,
    tableName: string,
    rows: bigquery.RowMetadata | bigquery.RowMetadata[]
  ): Promise<void> {
    const realTableName = rawTableName(tableName);
    const dataset = this.bq.dataset(datasetId);
    const table = dataset.table(realTableName);
    const rowCount = Array.isArray(rows) ? rows.length : 1;

    logs.dataInserting(rowCount);
    await table.insert(rows);
    logs.dataInserted(rowCount);
  };

  /**
   * Check that the specified dataset exists, and create it if it doesn't.
   */
  async initializeDataset(datasetId: string) {
    const dataset = this.bq.dataset(datasetId);
    const [datasetExists] = await dataset.exists();
    if (datasetExists) {
      logs.bigQueryDatasetExists(datasetId);
    } else {
      logs.bigQueryDatasetCreating(datasetId);
      await dataset.create();
      logs.bigQueryDatasetCreated(datasetId);
    }
    return dataset;
  };

  /**
   * Check that the table exists within the specified dataset, and create it
   * if it doesn't.  If the table does exist, validate that the BigQuery schema
   * is correct and add any missing fields.
   */
  async initializeTable(
    datasetId: string,
    tableName: string,
  ): Promise<bigquery.Table> {
    const dataset = this.bq.dataset(datasetId);
    let table = dataset.table(tableName);
    const [tableExists] = await table.exists();
    if (!tableExists) {
      logs.bigQueryTableCreating(tableName);
      const options = {
        // `friendlyName` needs to be here to satisfy TypeScript
        friendlyName: tableName,
        schema: firestoreToBQTable(),
      };
      await table.create(options);
      logs.bigQueryTableCreated(tableName);
    }
    return table;
  };

  /**
   * 
   * @param datasetId 
   * @param tableName 
   */
  async initializeLatestView(
    datasetId: string,
    tableName: string
  ): Promise<bigquery.Table> {
    let viewName = latestViewName(tableName);
    const dataset = this.bq.dataset(datasetId);
    let view = dataset.table(viewName);
    const [viewExists] = await view.exists();

    if (!viewExists) {
      logs.bigQueryViewCreating(viewName);
      const options = {
        friendlyName: tableName,
        view: latestConsistentSnapshotView(datasetId, tableName)
      };
      await view.create(options);
      logs.bigQueryViewCreated(viewName);
    }
    return view;
  };

}

/**
 * Used in `buildDataRow` to convert between `ChangeType` and the 
 * identifier that is stored in BigQuery.
 * @param changeType 
 */
const serializeChangeType = (
  changeType: ChangeType
): string => {
  switch (changeType) {
    case ChangeType.INSERT:
      return "INSERT";
    case ChangeType.UPDATE:
      return "UPDATE";
    case ChangeType.DELETE:
      return "DELETE";
    case ChangeType.IMPORT:
      return "IMPORT";
  }
};

const rawTableName = (tableName: string) => `${tableName}_raw`;
const latestViewName = (tableName: string) => `${tableName}_latest`;