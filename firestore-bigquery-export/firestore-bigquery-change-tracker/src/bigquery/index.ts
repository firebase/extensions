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
import * as traverse from "traverse";
import fetch from "node-fetch";
import {
  RawChangelogSchema,
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
import { Clustering } from "./clustering";

export { RawChangelogSchema, RawChangelogViewSchema } from "./schema";

export interface FirestoreBigQueryEventHistoryTrackerConfig {
  datasetId: string;
  tableId: string;
  datasetLocation: string | undefined;
  transformFunction: string | undefined;
  timePartitioning: string;
  timePartitioningField: string | undefined;
  timePartitioningFieldType: string | undefined;
  timePartitioningFirestoreField: string | undefined;
  clustering: string[] | null;
  wildcardIds?: boolean;
  bqProjectId: string | undefined;
  backupTableId?: string | undefined;
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
  _initialized: boolean = false;

  constructor(public config: FirestoreBigQueryEventHistoryTrackerConfig) {
    this.bq = new bigquery.BigQuery();

    this.bq.projectId = config.bqProjectId || process.env.PROJECT_ID;

    if (!this.config.datasetLocation) {
      this.config.datasetLocation = "us";
    }
  }

  async record(events: FirestoreDocumentChangeEvent[]) {
    await this.initialize();

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
      return responseJson.data;
    }
    return rows;
  }

  serializeData(eventData: any) {
    if (typeof eventData === "undefined") {
      return undefined;
    }

    const data = traverse<traverse.Traverse<any>>(eventData).map(function(
      property
    ) {
      if (property && property.constructor) {
        if (property.constructor.name === "Buffer") {
          this.remove();
        }

        if (
          property.constructor.name ===
          firebase.firestore.DocumentReference.name
        ) {
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
  private async isRetryableInsertionError(e) {
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
      errors.forEach((error) => {
        let isExpected = false;
        expectedErrors.forEach((expectedError) => {
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
          const dataset = this.bigqueryDataset();
          const changelogName = this.rawChangeLogTableName();
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
      const dataset = this.bigqueryDataset();
      const table = dataset.table(this.rawChangeLogTableName());

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

      // Exceeded number of retires, save in failed collection
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
  private async initialize() {
    try {
      if (this._initialized) {
        return;
      }

      await this.initializeDataset();

      await this.initializeRawChangeLogTable();

      await this.initializeLatestView();

      this._initialized = true;
    } catch (ex) {
      await this.waitForInitialization();
      this._initialized = true;
    }
  }

  /**
   * Creates the specified dataset if it doesn't already exists.
   */
  private async initializeDataset() {
    const dataset = this.bigqueryDataset();
    const [datasetExists] = await dataset.exists();
    if (datasetExists) {
      logs.bigQueryDatasetExists(this.config.datasetId);
    } else {
      try {
        logs.bigQueryDatasetCreating(this.config.datasetId);
        await dataset.create();
        logs.bigQueryDatasetCreated(this.config.datasetId);
      } catch (ex) {
        logs.tableCreationError(this.config.datasetId, ex.message);
      }
    }
    return dataset;
  }

  /**
   * Creates the raw change log table if it doesn't already exist.
   */
  private async initializeRawChangeLogTable() {
    const changelogName = this.rawChangeLogTableName();
    const dataset = this.bigqueryDataset();
    const table = dataset.table(changelogName);
    const [tableExists] = await table.exists();
    const partitioning = new Partitioning(this.config, table);
    const clustering = new Clustering(this.config, table);

    if (tableExists) {
      logs.bigQueryTableAlreadyExists(table.id, dataset.id);

      const [metadata] = await table.getMetadata();
      const fields = metadata.schema ? metadata.schema.fields : [];

      await clustering.updateClustering(metadata);

      const documentIdColExists = fields.find(
        (column) => column.name === "document_id"
      );
      const pathParamsColExists = fields.find(
        (column) => column.name === "path_params"
      );

      if (!documentIdColExists) {
        fields.push(documentIdField);
        logs.addNewColumn(this.rawChangeLogTableName(), documentIdField.name);
      }
      if (!pathParamsColExists && this.config.wildcardIds) {
        fields.push(documentPathParams);
        logs.addNewColumn(
          this.rawChangeLogTableName(),
          documentPathParams.name
        );
      }
      await partitioning.addPartitioningToSchema(metadata.schema.fields);

      if (!documentIdColExists || !pathParamsColExists) {
        await table.setMetadata(metadata);
      }
    } else {
      logs.bigQueryTableCreating(changelogName);
      const schema = { fields: [...RawChangelogSchema.fields] };

      if (this.config.wildcardIds) {
        schema.fields.push(documentPathParams);
      }
      const options: TableMetadata = { friendlyName: changelogName, schema };

      //Add partitioning
      await partitioning.addPartitioningToSchema(schema.fields);
      await partitioning.updateTableMetadata(options);

      // Add clustering
      await clustering.updateClustering(options);

      try {
        await table.create(options);
        logs.bigQueryTableCreated(changelogName);
      } catch (ex) {
        logs.tableCreationError(changelogName, ex.message);
      }
    }

    return table;
  }
  /**
   * Creates the latest snapshot view, which returns only latest operations
   * of all existing documents over the raw change log table.
   */
  private async initializeLatestView() {
    const dataset = this.bigqueryDataset();
    const view = dataset.table(this.rawLatestView());
    const [viewExists] = await view.exists();
    const schema = RawChangelogViewSchema;

    const partitioning = new Partitioning(this.config, view);

    if (viewExists) {
      logs.bigQueryViewAlreadyExists(view.id, dataset.id);
      const [metadata] = await view.getMetadata();
      const fields = metadata.schema ? metadata.schema.fields : [];
      if (this.config.wildcardIds) {
        schema.fields.push(documentPathParams);
      }
      const documentIdColExists = fields.find(
        (column) => column.name === "document_id"
      );

      const pathParamsColExists = fields.find(
        (column) => column.name === "path_params"
      );

      if (!documentIdColExists) {
        metadata.view = latestConsistentSnapshotView(
          this.config.datasetId,
          this.rawChangeLogTableName(),
          schema
        );
        logs.addNewColumn(this.rawLatestView(), documentIdField.name);
      }

      if (!pathParamsColExists && this.config.wildcardIds) {
        metadata.view = latestConsistentSnapshotView(
          this.config.datasetId,
          this.rawChangeLogTableName(),
          schema
        );
        logs.addNewColumn(this.rawLatestView(), documentPathParams.name);
      }

      //Add partitioning
      await partitioning.addPartitioningToSchema(schema.fields);

      //TODO: Tidy up and format / add test cases?
      // if (
      //   !documentIdColExists ||
      //   (!pathParamsColExists && this.config.wildcardIds) ||
      //   partition.isValidPartitionForExistingTable(partitionColExists)
      // ) {

      await view.setMetadata(metadata);
      // }
    } else {
      const schema = { fields: [...RawChangelogViewSchema.fields] };
      //Add partitioning field
      await partitioning.addPartitioningToSchema(schema.fields);
      //TODO Create notification for a user that View cannot be Time Partitioned by the field.
      // await partitioning.updateTableMetadata(options);

      if (this.config.wildcardIds) {
        schema.fields.push(documentPathParams);
      }
      const latestSnapshot = latestConsistentSnapshotView(
        this.config.datasetId,
        this.rawChangeLogTableName(),
        schema,
        this.bq.projectId
      );
      logs.bigQueryViewCreating(this.rawLatestView(), latestSnapshot.query);
      const options: TableMetadata = {
        friendlyName: this.rawLatestView(),
        view: latestSnapshot,
      };

      if (this.config.timePartitioning) {
        options.timePartitioning = {
          type: this.config.timePartitioning,
        };
      }

      try {
        await view.create(options);
        await view.setMetadata({ schema: RawChangelogViewSchema });
        logs.bigQueryViewCreated(this.rawLatestView());
      } catch (ex) {
        logs.tableCreationError(this.rawLatestView(), ex.message);
      }
    }
    return view;
  }

  bigqueryDataset() {
    return this.bq.dataset(this.config.datasetId, {
      location: this.config.datasetLocation,
    });
  }

  private rawChangeLogTableName(): string {
    return `${this.config.tableId}_raw_changelog`;
  }

  private rawLatestView(): string {
    return `${this.config.tableId}_raw_latest`;
  }
}
