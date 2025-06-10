import * as admin from "firebase-admin";
import { BigQuery, Dataset, Table } from "@google-cloud/bigquery";
import { ChangeType, FirestoreDocumentChangeEvent } from "../..";
import { FirestoreBigQueryEventHistoryTrackerConfig } from "../../bigquery";
import { Partitioning } from "../../bigquery/partitioning";
import { deleteTable } from "../fixtures/clearTables";
import { logger } from "../../logger";
import * as functions from "firebase-functions";
import { ZodError } from "zod";

let bq: BigQuery;
let dataset: Dataset;
let table: Table;
let randomID: string;
let datasetId: string;

describe("processing partitions on a new table", () => {
  beforeAll(async () => {
    jest.spyOn(logger, "warn").mockImplementation(() => {});
    jest.spyOn(functions.logger, "log").mockImplementation(() => {});

    bq = new BigQuery({ projectId: process.env.PROJECT_ID });
    randomID = (Math.random() + 1).toString(36).substring(7);
    datasetId = `bq_${randomID}`;
    [dataset] = await bq.createDataset(datasetId, {
      location: "europe-west2",
    });
  });

  beforeEach(async () => {
    // Create a new table for each test to ensure isolation
    [table] = await dataset.createTable(
      `bq_table_${(Math.random() + 1).toString(36).substring(7)}`,
      {}
    );
  });

  afterAll(async () => {
    (logger.warn as jest.Mock).mockRestore();
    (functions.logger.log as jest.Mock).mockRestore();
    await deleteTable({ datasetId });
  });

  describe("addPartitioningToSchema", () => {
    test("adds a custom TIMESTAMP field to a schema", async () => {
      const config: FirestoreBigQueryEventHistoryTrackerConfig = {
        datasetId: "dataset",
        tableId: "table",
        timePartitioning: "DAY",
        timePartitioningColumn: "end_date",
        timePartitioningFieldType: "TIMESTAMP",
        timePartitioningFirestoreField: "endDate",
        clustering: [],
      };

      const fields = [];
      const partitioning = new Partitioning(config, table);

      await partitioning.addPartitioningToSchema(fields);

      expect(fields[0]).toEqual({
        name: "end_date",
        type: "TIMESTAMP",
        mode: "NULLABLE",
        description:
          "The document TimePartition partition field selected by user",
      });
    });

    test("adds a custom DATETIME field to a schema", async () => {
      const config: FirestoreBigQueryEventHistoryTrackerConfig = {
        datasetId: "dataset",
        tableId: "table",
        timePartitioning: "DAY",
        timePartitioningColumn: "end_date",
        timePartitioningFieldType: "DATETIME",
        timePartitioningFirestoreField: "endDate",
        clustering: [],
      };

      const fields = [];
      const partitioning = new Partitioning(config, table);

      await partitioning.addPartitioningToSchema(fields);

      expect(fields[0]).toEqual({
        name: "end_date",
        type: "DATETIME",
        mode: "NULLABLE",
        description:
          "The document TimePartition partition field selected by user",
      });
    });

    test("throws an error for invalid time partition type in config", () => {
      const config = {
        timePartitioning: "DAY",
        timePartitioningColumn: "end_date",
        timePartitioningFieldType: "UNKNOWN", // Invalid type
        timePartitioningFirestoreField: "endDate",
      } as any;

      expect(() => new Partitioning(config, table)).toThrow(ZodError);
    });
  });

  describe("getPartitionValue", () => {
    test("returns a converted value for a valid Firestore Timestamp", () => {
      const config: FirestoreBigQueryEventHistoryTrackerConfig = {
        datasetId: "d",
        tableId: "t",
        timePartitioning: "DAY",
        timePartitioningColumn: "end_date_col",
        timePartitioningFieldType: "DATETIME",
        timePartitioningFirestoreField: "endDateField",
        clustering: [],
      };
      const now = admin.firestore.Timestamp.now();
      const event: FirestoreDocumentChangeEvent = {
        timestamp: "t",
        operation: ChangeType.CREATE,
        documentName: "d",
        eventId: "e",
        documentId: "d",
        data: { endDateField: now },
      };

      const partitioning = new Partitioning(config, table);
      const value = partitioning.getPartitionValue(event);
      expect(value.end_date_col).toBeDefined();
      expect(typeof value.end_date_col).toBe("string");
    });

    test("returns a converted value for a timestamp-like object", () => {
      const config: FirestoreBigQueryEventHistoryTrackerConfig = {
        datasetId: "d",
        tableId: "t",
        timePartitioning: "DAY",
        timePartitioningColumn: "end_date_col",
        timePartitioningFieldType: "DATETIME",
        timePartitioningFirestoreField: "endDateField",
        clustering: [],
      };
      const timestampLike = { _seconds: 1614153600, _nanoseconds: 0 };
      const event: FirestoreDocumentChangeEvent = {
        timestamp: "t",
        operation: ChangeType.CREATE,
        documentName: "d",
        eventId: "e",
        documentId: "d",
        data: { endDateField: timestampLike },
      };

      const partitioning = new Partitioning(config, table);
      const value = partitioning.getPartitionValue(event);
      expect(value.end_date_col).toBeDefined();
      expect(typeof value.end_date_col).toBe("string");
    });

    test("throws an error if config is missing timePartitioningFirestoreField", () => {
      const config = {
        datasetId: "d",
        tableId: "t",
        timePartitioning: "DAY",
        timePartitioningColumn: "end_date",
        timePartitioningFieldType: "DATETIME",
        timePartitioningFirestoreField: null, // Invalid
        clustering: [],
      } as any;

      expect(() => new Partitioning(config, table)).toThrow(ZodError);
    });

    test("returns an empty object if firestore field is missing from data", () => {
      const config: FirestoreBigQueryEventHistoryTrackerConfig = {
        datasetId: "d",
        tableId: "t",
        timePartitioning: "DAY",
        timePartitioningColumn: "end_date",
        timePartitioningFieldType: "DATETIME",
        timePartitioningFirestoreField: "a_different_field",
        clustering: [],
      };

      const event: FirestoreDocumentChangeEvent = {
        timestamp: "t",
        operation: ChangeType.CREATE,
        documentName: "d",
        eventId: "e",
        documentId: "d",
        data: { end_date: "testing" }, // 'a_different_field' is missing
      };

      const partitioning = new Partitioning(config, table);
      const value = partitioning.getPartitionValue(event);
      expect(value).toEqual({});
    });

    test("returns an empty object if value is not a valid date/timestamp type", () => {
      const config: FirestoreBigQueryEventHistoryTrackerConfig = {
        datasetId: "d",
        tableId: "t",
        timePartitioning: "DAY",
        timePartitioningColumn: "end_date",
        timePartitioningFieldType: "DATETIME",
        timePartitioningFirestoreField: "end_date",
        clustering: [],
      };

      const event: FirestoreDocumentChangeEvent = {
        timestamp: "t",
        operation: ChangeType.CREATE,
        documentName: "d",
        eventId: "e",
        documentId: "d",
        data: { end_date: 20 }, // Invalid type
      };

      const partitioning = new Partitioning(config, table);
      const value = partitioning.getPartitionValue(event);
      expect(value).toEqual({});
    });
  });

  describe("updateTableMetadata", () => {
    test("updates metadata for ingestion-time partitioning", async () => {
      const config: FirestoreBigQueryEventHistoryTrackerConfig = {
        datasetId: "d",
        tableId: "t",
        timePartitioning: "MONTH",
        clustering: [],
      };
      const options = {};
      const partitioning = new Partitioning(config, table);

      await partitioning.updateTableMetadata(options);

      expect(options).toEqual({
        timePartitioning: {
          type: "MONTH",
        },
      });
    });

    test("updates metadata for 'timestamp' field partitioning", async () => {
      const config: FirestoreBigQueryEventHistoryTrackerConfig = {
        datasetId: "d",
        tableId: "t",
        timePartitioning: "MONTH",
        timePartitioningColumn: "timestamp",
        clustering: [],
      };
      const options = {};
      const partitioning = new Partitioning(config, table);
      await partitioning.updateTableMetadata(options);
      expect(options).toEqual({
        timePartitioning: {
          field: "timestamp",
          type: "MONTH",
        },
      });
    });

    test("throws an error for conflicting 'timestamp' field config", () => {
      const config = {
        timePartitioning: "MONTH",
        timePartitioningColumn: "timestamp",
        // This is not allowed when column is 'timestamp'
        timePartitioningFieldType: "DATETIME",
        clustering: [],
      } as any;

      expect(() => new Partitioning(config, table)).toThrow(ZodError);
    });
  });
});
