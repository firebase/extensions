import * as admin from "firebase-admin";

import { BigQuery, Dataset, Table } from "@google-cloud/bigquery";
import { ChangeType, FirestoreDocumentChangeEvent } from "../..";

import { Config } from "../../bigquery/types";
import { Partitioning } from "../../bigquery/partitioning";
import { PartitioningConfig } from "../../bigquery/partitioning/config";
import { deleteTable } from "../fixtures/clearTables";
import { logger } from "../../logger";
import * as functions from "firebase-functions";

const bq = new BigQuery({ projectId: process.env.PROJECT_ID });
let dataset: Dataset;
let table: Table;
let randomID: string;
let datasetId: string;

describe("processing partitions on a new table", () => {
  beforeAll(async () => {
    jest.spyOn(logger, "debug").mockImplementation(() => {});
    jest.spyOn(logger, "info").mockImplementation(() => {});
    jest.spyOn(logger, "warn").mockImplementation(() => {});
    jest.spyOn(logger, "error").mockImplementation(() => {});

    jest.spyOn(functions.logger, "debug").mockImplementation(() => {});
    jest.spyOn(functions.logger, "info").mockImplementation(() => {});
    jest.spyOn(functions.logger, "warn").mockImplementation(() => {});
    jest.spyOn(functions.logger, "error").mockImplementation(() => {});
    jest.spyOn(functions.logger, "log").mockImplementation(() => {});
    randomID = (Math.random() + 1).toString(36).substring(7);
    datasetId = `bq_${randomID}`;
    [dataset] = await bq.createDataset(datasetId, {
      location: "europe-west2",
    });
    [table] = await dataset.createTable(`bq_${randomID}`, {});
  });

  afterAll(async () => {
    (logger.debug as jest.Mock).mockRestore();
    (logger.info as jest.Mock).mockRestore();
    (logger.warn as jest.Mock).mockRestore();
    (logger.error as jest.Mock).mockRestore();

    (functions.logger.debug as jest.Mock).mockRestore();
    (functions.logger.info as jest.Mock).mockRestore();
    (functions.logger.warn as jest.Mock).mockRestore();
    (functions.logger.error as jest.Mock).mockRestore();
    (functions.logger.log as jest.Mock).mockRestore();
  });
  describe("addPartitioningToSchema", () => {
    test("adds a custom TIMESTAMP to a schema", async () => {
      const config: Config = {
        datasetId: "dataset",
        tableId: "table",
        datasetLocation: "US",
        partitioning: {
          granularity: "DAY",
          bigqueryColumnName: "end_date",
          bigqueryColumnType: "TIMESTAMP",
          firestoreFieldName: "endDate",
        },
        transformFunction: "",
        clustering: [],
        bqProjectId: undefined,
      };

      const fields = [];

      const partitioningConfig = new PartitioningConfig(config.partitioning);
      const partitioning = new Partitioning(partitioningConfig, table);

      await partitioning.addPartitioningToSchema(fields);

      const [metadata] = await table.getMetadata();

      expect(metadata.schema).toBeUndefined();
      expect(fields[0].description).toEqual(
        "The document TimePartition partition field selected by user"
      );
      expect(fields[0].mode).toEqual("NULLABLE");
      expect(fields[0].name).toEqual("end_date");
      expect(fields[0].type).toEqual("TIMESTAMP");
    });

    test("adds a custom DATETIME to a schema", async () => {
      const config: Config = {
        datasetId: "dataset",
        tableId: "table",
        datasetLocation: "US",
        partitioning: {
          granularity: "DAY",
          bigqueryColumnName: "end_date",
          bigqueryColumnType: "DATETIME",
          firestoreFieldName: "endDate",
        },
        transformFunction: "",
        clustering: [],
        bqProjectId: undefined,
      };

      const fields = [];

      const partitioningConfig = new PartitioningConfig(config.partitioning);
      const partitioning = new Partitioning(partitioningConfig, table);

      await partitioning.addPartitioningToSchema(fields);

      const [metadata] = await table.getMetadata();

      expect(metadata.schema).toBeUndefined();
      expect(fields[0].description).toEqual(
        "The document TimePartition partition field selected by user"
      );
      expect(fields[0].mode).toEqual("NULLABLE");
      expect(fields[0].name).toEqual("end_date");
      expect(fields[0].type).toEqual("DATETIME");
    });

    test("does not add an invalid time partition type to a schema", async () => {
      const config: Config = {
        datasetId: "dataset",
        tableId: "table",
        datasetLocation: "US",
        partitioning: {
          granularity: "DAY",
          bigqueryColumnName: "end_date",
          bigqueryColumnType: "INVALID_TYPE" as any,
          firestoreFieldName: "endDate",
        },
        transformFunction: "",
        clustering: [],
        bqProjectId: undefined,
      };

      const fields = [];

      const partitioningConfig = new PartitioningConfig(config.partitioning);
      const partitioning = new Partitioning(partitioningConfig, table);

      await partitioning.addPartitioningToSchema(fields);

      const [metadata] = await table.getMetadata();

      expect(metadata.schema).toBeUndefined();
      expect(fields[0]).toBeUndefined();
    });

    test("does not add partitioning without a valid timePartitioning value ", async () => {
      const config: Config = {
        datasetId: "",
        tableId: "",
        datasetLocation: "",
        partitioning: {
          granularity: "NONE",
        },
        transformFunction: "",
        clustering: [],
        bqProjectId: undefined,
      };

      const fields = [];

      const partitioningConfig = new PartitioningConfig(config.partitioning);
      const partitioning = new Partitioning(partitioningConfig, table);

      await partitioning.addPartitioningToSchema(fields);

      const [metadata] = await table.getMetadata();

      expect(metadata.schema).toBeUndefined();
      expect(fields[0]).toBeUndefined();
    });

    test("does not add partitioning without a timePartitioningFirestoreField", async () => {
      const config: Config = {
        datasetId: "",
        tableId: "",
        datasetLocation: "",
        partitioning: {
          granularity: "NONE",
        },
        transformFunction: "",
        clustering: [],
        bqProjectId: undefined,
      };

      const fields = [];

      const partitioningConfig = new PartitioningConfig(config.partitioning);
      const partitioning = new Partitioning(partitioningConfig, table);

      await partitioning.addPartitioningToSchema(fields);

      const [metadata] = await table.getMetadata();

      expect(metadata.schema).toBeUndefined();
      expect(fields[0]).toBeUndefined();
    });
  });

  describe("getPartitionValue", () => {
    test("returns a value when timePartitioningField and timePartitioningFirestoreField string value has been defined", async () => {
      const config: Config = {
        datasetId: "",
        tableId: "",
        datasetLocation: "",
        partitioning: {
          granularity: "DAY",
          bigqueryColumnName: "end_date",
          bigqueryColumnType: "DATETIME" as const,
          firestoreFieldName: "end_date",
        },
        transformFunction: "",
        clustering: [],
        bqProjectId: undefined,
      };

      const end_date = admin.firestore.Timestamp.now();

      const event: FirestoreDocumentChangeEvent = {
        timestamp: "",
        operation: ChangeType.CREATE,
        documentName: "",
        eventId: "",
        documentId: "",
        data: { end_date },
      };

      const partitioningConfig = new PartitioningConfig(config.partitioning);
      const partitioning = new Partitioning(partitioningConfig, table);
      const value = partitioning.getPartitionValue(event);

      expect(value.end_date).toBeDefined();
    });

    test("returns a value when timePartitioningField and timePartitioningFirestoreField string value has been defined, with a timestamp-like value", async () => {
      const config: Config = {
        datasetId: "",
        tableId: "",
        datasetLocation: "",
        partitioning: {
          granularity: "DAY",
          bigqueryColumnName: "end_date",
          bigqueryColumnType: "DATETIME" as const,
          firestoreFieldName: "end_date",
        },
        transformFunction: "",
        clustering: [],
        bqProjectId: undefined,
      };

      // a Timestamp-Like object (we lose the instance after serialization)
      const end_date = {
        _seconds: 1614153600,
        _nanoseconds: 0,
      };

      const event: FirestoreDocumentChangeEvent = {
        timestamp: "",
        operation: ChangeType.CREATE,
        documentName: "",
        eventId: "",
        documentId: "",
        data: { end_date },
      };

      const partitioningConfig = new PartitioningConfig(config.partitioning);
      const partitioning = new Partitioning(partitioningConfig, table);
      const value = partitioning.getPartitionValue(event);

      expect(value.end_date).toBeDefined();
    });

    test("returns an empty object when _seconds or _nanoseconds is not a number", async () => {
      const config: Config = {
        datasetId: "",
        tableId: "",
        datasetLocation: "",
        partitioning: {
          granularity: "DAY",
          bigqueryColumnName: "end_date",
          bigqueryColumnType: "DATETIME" as const,
          firestoreFieldName: "end_date",
        },
        transformFunction: "",
        clustering: [],
        bqProjectId: undefined,
      };

      const end_date = {
        _seconds: "not a number",
        _nanoseconds: 0,
      };

      const event: FirestoreDocumentChangeEvent = {
        timestamp: "",
        operation: ChangeType.CREATE,
        documentName: "",
        eventId: "",
        documentId: "",
        data: { end_date },
      };

      const partitioningConfig = new PartitioningConfig(config.partitioning);
      const partitioning = new Partitioning(partitioningConfig, table);
      const value = partitioning.getPartitionValue(event);

      expect(value).toEqual({});
    });

    test("returns a value when timePartitioningField and timePartitioningFirestoreField string value has been defined, and is timestamp-like", async () => {
      const config: Config = {
        datasetId: "",
        tableId: "",
        datasetLocation: "",
        partitioning: {
          granularity: "DAY",
          bigqueryColumnName: "end_date",
          bigqueryColumnType: "DATETIME" as const,
          firestoreFieldName: "end_date",
        },
        transformFunction: "",
        clustering: [],
        bqProjectId: undefined,
      };

      const end_date = {
        _seconds: 1614153600,
        _nanoseconds: 0,
      };

      const event: FirestoreDocumentChangeEvent = {
        timestamp: "",
        operation: ChangeType.CREATE,
        documentName: "",
        eventId: "",
        documentId: "",
        data: { end_date },
      };

      const partitioningConfig = new PartitioningConfig(config.partitioning);
      const partitioning = new Partitioning(partitioningConfig, table);
      const value = partitioning.getPartitionValue(event);

      expect(value.end_date).toBeDefined();
    });

    test("returns an empty object if timePartitioningFirestoreField has not been provided", async () => {
      const config: Config = {
        datasetId: "",
        tableId: "",
        datasetLocation: "",
        partitioning: {
          granularity: "DAY",
          bigqueryColumnName: "end_date",
          bigqueryColumnType: "DATETIME",
          firestoreFieldName: undefined,
        },
        transformFunction: "",
        clustering: [],
        bqProjectId: undefined,
      };

      const end_date = admin.firestore.Timestamp.now();

      const event: FirestoreDocumentChangeEvent = {
        timestamp: "",
        operation: ChangeType.CREATE,
        documentName: "",
        eventId: "",
        documentId: "",
        data: { end_date },
      };

      const partitioningConfig = new PartitioningConfig(config.partitioning);
      const partitioning = new Partitioning(partitioningConfig, table);
      const value = partitioning.getPartitionValue(event);

      expect(value).toEqual({});
    });
    test("returns an empty object if timePartitioningFirestoreField has not been provided", async () => {
      const config: Config = {
        datasetId: "",
        tableId: "",
        datasetLocation: "",
        partitioning: {
          granularity: "DAY",
          bigqueryColumnName: "end_date",
          bigqueryColumnType: "DATETIME",
          firestoreFieldName: undefined,
        },
        transformFunction: "",
        clustering: [],
        bqProjectId: undefined,
      };

      const end_date = admin.firestore.Timestamp.now();

      const event: FirestoreDocumentChangeEvent = {
        timestamp: "",
        operation: ChangeType.CREATE,
        documentName: "",
        eventId: "",
        documentId: "",
        data: { end_date },
      };

      const partitioningConfig = new PartitioningConfig(config.partitioning);
      const partitioning = new Partitioning(partitioningConfig, table);
      const value = partitioning.getPartitionValue(event);

      expect(value).toEqual({});
    });

    test("returns an empty object if timePartitioningFirestoreField timePartitioningField", async () => {
      const config: Config = {
        datasetId: "",
        tableId: "",
        datasetLocation: "",
        partitioning: {
          granularity: "DAY",
          bigqueryColumnName: "end_date",
          bigqueryColumnType: "DATETIME",
          firestoreFieldName: "date_end",
        },
        transformFunction: "",
        clustering: [],
        bqProjectId: undefined,
      };

      const end_date = admin.firestore.Timestamp.now();

      const event: FirestoreDocumentChangeEvent = {
        timestamp: "",
        operation: ChangeType.CREATE,
        documentName: "",
        eventId: "",
        documentId: "",
        data: { end_date },
      };

      const partitioningConfig = new PartitioningConfig(config.partitioning);
      const partitioning = new Partitioning(partitioningConfig, table);
      const value = partitioning.getPartitionValue(event);

      expect(value).toEqual({});
    });

    test("returns an empty object if no event data has been provided", async () => {
      const config: Config = {
        datasetId: "",
        tableId: "",
        datasetLocation: "",
        partitioning: {
          granularity: "DAY",
          bigqueryColumnName: "end_date",
          bigqueryColumnType: "DATETIME",
          firestoreFieldName: "end_date",
        },
        transformFunction: "",
        clustering: [],
        bqProjectId: undefined,
      };

      const event: FirestoreDocumentChangeEvent = {
        timestamp: "",
        operation: ChangeType.CREATE,
        documentName: "",
        eventId: "",
        documentId: "",
        data: {},
      };

      const partitioningConfig = new PartitioningConfig(config.partitioning);
      const partitioning = new Partitioning(partitioningConfig, table);
      const value = partitioning.getPartitionValue(event);

      expect(value).toEqual({});
    });

    test("returns an empty object if a non string or Timestamp value is synced from Firestore", async () => {
      const config: Config = {
        datasetId: "",
        tableId: "",
        datasetLocation: "",
        partitioning: {
          granularity: "DAY",
          bigqueryColumnName: "end_date",
          bigqueryColumnType: "DATETIME",
          firestoreFieldName: "end_date",
        },
        transformFunction: "",
        clustering: [],
        bqProjectId: undefined,
      };

      const end_date = 123;

      const event: FirestoreDocumentChangeEvent = {
        timestamp: "",
        operation: ChangeType.CREATE,
        documentName: "",
        eventId: "",
        documentId: "",
        data: { end_date },
      };

      const partitioningConfig = new PartitioningConfig(config.partitioning);
      const partitioning = new Partitioning(partitioningConfig, table);
      const value = partitioning.getPartitionValue(event);

      expect(value).toEqual({});
    });
  });

  describe("isTablePartitioned", () => {
    test("partition return false if table is not provided", async () => {
      const config: Config = {
        datasetId: "",
        tableId: "",
        datasetLocation: "",
        partitioning: {
          granularity: "HOUR",
          bigqueryColumnName: "end_date",
          bigqueryColumnType: "DATETIME",
          firestoreFieldName: undefined,
        },
        transformFunction: "",
        clustering: [],
        bqProjectId: undefined,
      };

      const partitioningConfig = new PartitioningConfig(config.partitioning);
      const partitioning = new Partitioning(partitioningConfig);

      const result = await partitioning.isTablePartitioned();

      expect(result).toBe(false);
    });
  });

  test("partition return false if table is not provided", async () => {
    const config: Config = {
      datasetId: "",
      tableId: "",
      datasetLocation: "",
      partitioning: {
        granularity: "HOUR",
        bigqueryColumnName: "end_date",
        bigqueryColumnType: "DATETIME",
        firestoreFieldName: undefined,
      },
      transformFunction: "",
      clustering: [],
      bqProjectId: process.env.PROJECT_ID,
    };

    const fields = [];

    const partitioningConfig = new PartitioningConfig(config.partitioning);
    const partitioning = new Partitioning(partitioningConfig);

    await partitioning.addPartitioningToSchema(fields);

    const [metadata] = await table.getMetadata();

    expect(metadata.schema).toBeUndefined();
    expect(fields[0]).toBeUndefined();
  });

  afterAll(async () => {
    await deleteTable({
      datasetId,
    });
  });
});

describe("updateTableMetadata", () => {
  let testTable: Table;
  let testDataset: Dataset;

  beforeAll(async () => {
    const randomID = (Math.random() + 1).toString(36).substring(7);
    const testDatasetId = `bq_test_${randomID}`;
    [testDataset] = await bq.createDataset(testDatasetId, {
      location: "europe-west2",
    });
    [testTable] = await testDataset.createTable(`bq_test_${randomID}`, {});
  });

  afterAll(async () => {
    await deleteTable({
      datasetId: testDataset.id,
    });
  });

  test("updates the table metadata with the timestamp field", async () => {
    const config: Config = {
      datasetId: "",
      tableId: "",
      datasetLocation: "",
      partitioning: {
        granularity: "MONTH",
        bigqueryColumnName: "timestamp",
      },
      transformFunction: "",
      clustering: [],
      bqProjectId: null,
    };
    const options = {};

    const partitioningConfig = new PartitioningConfig(config.partitioning);
    const partitioning = new Partitioning(partitioningConfig, testTable);

    await partitioning.updateTableMetadata(options);

    expect(options).toEqual({
      timePartitioning: {
        field: "timestamp",
        type: "MONTH",
      },
    });
  });
  test("Should not update if there is a custom option with the timestamp option", async () => {
    const config: Config = {
      datasetId: "",
      tableId: "",
      datasetLocation: "",
      partitioning: {
        granularity: "MONTH",
        bigqueryColumnName: "timestamp",
        bigqueryColumnType: "DATETIME",
      },
      transformFunction: "",
      clustering: [],
      bqProjectId: null,
    };
    const options = {};

    const partitioningConfig = new PartitioningConfig(config.partitioning);
    const partitioning = new Partitioning(partitioningConfig, testTable);

    await partitioning.updateTableMetadata(options);

    expect(options).toEqual({});
  });

  test("updates metadata with ingestion time partitioning (no column specified)", async () => {
    const partitioningConfig = new PartitioningConfig({
      granularity: "DAY",
    });
    const options = {};

    const partitioning = new Partitioning(partitioningConfig, testTable);
    await partitioning.updateTableMetadata(options);

    expect(options).toEqual({
      timePartitioning: {
        type: "DAY",
      },
    });
  });

  test("updates metadata with firestore field partitioning", async () => {
    const partitioningConfig = new PartitioningConfig({
      granularity: "MONTH",
      bigqueryColumnName: "created_at",
      bigqueryColumnType: "TIMESTAMP",
      firestoreFieldName: "createdAt",
    });
    const options = {};

    const partitioning = new Partitioning(partitioningConfig, testTable);
    await partitioning.updateTableMetadata(options);

    expect(options).toEqual({
      timePartitioning: {
        type: "MONTH",
        field: "created_at",
      },
    });
  });

  test("does not update metadata when partitioning is NONE", async () => {
    const partitioningConfig = new PartitioningConfig({
      granularity: "NONE",
    });
    const options = {};

    const partitioning = new Partitioning(partitioningConfig, testTable);
    await partitioning.updateTableMetadata(options);

    expect(options).toEqual({});
  });

  test("does not update metadata when HOUR granularity with DATE type", async () => {
    const partitioningConfig = new PartitioningConfig({
      granularity: "HOUR",
      bigqueryColumnName: "event_date",
      bigqueryColumnType: "DATE",
      firestoreFieldName: "eventDate",
    });
    const options = {};

    const partitioning = new Partitioning(partitioningConfig, testTable);
    await partitioning.updateTableMetadata(options);

    expect(options).toEqual({});
  });

  test("supports all granularity values for ingestion time partitioning", async () => {
    const granularities = ["HOUR", "DAY", "MONTH", "YEAR"] as const;

    for (const granularity of granularities) {
      const partitioningConfig = new PartitioningConfig({ granularity });
      const options = {};

      const partitioning = new Partitioning(partitioningConfig, testTable);
      await partitioning.updateTableMetadata(options);

      expect(options).toEqual({
        timePartitioning: {
          type: granularity,
        },
      });
    }
  });
});

describe("getPartitionValue with DELETE operations", () => {
  let testTable: Table;
  let testDataset: Dataset;

  beforeAll(async () => {
    const randomID = (Math.random() + 1).toString(36).substring(7);
    const testDatasetId = `bq_delete_${randomID}`;
    [testDataset] = await bq.createDataset(testDatasetId, {
      location: "europe-west2",
    });
    [testTable] = await testDataset.createTable(`bq_delete_${randomID}`, {});
  });

  afterAll(async () => {
    await deleteTable({
      datasetId: testDataset.id,
    });
  });

  test("uses oldData for DELETE operations", () => {
    const partitioningConfig = new PartitioningConfig({
      granularity: "DAY",
      bigqueryColumnName: "end_date",
      bigqueryColumnType: "TIMESTAMP",
      firestoreFieldName: "endDate",
    });

    const oldDate = admin.firestore.Timestamp.fromDate(
      new Date("2024-01-15T10:00:00Z")
    );

    const event: FirestoreDocumentChangeEvent = {
      timestamp: "",
      operation: ChangeType.DELETE,
      documentName: "test/doc",
      eventId: "event1",
      documentId: "doc",
      data: null,
      oldData: { endDate: oldDate },
    };

    const partitioning = new Partitioning(partitioningConfig, testTable);
    const value = partitioning.getPartitionValue(event);

    expect(value.end_date).toBeDefined();
  });

  test("returns empty object for DELETE when oldData is null", () => {
    const partitioningConfig = new PartitioningConfig({
      granularity: "DAY",
      bigqueryColumnName: "end_date",
      bigqueryColumnType: "TIMESTAMP",
      firestoreFieldName: "endDate",
    });

    const event: FirestoreDocumentChangeEvent = {
      timestamp: "",
      operation: ChangeType.DELETE,
      documentName: "test/doc",
      eventId: "event1",
      documentId: "doc",
      data: null,
      oldData: null,
    };

    const partitioning = new Partitioning(partitioningConfig, testTable);
    const value = partitioning.getPartitionValue(event);

    expect(value).toEqual({});
  });

  test("returns empty object for DELETE when oldData lacks the field", () => {
    const partitioningConfig = new PartitioningConfig({
      granularity: "DAY",
      bigqueryColumnName: "end_date",
      bigqueryColumnType: "TIMESTAMP",
      firestoreFieldName: "endDate",
    });

    const event: FirestoreDocumentChangeEvent = {
      timestamp: "",
      operation: ChangeType.DELETE,
      documentName: "test/doc",
      eventId: "event1",
      documentId: "doc",
      data: null,
      oldData: { otherField: "value" },
    };

    const partitioning = new Partitioning(partitioningConfig, testTable);
    const value = partitioning.getPartitionValue(event);

    expect(value).toEqual({});
  });
});

describe("isValidPartitionForExistingTable", () => {
  let testTable: Table;
  let testDataset: Dataset;
  let partitionedTable: Table;

  beforeAll(async () => {
    const randomID = (Math.random() + 1).toString(36).substring(7);
    const testDatasetId = `bq_valid_${randomID}`;
    [testDataset] = await bq.createDataset(testDatasetId, {
      location: "europe-west2",
    });
    [testTable] = await testDataset.createTable(`bq_valid_${randomID}`, {});
    [partitionedTable] = await testDataset.createTable(
      `bq_partitioned_${randomID}`,
      {
        timePartitioning: {
          type: "DAY",
        },
      }
    );
  });

  afterAll(async () => {
    await deleteTable({
      datasetId: testDataset.id,
    });
  });

  test("returns false when partitioning is NONE", async () => {
    const partitioningConfig = new PartitioningConfig({
      granularity: "NONE",
    });

    const partitioning = new Partitioning(partitioningConfig, testTable);
    const result = await partitioning.isValidPartitionForExistingTable();

    expect(result).toBe(false);
  });

  test("returns true for valid partitioning on non-partitioned table", async () => {
    const partitioningConfig = new PartitioningConfig({
      granularity: "DAY",
    });

    const partitioning = new Partitioning(partitioningConfig, testTable);
    const result = await partitioning.isValidPartitionForExistingTable();

    expect(result).toBe(true);
  });

  test("returns false when table is already partitioned", async () => {
    const partitioningConfig = new PartitioningConfig({
      granularity: "DAY",
    });

    const partitioning = new Partitioning(partitioningConfig, partitionedTable);
    const result = await partitioning.isValidPartitionForExistingTable();

    expect(result).toBe(false);
  });
});

describe("addPartitioningToSchema with DATE type", () => {
  let testTable: Table;
  let testDataset: Dataset;

  beforeAll(async () => {
    const randomID = (Math.random() + 1).toString(36).substring(7);
    const testDatasetId = `bq_date_${randomID}`;
    [testDataset] = await bq.createDataset(testDatasetId, {
      location: "europe-west2",
    });
    [testTable] = await testDataset.createTable(`bq_date_${randomID}`, {});
  });

  afterAll(async () => {
    await deleteTable({
      datasetId: testDataset.id,
    });
  });

  test("adds a DATE type partition field to schema", async () => {
    const partitioningConfig = new PartitioningConfig({
      granularity: "DAY",
      bigqueryColumnName: "event_date",
      bigqueryColumnType: "DATE",
      firestoreFieldName: "eventDate",
    });

    const fields = [];
    const partitioning = new Partitioning(partitioningConfig, testTable);
    await partitioning.addPartitioningToSchema(fields);

    expect(fields[0]).toEqual({
      name: "event_date",
      mode: "NULLABLE",
      type: "DATE",
      description:
        "The document TimePartition partition field selected by user",
    });
  });

  test("does not add duplicate field if it already exists", async () => {
    const partitioningConfig = new PartitioningConfig({
      granularity: "DAY",
      bigqueryColumnName: "event_date",
      bigqueryColumnType: "DATE",
      firestoreFieldName: "eventDate",
    });

    const fields = [{ name: "event_date", type: "DATE", mode: "NULLABLE" }];
    const partitioning = new Partitioning(partitioningConfig, testTable);
    await partitioning.addPartitioningToSchema(fields);

    expect(fields.length).toBe(1);
  });

  test("does not add field for ingestion time partitioning", async () => {
    const partitioningConfig = new PartitioningConfig({
      granularity: "DAY",
    });

    const fields = [];
    const partitioning = new Partitioning(partitioningConfig, testTable);
    await partitioning.addPartitioningToSchema(fields);

    expect(fields.length).toBe(0);
  });
});
