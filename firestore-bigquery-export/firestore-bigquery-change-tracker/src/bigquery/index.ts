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
  getNewPartitionField,
} from "./schema";
import { latestConsistentSnapshotView } from "./snapshot";

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

export { RawChangelogSchema, RawChangelogViewSchema } from "./schema";

export interface FirestoreBigQueryEventHistoryTrackerConfig {
  datasetId: string;
  tableId: string;
  datasetLocation: string | undefined;
  transformFunction: string;
  timePartitioning: string;
  timePartitioningField: string | undefined;
  timePartitioningFieldType: string | undefined;
  timePartitioningFirestoreField: string | undefined;
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

    if (!this.config.datasetLocation) {
      this.config.datasetLocation = "us";
    }
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
          document_id: event.documentId,
          operation: ChangeType[event.operation],
          data: JSON.stringify(this.serializeData(event.data)),
          ...this.getTimePartitionParameterField(
            event.data,
            event.documentName
          ),
        },
      };
    });
    const transformedRows = await this.transformRows(rows);
    await this.insertData(transformedRows);
  }

  private async transformRows(rows: any[]) {
    if (this.config.transformFunction !== "") {
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

  getTimePartitionParameterField(data, documentName) {
    const fieldName = this.config.timePartitioningField;
    const fieldType = this.config.timePartitioningFieldType;
    const firestoreFieldName = this.config.timePartitioningFirestoreField;
    if (
      fieldName &&
      fieldType &&
      firestoreFieldName &&
      data[firestoreFieldName]
    ) {
      if (typeof data[firestoreFieldName] === "string") {
        // If wrong BigQuery format(TIMESTAMP, DATE, DATETIME) it will log out error on insertData.
        return {
          [fieldName]: data[firestoreFieldName],
        };
      } else if (
        data[firestoreFieldName] instanceof firebase.firestore.Timestamp
      )
        return {
          [fieldName]: data[firestoreFieldName].toDate(),
        };
      else {
        logs.firestoreTimePartitionFieldError(
          documentName,
          fieldName,
          firestoreFieldName,
          data[firestoreFieldName]
        );
        return {};
      }
    } else {
      logs.firestoreTimePartitioningParametersError(
        fieldName,
        fieldType,
        firestoreFieldName,
        data[firestoreFieldName]
      );
      return {};
    }
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
      {
        message: "no such field.",
        location: "document_id",
      },
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
      // Reinitializing in case the destintation table is modified.
      this.initialized = false;
      logs.bigQueryTableInsertErrors(e.errors);
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
    const dataset = this.bigqueryDataset();
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
   */
  private async initializeRawChangeLogTable() {
    const changelogName = this.rawChangeLogTableName();
    const dataset = this.bigqueryDataset();
    const table = dataset.table(changelogName);
    const [tableExists] = await table.exists();

    if (tableExists) {
      logs.bigQueryTableAlreadyExists(table.id, dataset.id);

      const [metadata] = await table.getMetadata();
      const fields = metadata.schema.fields;

      const documentIdColExists = fields.find(
        (column) => column.name === "document_id"
      );

      const partitionColExists = fields.find(
        (column) => column.name === this.config.timePartitioningField
      );

      if (!documentIdColExists) {
        fields.push(documentIdField);
        await table.setMetadata(metadata);
        logs.addDocumentIdColumn(this.rawChangeLogTableName());
      }

      if (
        !partitionColExists &&
        this.config.timePartitioningField &&
        this.config.timePartitioningFieldType
      ) {
        fields.push(
          getNewPartitionField(
            this.config.timePartitioningField,
            this.config.timePartitioningFieldType
          )
        );
        await table.setMetadata(metadata);
        logs.addPartitionFieldColumn(
          this.rawChangeLogTableName(),
          this.config.timePartitioningField
        );
      }
    } else {
      logs.bigQueryTableCreating(changelogName);
      const schema = { fields: [...RawChangelogSchema.fields] };
      if (
        this.config.timePartitioningField &&
        this.config.timePartitioningFieldType
      ) {
        schema.fields.push(
          getNewPartitionField(
            this.config.timePartitioningField,
            this.config.timePartitioningFieldType
          )
        );
      }
      const options: TableMetadata = {
        friendlyName: changelogName,
        schema: schema,
      };

      if (this.config.timePartitioning) {
        options.timePartitioning = {
          type: this.config.timePartitioning,
        };
      }

      if (this.config.timePartitioningField) {
        options.timePartitioning = {
          ...options.timePartitioning,
          field: this.config.timePartitioningField,
        };
      }

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
    const dataset = this.bigqueryDataset();
    const view = dataset.table(this.rawLatestView());
    const [viewExists] = await view.exists();
    const schema = { fields: [...RawChangelogViewSchema.fields] };
    if (
      this.config.timePartitioningField &&
      this.config.timePartitioningFieldType
    ) {
      schema.fields.push(
        getNewPartitionField(
          this.config.timePartitioningField,
          this.config.timePartitioningFieldType
        )
      );
    }
    if (viewExists) {
      logs.bigQueryViewAlreadyExists(view.id, dataset.id);
      const [metadata] = await view.getMetadata();
      const fields = metadata.schema.fields;

      const documentIdColExists = fields.find(
        (column) => column.name === "document_id"
      );

      const partitionColExists = fields.find(
        (column) => column.name === this.config.timePartitioningField
      );

      if (!documentIdColExists) {
        metadata.view = latestConsistentSnapshotView(
          this.config.datasetId,
          this.rawChangeLogTableName(),
          schema
        );

        await view.setMetadata(metadata);
        logs.addDocumentIdColumn(this.rawLatestView());
      }

      if (
        !partitionColExists &&
        this.config.timePartitioningField &&
        this.config.timePartitioningFieldType
      ) {
        fields.push(
          getNewPartitionField(
            this.config.timePartitioningField,
            this.config.timePartitioningFieldType
          )
        );
        await view.setMetadata(metadata);
        logs.addPartitionFieldColumn(
          this.rawChangeLogTableName(),
          this.config.timePartitioningField
        );
      }
    } else {
      const latestSnapshot = latestConsistentSnapshotView(
        this.config.datasetId,
        this.rawChangeLogTableName(),
        schema
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
      await view.create(options);
      await view.setMetadata({
        schema: schema,
      });
      logs.bigQueryViewCreated(this.rawLatestView());
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
