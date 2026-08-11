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
import {
  RawChangelogSchema,
  documentIdField,
  oldDataField,
  documentPathParams,
} from "./schema";
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
import { logger, LogLevel } from "../logger";

export { RawChangelogSchema, RawChangelogViewSchema } from "./schema";
import type { ChangeTrackerConfig } from "./types";
import { PartitioningConfig } from "./partitioning/config";
export type { ChangeTrackerConfig } from "./types";

/** A single error entry from a raw `insertAll` partial-failure response. */
interface InsertAllError {
  message?: string;
  location?: string;
  reason?: string;
}

/**
 * Flattens the per-field errors out of a BigQuery insert failure.
 *
 * `PartialFailureError` carries the raw `insertAll` response on `response`,
 * where `insertErrors` is an array of `{ index, errors }`. The error's own
 * `errors` property is a remapped copy that keeps only `message` and `reason`,
 * so it cannot be used to identify which column BigQuery rejected.
 *
 * Returns an empty array for any failure that is not a partial failure, e.g. a
 * network error or a quota rejection.
 */
function extractInsertErrors(e: any): InsertAllError[] {
  const insertErrors = e?.response?.insertErrors;

  if (!Array.isArray(insertErrors)) return [];

  return insertErrors.flatMap((insertError) =>
    Array.isArray(insertError?.errors) ? insertError.errors : []
  );
}

/**
 * Whether an error entry reports an unknown field naming one of `columns`.
 *
 * BigQuery has reported this two ways: a bare `"no such field."` with the
 * column in `location`, and an inlined `"no such field: document_id."`. Match
 * either, and treat an unattributable message as not matching so that we fail
 * loudly rather than dropping data.
 */
function isUnknownFieldError(
  error: InsertAllError,
  columns: string[]
): boolean {
  // Defensive to match extractInsertErrors: a null entry must classify as not
  // matching, not throw from inside the catch block and lose the real error.
  const message = error?.message ?? "";

  if (!/^no such field/i.test(message)) return false;

  // The bare form names the column in `location`.
  if (error.location) return columns.includes(error.location);

  // The inlined form carries the column in the message. Compare the whole name:
  // a substring test would match a user column such as `document_id_v2` and
  // silently drop it.
  const named = message.match(/^no such field:\s*(.+?)\.?$/i);

  return named ? columns.includes(named[1]) : false;
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
  partitioningConfig: PartitioningConfig;

  constructor(public config: ChangeTrackerConfig) {
    this.bq = new bigquery.BigQuery();

    this.bq.projectId = config.bqProjectId || process.env.PROJECT_ID;

    this.partitioningConfig = new PartitioningConfig(this.config.partitioning);

    if (!this.config.datasetLocation) {
      this.config.datasetLocation = "us";
    }

    this.config.firestoreInstanceId =
      this.config.firestoreInstanceId || "(default)";

    logger.setLogLevel(this.config.logLevel || LogLevel.INFO);
  }

  async record(events: FirestoreDocumentChangeEvent[]) {
    if (!this.config.skipInit) {
      await this.initialize();
    }

    const partitionHandler = new Partitioning(this.partitioningConfig);

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
      const responseJson: any = await response.json();
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
   * Whether a failed insertion is the one case it is safe to retry while
   * ignoring unknown values: a column this tracker adds to an existing table
   * that BigQuery is not ready to stream into yet
   * (https://issuetracker.google.com/35905247).
   *
   * Every field BigQuery rejected must be one of those columns. Any other
   * unknown field is real schema drift, and retrying it with
   * `ignoreUnknownValues` would silently drop the user's data.
   *
   * Deliberately not `async`: the result is used in a boolean guard, and a
   * promise there is always truthy.
   */
  private isSchemaLagInsertionError(e: any): boolean {
    const errors = extractInsertErrors(e);

    // Without per-field detail we cannot show the retry is safe.
    if (!errors.length) return false;

    const addedColumns = this.columnsAddedToExistingTables();

    return errors.every((error) => isUnknownFieldError(error, addedColumns));
  }

  /**
   * The columns this tracker adds to a table that already exists, and so every
   * column exposed to the lag.
   *
   * This list must stay complete. Omitting a column turns a row that lands
   * today, with that column null, into an event lost once the caller exhausts
   * its retries, because nothing on the write path reconciles the schema.
   *
   * It must also stay exact. Listing a column that is never added makes the
   * retry drop that column's value on a table missing it, forever.
   */
  private columnsAddedToExistingTables(): string[] {
    const columns = [
      documentIdField.name,
      documentPathParams.name,
      oldDataField.name,
    ];

    // addPartitioningToSchema adds the partition column to an existing table
    // under the same conditions, so it has the same exposure. It returns early
    // when the column name is already in the schema though, and every base
    // column is, so a colliding name is never actually added. The Firestore
    // timestamp strategy is exactly that case: its column is `timestamp`.
    const partitionColumn = this.partitioningConfig.getBigQueryColumnName();

    if (
      partitionColumn &&
      (this.partitioningConfig.isFirestoreFieldPartitioning() ||
        this.partitioningConfig.isFirestoreTimestampPartitioning()) &&
      !RawChangelogSchema.fields.some((field) => field.name === partitionColumn)
    ) {
      columns.push(partitionColumn);
    }

    return columns;
  }

  /**
   * Whether a failed insertion is worth one plain retry, with options
   * unchanged.
   *
   * A failure with no partial-failure body (a network blip, a quota rejection,
   * a 5xx) says nothing about our schema, so retrying it as-is is safe.
   * A partial failure we did not recognise is BigQuery rejecting the
   * shape of the data itself, which a plain retry cannot fix.
   */
  private isTransientInsertionError(e: any): boolean {
    return extractInsertErrors(e).length === 0;
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
    // Tracked separately, so a transient blip on the first attempt cannot
    // consume the retry that a schema lag on a later attempt needs. Each is
    // spent at most once, bounding this layer at three attempts.
    allowSchemaLagRetry: boolean = true,
    allowTransientRetry: boolean = true
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
      // A column we just added may not be streamable yet. Retry ignoring the
      // fields BigQuery does not know about, so the rest of the row lands.
      if (allowSchemaLagRetry && this.isSchemaLagInsertionError(e)) {
        logs.dataInsertRetried(rows.length);
        return this.insertData(
          rows,
          { ...overrideOptions, ignoreUnknownValues: true },
          false,
          allowTransientRetry
        );
      }

      // Transient failures deserve a retry, but not with
      // `ignoreUnknownValues`, which would silently drop real data.
      if (allowTransientRetry && this.isTransientInsertionError(e)) {
        logs.dataInsertRetried(rows.length);
        return this.insertData(
          rows,
          overrideOptions,
          allowSchemaLagRetry,
          false
        );
      }

      // Terminal: no further attempt will be made for these rows.
      if (this.config.backupTableId) {
        try {
          await handleFailedTransactions(rows, this.config, e);
        } catch (backupError) {
          // Never let a failed backup write mask the insert error that caused
          // it. The caller needs the original cause to decide whether to retry.
          logs.failedBackupWrite(backupError);
        }
      }

      // Reinitializing in case the destintation table is modified.
      this._initialized = false;
      logs.bigQueryTableInsertErrors(e?.errors);
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
        throw ex;
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
    const partitioning = new Partitioning(this.partitioningConfig, table);
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
        throw ex;
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
