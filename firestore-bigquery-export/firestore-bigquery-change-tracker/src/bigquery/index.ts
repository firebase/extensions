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
 * The `insertAll` error reasons BigQuery documents as worth retrying.
 *
 * `stopped` means the row was not inserted because another row in the same
 * request failed, so it never appears on its own. The reason that does appear
 * alongside it decides whether the request is retryable.
 */
const RETRYABLE_INSERT_REASONS = [
  "backendError",
  "internalError",
  "rateLimitExceeded",
  "timeout",
  "stopped",
];

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
 * The column an error entry reports as unknown, if it names one of `columns`.
 * Null for anything else, so that an entry we cannot attribute fails loudly
 * rather than causing data to be dropped.
 *
 * A live instance sends both forms at once: `location` set to the column, and
 * an inlined `"no such field: document_id."`. Older responses carried only the
 * bare `"no such field."` with `location`, so both are handled.
 */
function unknownFieldColumn(
  error: InsertAllError,
  columns: string[]
): string | null {
  // Defensive to match extractInsertErrors: a null entry must classify as not
  // matching, not throw from inside the catch block and lose the real error.
  const message = error?.message ?? "";

  if (!/^no such field/i.test(message)) return null;

  // The bare form names the column in `location`.
  if (error.location) {
    return columns.includes(error.location) ? error.location : null;
  }

  // The inlined form carries the column in the message. Compare the whole name:
  // a substring test would match a user column such as `document_id_v2` and
  // silently drop it.
  const named = message.match(/^no such field:\s*(.+?)\.?$/i);

  return named && columns.includes(named[1]) ? named[1] : null;
}

/**
 * Copies `rows` with `columns` removed from each payload.
 *
 * Rows are inserted with `raw: true`, so the payload is under `json`.
 */
function withoutColumns(
  rows: bigquery.RowMetadata[],
  columns: string[]
): bigquery.RowMetadata[] {
  // The ordinary insert strips nothing, so leave it its own rows.
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
   * The rejected columns when a failed insertion is the one case it is safe to
   * retry: a column this tracker adds to an existing table that BigQuery is not
   * ready to stream into yet (https://issuetracker.google.com/35905247).
   *
   * Empty unless every field BigQuery rejected is one of those columns. Any
   * other unknown field is real schema drift, and dropping it would lose the
   * user's data.
   *
   * Deliberately not `async`: the result is used in a guard, and a promise
   * there is always truthy.
   */
  private schemaLagColumns(e: any): string[] {
    const errors = extractInsertErrors(e);

    // Without per-field detail we cannot show the retry is safe.
    if (!errors.length) return [];

    const addedColumns = this.columnsAddedToExistingTables();
    const rejected: string[] = [];

    for (const error of errors) {
      // `stopped` marks a row BigQuery did not attempt, because another row in
      // the same request failed and `skipInvalidRows` is false. It says nothing
      // about the schema, so treating it as unattributable would stop any
      // multi-row batch from ever being recognised as lag. `scripts/import`
      // records batches, so this is reachable.
      if (error?.reason === "stopped") continue;

      const column = unknownFieldColumn(error, addedColumns);

      if (!column) return [];

      rejected.push(column);
    }

    // One entry per row, so the same column appears once per rejected row.
    return [...new Set(rejected)];
  }

  /**
   * The columns this tracker adds to a table that already exists, and so every
   * column exposed to the lag.
   *
   * Every column added belongs here unless dropping it would cost more than
   * losing the event, and `timestamp` below is the only one that does. Omitting
   * a column turns a row that lands today, with that column null, into an event
   * lost once the caller exhausts its retries, because nothing on the write
   * path reconciles the schema.
   *
   * It must also stay exact. Listing a column that is never added makes the
   * retry drop that column's value on a table missing it, forever.
   */
  private columnsAddedToExistingTables(): string[] {
    const columns = [documentIdField.name, oldDataField.name];

    // `path_params` is only ever added, and only ever emitted by `record`, when
    // wildcard ids are enabled. Listing it unconditionally meant a transform
    // function, whose response `transformRows` uses verbatim, could inject the
    // key into a table that has no such column and have it discarded on every
    // insert, for good.
    if (this.config.wildcardIds) {
      columns.push(documentPathParams.name);
    }

    // The partition column is also added to an existing table, so it shares the
    // same exposure. Only the Firestore field strategy is listed. The Firestore
    // timestamp strategy is excluded by construction, since its column is
    // always `timestamp`, which the collision check below would reject anyway.
    //
    // Both exclusions are a judgement call, not dead code: `addPartitioningToSchema`
    // is called with the live table's fields, so its early return only fires
    // when the table already has the column. On a table missing `timestamp` the
    // column really is added, as NULLABLE. But `timestamp` is the ordering key
    // for the latest view as well as the partition key, so tolerating the drop
    // would silently misfile every affected row for good. Failing instead
    // writes a backup row and throws, which the caller can retry. The same goes
    // for a field strategy pointed at any other base column, `data` say.
    //
    // The columns above are not free either, so this is a trade-off rather than
    // a clean line. `document_id` is the one of them the default latest view
    // does not wrap in `FIRST_VALUE`: the legacy query selects it raw and then
    // groups on it (`snapshot.ts:133` and `:150`), so a row that lands with it
    // null forms its own group and the document appears twice in `_latest`. The
    // changelog is append-only, so a later write does not clear the duplicate.
    // `old_data` and `path_params` are wrapped (`snapshot.ts:134-140`), and a
    // null there is simply replaced by the newest row's value.
    //
    // Tolerating the drop is still the better trade, because the duplication is
    // not new. `document_id` is added to an existing table as a schema change
    // and nothing backfills it, so on exactly the tables this lag can affect
    // every pre-upgrade row is already null, and every document written both
    // before and after the upgrade already appears twice in the legacy view,
    // permanently. The lag adds a handful of rows to a set that is already
    // there. Losing the event has no such floor: the caller's retries are
    // finite and nothing reconciles the schema afterwards, so the change never
    // reaches BigQuery at all.
    //
    // `timestamp` is wrapped like the rest, so its exclusion above is not a view
    // concern; it is excluded for being the partition and ordering key. A custom
    // partition column is not in the view at all, since the view is built from
    // `RawChangelogViewSchema` rather than the live table's fields.
    const partitionColumn = this.partitioningConfig.getBigQueryColumnName();

    if (
      partitionColumn &&
      this.partitioningConfig.isFirestoreFieldPartitioning() &&
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
   *
   * A partial failure qualifies only when every entry names a reason BigQuery
   * documents as retryable. Anything else is BigQuery rejecting the shape of
   * the data itself, which a plain retry cannot fix. The schema-lag check runs
   * first, so an unknown-field entry never reaches here.
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
   * `rows` stays as the caller built it for the whole retry chain. A schema-lag
   * retry narrows only the payload sent to BigQuery, so the backup written on
   * the terminal path still holds every column, including any an earlier retry
   * had to remove.
   */
  private async insertData(
    rows: bigquery.RowMetadata[],
    overrideOptions: InsertRowsOptions = {},
    // Columns a schema-lag retry has already removed from the payload. Each
    // retry must remove at least one column BigQuery has not named before, so
    // this layer is bounded at one attempt per column in
    // `columnsAddedToExistingTables`, plus one.
    strippedColumns: string[] = [],
    // Tracked separately from the above, so a transient blip on the first
    // attempt cannot consume the retry a schema lag on a later attempt needs.
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
      // A column we just added may not be streamable yet. Remove the columns
      // BigQuery named and retry, so the rest of the row lands.
      //
      // Deliberately not `ignoreUnknownValues`. A live instance reports one
      // unknown field per row rather than all of them, so ignoring unknown
      // values would also discard fields BigQuery never mentioned, including
      // real drift this retry is not meant to tolerate. Removing only what it
      // named leaves any other unknown column failing the insert, where it is
      // backed up rather than lost.
      const lagColumns = this.schemaLagColumns(e).filter(
        (column) => !strippedColumns.includes(column)
      );

      if (lagColumns.length) {
        logs.dataInsertRetriedWithoutColumns(rows.length, lagColumns);
        return this.insertData(
          rows,
          overrideOptions,
          [...strippedColumns, ...lagColumns],
          allowTransientRetry
        );
      }

      // Transient failures deserve a retry, but not with
      // `ignoreUnknownValues`, which would silently drop real data.
      if (allowTransientRetry && this.isTransientInsertionError(e)) {
        logs.dataInsertRetriedAfterTransientError(rows.length);
        return this.insertData(rows, overrideOptions, strippedColumns, false);
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
