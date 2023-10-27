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
import fetch from "node-fetch";
import { documentIdField, documentPathParamsField } from "./schema";
import handleFailedTransactions from "./handleFailedTransactions";

import * as logs from "../logs";
import { InsertRowsOptions } from "@google-cloud/bigquery/build/src/table";

import { Partitioning } from "./partitioning";

export { RawChangelogSchema, RawChangelogViewSchema } from "./schema";

import {
  FirestoreDocumentChangeEvent,
  ChangeType,
  FirestoreBigQueryEventHistoryTrackerConfig,
  BigQueryFieldType,
} from "./types";
import { initializeDataset } from "./initialize/initializeDataset";
import { initializeRawChangeLogTable } from "./initialize/initializeRawChangeLogTable";
import { initializeLatestView } from "./initialize/initializeLatestView";
import { serializeData } from "./serializeData";

/**
 * An FirestoreEventHistoryTracker that exports data to BigQuery.
 *
 * When the first event is received, it creates necessary BigQuery resources:
 * - Dataset: {@link FirestoreBigQueryEventHistoryTrackerConfig#datasetId}.
 * - Table: Raw change log table {@link FirestoreBigQueryEventHistoryTracker#rawChangeLogTableName}.
 * - View: Latest view {@link FirestoreBigQueryEventHistoryTracker#rawLatestView}.
 * If any subsequent data export fails, it will attempt to reinitialize.
 */

export class FirestoreBigQueryEventHistoryTracker {
  bq: bigquery.BigQuery;
  _initialized: boolean = false;
  rawChangeLogTableName: string;
  private rawLatestView: string;
  bigqueryDataset: bigquery.Dataset;

  constructor(public config: FirestoreBigQueryEventHistoryTrackerConfig) {
    this.bq = new bigquery.BigQuery();

    this.bq.projectId = config.bqProjectId || process.env.PROJECT_ID;

    if (!this.config.datasetLocation) {
      this.config.datasetLocation = "us";
    }
    if (!this.config.dataFormat) {
      this.config.dataFormat = BigQueryFieldType.STRING;
    }
    this.rawChangeLogTableName = `${this.config.tableId}_raw_changelog`;
    this.rawLatestView = `${this.config.tableId}_raw_latest`;

    this.bigqueryDataset = this.bq.dataset(this.config.datasetId, {
      location: this.config.datasetLocation,
    });
  }

  async record(events: FirestoreDocumentChangeEvent[]) {
    if (!this.config.skipInit) {
      await this.initialize();
    }

    const partitionHandler = new Partitioning(this.config);

    const rows = events.map((event) => {
      const partitionValue = partitionHandler.getPartitionValue(event);

      const { documentId, ...pathParams } = event.pathParams || {};

      return {
        insertId: event.eventId,
        json: {
          timestamp: event.timestamp,
          event_id: event.eventId,
          document_name: event.documentName,
          document_id: event.documentId,
          operation: ChangeType[event.operation],
          data: JSON.stringify(this.serializeData(event.data)),
          old_data: event.oldData
            ? JSON.stringify(this.serializeData(event.oldData))
            : null,
          ...partitionValue,
          ...(this.config.wildcardIds &&
            event.pathParams && { path_params: JSON.stringify(pathParams) }),
        },
      };
    });

    const transformedRows = await this.transformRows(rows);

    await this.insertData(transformedRows);
  }

  private async transformRows(rows: any[]) {
    if (this.config.transformFunction && this.config.transformFunction !== "") {
      const response = await fetch(this.config.transformFunction, {
        method: "post",
        body: JSON.stringify({ data: rows }),
        headers: { "Content-Type": "application/json" },
      });
      const responseJson = await response.json();
      // To support callable functions, first check result.data
      return responseJson?.result?.data ?? responseJson.data;
    }
    return rows;
  }

  // TODO: remove any
  serializeData(eventData: any) {
    return serializeData(eventData);
  }

  /**
   * Check whether a failed operation is retryable or not.
   * Reasons for retrying:
   * 1) We added a new column to our schema. Sometimes BQ is not ready to stream insertion records immediately
   *    after adding a new column to an existing table (https://issuetracker.google.com/35905247)
   */
  private async isRetryableInsertionError(e) {
    let isRetryable = true;
    const expectedErrors = [
      { message: "no such field.", location: documentIdField.name },
      { message: "no such field.", location: documentPathParamsField.name },
    ];
    if (
      e.response &&
      e.response.insertErrors &&
      e.response.insertErrors.errors
    ) {
      const errors = e.response.insertErrors.errors;
      errors?.forEach((error) => {
        let isExpected = false;
        expectedErrors?.forEach((expectedError) => {
          if (
            error.message === expectedError.message &&
            error.location === expectedError.location
          ) {
            isExpected = true;
          }
        });
        if (!isExpected) {
          isRetryable = false;
        }
      });
    }
    return isRetryable;
  }

  /**
   * Tables can often take time to create and propagate.
   * A half a second delay is added per check while the function
   * continually re-checks until the referenced dataset and table become available.
   */
  private async waitForInitialization() {
    return new Promise((resolve) => {
      let handle = setInterval(async () => {
        try {
          const dataset = this.bigqueryDataset;
          const changelogName = this.rawChangeLogTableName;
          const table = dataset.table(changelogName);

          const [datasetExists] = await dataset.exists();
          const [tableExists] = await table.exists();

          if (datasetExists && tableExists) {
            clearInterval(handle);
            return resolve(table);
          }
        } catch (ex) {
          clearInterval(handle);
          logs.failedToInitializeWait(ex.message);
        }
      }, 5000);
    });
  }

  /**
   * Inserts rows of data into the BigQuery raw change log table.
   */
  private async insertData(
    rows: bigquery.RowMetadata[],
    overrideOptions: InsertRowsOptions = {},
    retry: boolean = true
  ) {
    const options = {
      skipInvalidRows: false,
      ignoreUnknownValues: false,
      raw: true,
      ...overrideOptions,
    };
    try {
      const dataset = this.bigqueryDataset;
      const table = dataset.table(this.rawChangeLogTableName);

      logs.dataInserting(rows.length);
      await table.insert(rows, options);
      logs.dataInserted(rows.length);
    } catch (e) {
      if (retry && this.isRetryableInsertionError(e)) {
        retry = false;
        logs.dataInsertRetried(rows.length);
        return this.insertData(
          rows,
          { ...overrideOptions, ignoreUnknownValues: true },
          retry
        );
      }

      // Exceeded number of retries, save in failed collection
      if (!retry && this.config.backupTableId) {
        await handleFailedTransactions(rows, this.config, e);
      }

      // Reinitializing in case the destintation table is modified.
      this._initialized = false;
      logs.bigQueryTableInsertErrors(e.errors);
      throw e;
    }
  }

  /**
   * Creates the BigQuery resources with the expected schema for {@link FirestoreEventHistoryTracker}.
   * After the first invokation, it skips initialization assuming these resources are still there.
   */
  async initialize() {
    try {
      if (this._initialized) {
        return;
      }

      // await this.initializeDataset();
      await initializeDataset(this.bigqueryDataset);

      // await this.initializeRawChangeLogTable();
      await initializeRawChangeLogTable({
        config: this.config,
        bigqueryDataset: this.bigqueryDataset,
        rawChangeLogTableName: this.rawChangeLogTableName,
        dataFormat: this.config.dataFormat,
      });

      // await this.initializeLatestView();
      await initializeLatestView({
        bigqueryDataset: this.bigqueryDataset,
        config: this.config,
        rawChangeLogTableName: this.rawChangeLogTableName,
        rawLatestView: this.rawLatestView,
        bqProjectId: this.config.bqProjectId,
        dataFormat: this.config.dataFormat,
      });

      this._initialized = true;
    } catch (ex) {
      await this.waitForInitialization();
      this._initialized = true;
    }
  }
}
