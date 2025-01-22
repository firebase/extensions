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
import * as admin from "firebase-admin";
import * as bigquery from "@google-cloud/bigquery";
import { DocumentReference } from "firebase-admin/firestore";
import * as traverse from "traverse";
import fetch from "node-fetch";
import {
  RawChangelogSchema,
  RawChangelogViewSchema,
  documentIdField,
  oldDataField,
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
import { tableRequiresUpdate } from "./checkUpdates";
import { parseErrorMessage, waitForInitialization } from "./utils";
import { initializeLatestView } from "./initializeLatestView";

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
  useMaterializedView?: boolean;
  useIncrementalMaterializedView?: boolean;
  maxStaleness?: string;
  refreshIntervalMinutes?: number;
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
  implements FirestoreEventHistoryTracker
{
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
    const dataset = this.bigqueryDataset();
    const changelogName = this.rawChangeLogTableName();

    let materializedViewName;

    if (this.config.useMaterializedView) {
      materializedViewName = this.rawLatestView();
    }

    return waitForInitialization({
      dataset,
      changelogName,
      materializedViewName,
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
      try {
        await this.initializeDataset();
      } catch (error) {
        const message = parseErrorMessage(error, "initializing dataset");
        throw new Error(`Error initializing dataset: ${message}`);
      }

      try {
        await this.initializeRawChangeLogTable();
      } catch (error) {
        const message = parseErrorMessage(
          error,
          "initializing raw change log table"
        );
        throw new Error(`Error initializing raw change log table: ${message}`);
      }

      try {
        await this._initializeLatestView();
      } catch (error) {
        const message = parseErrorMessage(error, "initializing latest view");
        throw new Error(`Error initializing latest view: ${message}`);
      }
      await this._waitForInitialization();

      this._initialized = true;
    } catch (error) {
      const message = parseErrorMessage(
        error,
        "initializing BigQuery resources"
      );
      console.error("Error initializing BigQuery resources: ", message);
      throw error;
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

      const oldDataColExists = fields.find(
        (column) => column.name === "old_data"
      );

      if (!oldDataColExists) {
        fields.push(oldDataField);
        logs.addNewColumn(this.rawChangeLogTableName(), oldDataField.name);
      }

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

      /** Updated table metadata if required */
      const shouldUpdate = await tableRequiresUpdate({
        table,
        config: this.config,
        documentIdColExists,
        pathParamsColExists,
        oldDataColExists,
      });

      if (shouldUpdate) {
        /** set partitioning */
        await partitioning.addPartitioningToSchema(metadata.schema.fields);

        /** update table metadata with changes. */
        await table.setMetadata(metadata);
        logs.updatingMetadata(this.rawChangeLogTableName(), {
          config: this.config,
          documentIdColExists,
          pathParamsColExists,
          oldDataColExists,
        });
      }
    } else {
      logs.bigQueryTableCreating(changelogName);
      const schema = { fields: [...RawChangelogSchema.fields] };

      if (this.config.wildcardIds) {
        schema.fields.push(documentPathParams);
      }
      const options: TableMetadata = { friendlyName: changelogName, schema };

      if (this.config.kmsKeyName) {
        options["encryptionConfiguration"] = {
          kmsKeyName: this.config.kmsKeyName,
        };
      }
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
  private async _initializeLatestView() {
    const dataset = this.bigqueryDataset();
    const view = dataset.table(this.rawLatestView());
    const [viewExists] = await view.exists();

    return await initializeLatestView({
      bq: this.bq,
      changeTrackerConfig: this.config,
      dataset,
      view,
      viewExists,
      rawChangeLogTableName: this.rawChangeLogTableName(),
      rawLatestViewName: this.rawLatestView(),
    });
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
