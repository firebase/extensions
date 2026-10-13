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
  TableField,
  TableMetadata,
} from "@google-cloud/bigquery/build/src/table";

import { Partitioning } from "./partitioning";
import { Clustering } from "./clustering";
import { tableRequiresUpdate } from "./checkUpdates";
import { parseErrorMessage, waitForInitialization } from "./utils";
import { initializeLatestView } from "./initializeLatestView";
import { logger, LogLevel } from "../logger";
import { resolveGcpProjectIdForBigQuery } from "./gcpProject";

export { RawChangelogSchema, RawChangelogViewSchema } from "./schema";
import type { ChangeTrackerConfig } from "./types";
import { PartitioningConfig } from "./partitioning/config";
export type { ChangeTrackerConfig } from "./types";

interface InsertAllError {
  message?: string;
  location?: string;
  reason?: string;
}

/**
 * The `insertAll` error reasons BigQuery documents as worth retrying. `stopped`
 * marks a row BigQuery did not attempt, and never appears without one of the
 * others alongside it.
 */
const RETRYABLE_INSERT_REASONS = [
  "backendError",
  "internalError",
  "rateLimitExceeded",
  "timeout",
  "stopped",
];

/**
 * Read from `response.insertErrors` rather than the error's own `errors`, which
 * is a remapped copy that drops `location` and so cannot identify the column.
 */
function extractInsertErrors(e: any): InsertAllError[] {
  const insertErrors = e?.response?.insertErrors;

  if (!Array.isArray(insertErrors)) return [];

  return insertErrors.flatMap((insertError) =>
    Array.isArray(insertError?.errors) ? insertError.errors : []
  );
}

/**
 * Null for anything it cannot attribute, so an unrecognised entry fails the
 * insert rather than dropping data. Two response forms exist: the bare
 * `"no such field."` naming the column in `location`, and an inlined
 * `"no such field: document_id."`.
 */
function unknownFieldColumn(
  error: InsertAllError,
  columns: string[]
): string | null {
  // Runs inside a catch block, so a malformed entry must not throw.
  const message = error?.message ?? "";

  if (!/^no such field/i.test(message)) return null;

  if (error.location) {
    return columns.includes(error.location) ? error.location : null;
  }

  // Whole name, not a substring: `document_id_v2` must not match `document_id`.
  const named = message.match(/^no such field:\s*(.+?)\.?$/i);

  return named && columns.includes(named[1]) ? named[1] : null;
}

/** Rows are inserted with `raw: true`, so the payload is under `json`. */
function withoutColumns(
  rows: bigquery.RowMetadata[],
  columns: string[]
): bigquery.RowMetadata[] {
  if (!columns.length) return rows;

  return rows.map((row) => {
    if (!row?.json) return row;

    const json = { ...row.json };
    columns.forEach((column) => delete json[column]);

    return { ...row, json };
  });
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

    this.bq.projectId = resolveGcpProjectIdForBigQuery(config.bqProjectId);

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
   * The rejected columns when an insert failure is the one case it is safe to
   * retry: a column added to an existing table that BigQuery is not ready to
   * stream into yet (https://issuetracker.google.com/35905247). Any other unknown
   * field is real drift, and dropping it would lose the user's data.
   *
   * Not `async`: the result is used in a guard, where a promise is always truthy.
   */
  private schemaLagColumns(e: any): string[] {
    const errors = extractInsertErrors(e);

    // Without per-field detail we cannot show the retry is safe.
    if (!errors.length) return [];

    const addedColumns = this.columnsAddedToExistingTables();
    const rejected: string[] = [];

    for (const error of errors) {
      // A row BigQuery did not attempt because another in the request failed.
      // Skipping it is what lets a multi-row batch be recognised as lag at all.
      if (error?.reason === "stopped") continue;

      const column = unknownFieldColumn(error, addedColumns);

      if (!column) return [];

      rejected.push(column);
    }

    // One entry per row, so the same column appears once per rejected row.
    return [...new Set(rejected)];
  }

  /**
   * The only columns a lag retry may drop. Exact in both directions: one missing
   * costs the event once the caller's retries run out, and one listed that is
   * never actually added is stripped from every insert for the table's life.
   *
   * A null in a column the latest view groups on duplicates the document in
   * `_latest` permanently. Accepted for these, whose tables already hold
   * pre-upgrade rows with the same nulls; not for `timestamp`, where a null
   * misfiles the row instead.
   */
  private columnsAddedToExistingTables(): string[] {
    const columns = [documentIdField.name, oldDataField.name];

    // Only added, and only emitted, when wildcard ids are on. A transform
    // function can inject the key regardless: `transformRows` uses its response
    // verbatim.
    if (this.config.wildcardIds) {
      columns.push(documentPathParams.name);
    }

    // The custom partition column is deliberately not allowlisted: stripping
    // it for a lag retry writes a null that misfiles the row into the wrong
    // partition permanently. An insert racing the column's propagation fails
    // terminally instead, with the rows backed up intact.
    return columns;
  }

  /**
   * Qualifies only when every entry names a reason BigQuery documents as
   * retryable; anything else is a rejection of the data, which a retry cannot
   * fix. A failure with no partial-failure body says nothing about the schema.
   */
  private isTransientInsertionError(e: any): boolean {
    const errors = extractInsertErrors(e);

    if (!errors.length) return true;

    return errors.every((error) =>
      RETRYABLE_INSERT_REASONS.includes(error?.reason)
    );
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
   *
   * Columns are removed at the `insert` call rather than from `rows`, so the
   * backup on the terminal path still holds every column.
   */
  private async insertData(
    rows: bigquery.RowMetadata[],
    overrideOptions: InsertRowsOptions = {},
    // Columns a schema-lag retry has already removed from the payload. Each
    // retry must remove one not removed before, which bounds the recursion.
    strippedColumns: string[] = [],
    // Tracked separately, so a blip cannot consume the retry a later lag needs.
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
      await table.insert(withoutColumns(rows, strippedColumns), options);
      logs.dataInserted(rows.length);
    } catch (e) {
      // A column we just added may not be streamable yet, so remove the ones
      // BigQuery named and retry.
      //
      // Not `ignoreUnknownValues`: BigQuery reports one unknown field per row, so
      // that would also discard fields it never mentioned.
      const lagColumns = this.schemaLagColumns(e).filter(
        (column) => !strippedColumns.includes(column)
      );

      if (lagColumns.length) {
        logs.dataInsertRetriedWithoutColumns(rows.length, lagColumns);

        // If the column is genuinely gone rather than lagging, this makes the
        // next batch re-run `initialize` and add it back.
        this._initialized = false;

        return this.insertData(
          rows,
          overrideOptions,
          [...strippedColumns, ...lagColumns],
          allowTransientRetry
        );
      }

      if (allowTransientRetry && this.isTransientInsertionError(e)) {
        logs.dataInsertRetriedAfterTransientError(rows.length);
        return this.insertData(rows, overrideOptions, strippedColumns, false);
      }

      // Terminal: no further attempt will be made for these rows.
      if (this.config.backupTableId) {
        try {
          await handleFailedTransactions(rows, this.config, e);
        } catch (backupError) {
          // A failed backup must not replace the insert error the caller needs.
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
      // The annotation is load-bearing: it keeps the column checks below
      // boolean, so a non-boolean (e.g. a `find` result) cannot reach
      // `tableRequiresUpdate` and re-fire the update on every initialize.
      const fields: TableField[] = metadata.schema
        ? metadata.schema.fields
        : [];

      const documentIdColExists = fields.some(
        (column) => column.name === "document_id"
      );
      const pathParamsColExists = fields.some(
        (column) => column.name === "path_params"
      );

      const oldDataColExists = fields.some(
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
        // Must run after `tableRequiresUpdate`: it rewrites `metadata.clustering`
        // to the desired state, and the update check compares that same object
        // against the config.
        await clustering.updateClustering(metadata);

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
