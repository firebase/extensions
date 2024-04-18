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
import { DocumentReference } from "firebase-admin/firestore";
import * as traverse from "traverse";
import fetch from "node-fetch";
import {
  RawChangelogViewSchema,
  documentIdField,
  documentPathParams,
} from "./schema";
import { latestConsistentSnapshotView } from "./snapshot";
import handleFailedTransactions from "./handleFailedTransactions";

import {
  ChangeType,
  FirestoreEventHistoryTracker,
  FirestoreDocumentChangeEvent,
} from "../tracker";
import * as logs from "../logs";
import {
  InsertRowsOptions,
  TableMetadata,
} from "@google-cloud/bigquery/build/src/table";

import { Partitioning } from "./partitioning";
import { viewRequiresUpdate } from "./checkUpdates";
import {
  initializeRawChangelogTable,
  initializeDataset,
  waitForInitialization,
} from "./initialization";
import { parseErrorMessage } from "./utils";

export { RawChangelogSchema, RawChangelogViewSchema } from "./schema";

export interface FirestoreBigQueryEventHistoryTrackerConfig {
  datasetId: string;
  tableId: string;
  datasetLocation?: string | undefined;
  transformFunction?: string | undefined;
  timePartitioning?: string | undefined;
  timePartitioningField?: string | undefined;
  timePartitioningFieldType?: string | undefined;
  timePartitioningFirestoreField?: string | undefined;
  clustering: string[] | null;
  databaseId?: string | undefined;
  wildcardIds?: boolean;
  bqProjectId?: string | undefined;
  backupTableId?: string | undefined;
  useNewSnapshotQuerySyntax?: boolean;
  skipInit?: boolean;
  kmsKeyName?: string | undefined;
}

/**
 * An FirestoreEventHistoryTracker that exports data to BigQuery.
 *
 * When the first event is received, it creates necessary BigQuery resources:
 * - Dataset: {@link FirestoreBigQueryEventHistoryTrackerConfig#datasetId}.
 * - Table: Raw change log table {@link FirestoreBigQueryEventHistoryTracker#getRawChangeLogTableName}.
 * - View: Latest view {@link FirestoreBigQueryEventHistoryTracker#getRawLatestView}.
 * If any subsequent data export fails, it will attempt to reinitialize.
 */

export class FirestoreBigQueryEventHistoryTracker
  implements FirestoreEventHistoryTracker
{
  bq: bigquery.BigQuery;
  _initialized: boolean = false;

  constructor(public config: FirestoreBigQueryEventHistoryTrackerConfig) {
    this.bq = new bigquery.BigQuery({
      projectId: config.bqProjectId || process.env.PROJECT_ID,
    });

    // this.bq.projectId = config.bqProjectId || process.env.PROJECT_ID;

    if (!this.config.datasetLocation) {
      this.config.datasetLocation = "us";
    }
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

    const transformedRows = await this._transformRows(rows);

    await this._insertData(transformedRows);
  }

  private async _transformRows(rows: any[]) {
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

  serializeData(eventData: any) {
    if (typeof eventData === "undefined") {
      return undefined;
    }

    const data = traverse<traverse.Traverse<any>>(eventData).map(function (
      property
    ) {
      if (property && property.constructor) {
        if (property.constructor.name === "Buffer") {
          this.remove();
        }

        if (property.constructor.name === DocumentReference.name) {
          this.update(property.path);
        }
      }
    });

    return data;
  }

  /**
   * Check whether a failed operation is retryable or not.
   * Reasons for retrying:
   * 1) We added a new column to our schema. Sometimes BQ is not ready to stream insertion records immediately
   *    after adding a new column to an existing table (https://issuetracker.google.com/35905247)
   */
  private async _isRetryableInsertionError(e) {
    let isRetryable = true;
    const expectedErrors = [
      { message: "no such field.", location: documentIdField.name },
      { message: "no such field.", location: documentPathParams.name },
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
  private async _waitForInitialization() {
    const dataset = this.getBigqueryDataset();
    const changelogName = this.getRawChangeLogTableName();
    return waitForInitialization({ dataset, changelogName });
  }

  /**
   * Inserts rows of data into the BigQuery raw change log table.
   */
  private async _insertData(
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
      const dataset = this.getBigqueryDataset();
      const table = dataset.table(this.getRawChangeLogTableName());

      logs.dataInserting(rows.length);
      await table.insert(rows, options);
      logs.dataInserted(rows.length);
    } catch (e) {
      if (retry && (await this._isRetryableInsertionError(e))) {
        retry = false;
        logs.dataInsertRetried(rows.length);
        return this._insertData(
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

      await this._initializeDataset();

      await this._initializeRawChangelogTable();

      await this._initializeLatestView();

      this._initialized = true;
    } catch (error) {
      const message = parseErrorMessage(error);
      console.error(message);
      await this._waitForInitialization();
      this._initialized = true;
    }
  }

  /**
   * Creates the specified dataset if it doesn't already exists.
   */
  private async _initializeDataset() {
    const dataset = this.getBigqueryDataset();
    return initializeDataset({ dataset });
  }

  /**
   * Creates the raw change log table if it doesn't already exist.
   */
  private async _initializeRawChangelogTable() {
    const changelogName = this.getRawChangeLogTableName();
    const dataset = this.getBigqueryDataset();
    const table = dataset.table(changelogName);

    return initializeRawChangelogTable({
      changelogName,
      dataset,
      table,
      config: this.config,
    });
  }
  /**
   * Creates the latest snapshot view, which returns only latest operations
   * of all existing documents over the raw change log table.
   */
  private async _initializeLatestView() {
    const dataset = this.getBigqueryDataset();
    const view = dataset.table(this.getRawLatestView());
    const [viewExists] = await view.exists();
    const schema = RawChangelogViewSchema;

    if (viewExists) {
      // TODO: remove !
      logs.bigQueryViewAlreadyExists(view.id!, dataset.id!);
      const [metadata] = await view.getMetadata();
      // TODO: just casting this for now, needs properly fixing
      const fields = (metadata.schema ? metadata.schema.fields : []) as {
        name: string;
      }[];
      if (this.config.wildcardIds) {
        schema.fields.push(documentPathParams);
      }

      const columnNames = fields.map((field) => field.name);
      const documentIdColExists = columnNames.includes("document_id");
      const pathParamsColExists = columnNames.includes("path_params");
      const oldDataColExists = columnNames.includes("old_data");

      /** If new view or opt-in to new query syntax **/
      const updateView = viewRequiresUpdate({
        metadata,
        config: this.config,
        documentIdColExists,
        pathParamsColExists,
        oldDataColExists,
      });

      if (updateView) {
        metadata.view = latestConsistentSnapshotView({
          datasetId: this.config.datasetId,
          tableName: this.getRawChangeLogTableName(),
          schema,
          useLegacyQuery: !this.config.useNewSnapshotQuerySyntax,
        });

        if (!documentIdColExists) {
          logs.addNewColumn(this.getRawLatestView(), documentIdField.name);
        }

        await view.setMetadata(metadata);
        logs.updatingMetadata(this.getRawLatestView(), {
          config: this.config,
          documentIdColExists,
          pathParamsColExists,
          oldDataColExists,
        });
      }
    } else {
      const schema = { fields: [...RawChangelogViewSchema.fields] };

      if (this.config.wildcardIds) {
        schema.fields.push(documentPathParams);
      }
      const latestSnapshot = latestConsistentSnapshotView({
        datasetId: this.config.datasetId,
        tableName: this.getRawChangeLogTableName(),
        schema,
        bqProjectId: this.bq.projectId,
        useLegacyQuery: !this.config.useNewSnapshotQuerySyntax,
      });
      logs.bigQueryViewCreating(this.getRawLatestView(), latestSnapshot.query);
      const options: TableMetadata = {
        friendlyName: this.getRawLatestView(),
        view: latestSnapshot,
      };

      try {
        await view.create(options);
        await view.setMetadata({ schema: RawChangelogViewSchema });
        logs.bigQueryViewCreated(this.getRawLatestView());
      } catch (ex) {
        logs.tableCreationError(this.getRawLatestView(), ex.message);
      }
    }
    return view;
  }

  getBigqueryDataset() {
    return this.bq.dataset(this.config.datasetId, {
      location: this.config.datasetLocation,
    });
  }

  private getRawChangeLogTableName(): string {
    return `${this.config.tableId}_raw_changelog`;
  }

  private getRawLatestView(): string {
    return `${this.config.tableId}_raw_latest`;
  }
}
