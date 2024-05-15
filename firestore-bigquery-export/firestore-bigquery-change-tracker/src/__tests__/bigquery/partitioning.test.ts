import * as admin from "firebase-admin";

import { BigQuery, Dataset, Table } from "@google-cloud/bigquery";
import { ChangeType, FirestoreDocumentChangeEvent } from "../..";

import { FirestoreBigQueryEventHistoryTrackerConfig } from "../../bigquery";
import { Partitioning } from "../../bigquery/partitioning";
import { deleteTable } from "../fixtures/clearTables";

let bq: BigQuery;
let dataset: Dataset;
let table: Table;
let randomID: string;
let datasetId: string;

describe("processing partitions on a new table", () => {
  beforeAll(async () => {
    bq = new BigQuery({ projectId: process.env.PROJECT_ID });
    randomID = (Math.random() + 1).toString(36).substring(7);
    datasetId = `bq_${randomID}`;
    [dataset] = await bq.createDataset(datasetId, {
      location: "europe-west2",
    });
    [table] = await dataset.createTable(`bq_${randomID}`, {});
  });
  describe("addPartitioningToSchema", () => {
    test("adds a custom TIMESTAMP to a schema", async () => {
      const config: FirestoreBigQueryEventHistoryTrackerConfig = {
        datasetId: "dataset",
        tableId: "table",
        datasetLocation: "US",
        timePartitioning: "DAY",
        timePartitioningField: "end_date",
        timePartitioningFieldType: "TIMESTAMP",
        timePartitioningFirestoreField: "endDate",
        transformFunction: "",
        clustering: [],
        bqProjectId: null,
      };

      const fields = [];

      const partitioning = new Partitioning(config, table);

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
      const config: FirestoreBigQueryEventHistoryTrackerConfig = {
        datasetId: "dataset",
        tableId: "table",
        datasetLocation: "US",
        timePartitioning: "DAY",
        timePartitioningField: "end_date",
        timePartitioningFieldType: "DATETIME",
        timePartitioningFirestoreField: "endDate",
        transformFunction: "",
        clustering: [],
        bqProjectId: null,
      };

      const fields = [];

      const partitioning = new Partitioning(config, table);

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
      const config: FirestoreBigQueryEventHistoryTrackerConfig = {
        datasetId: "dataset",
        tableId: "table",
        datasetLocation: "US",
        timePartitioning: "DAY",
        timePartitioningField: "end_date",
        timePartitioningFieldType: "UNKNOWN",
        timePartitioningFirestoreField: "endDate",
        transformFunction: "",
        clustering: [],
        bqProjectId: null,
      };

      const fields = [];

      const partitioning = new Partitioning(config, table);

      await partitioning.addPartitioningToSchema(fields);

      const [metadata] = await table.getMetadata();

      expect(metadata.schema).toBeUndefined();
      expect(fields[0]).toBeUndefined();
    });

    test("does not add partitioning without a valid timePartitioning value ", async () => {
      const config: FirestoreBigQueryEventHistoryTrackerConfig = {
        datasetId: "",
        tableId: "",
        datasetLocation: "",
        timePartitioning: "",
        timePartitioningField: "end_date",
        timePartitioningFieldType: "DATETIME",
        timePartitioningFirestoreField: "endDate",
        transformFunction: "",
        clustering: [],
        bqProjectId: null,
      };

      const fields = [];

      const partitioning = new Partitioning(config, table);

      await partitioning.addPartitioningToSchema(fields);

      const [metadata] = await table.getMetadata();

      expect(metadata.schema).toBeUndefined();
      expect(fields[0]).toBeUndefined();
    });

    test("does not add partitioning without a timePartitioningFirestoreField", async () => {
      const config: FirestoreBigQueryEventHistoryTrackerConfig = {
        datasetId: "",
        tableId: "",
        datasetLocation: "",
        timePartitioning: "",
        timePartitioningField: "end_date",
        timePartitioningFieldType: "DATETIME",
        timePartitioningFirestoreField: null,
        transformFunction: "",
        clustering: [],
        bqProjectId: null,
      };

      const fields = [];

      const partitioning = new Partitioning(config, table);

      await partitioning.addPartitioningToSchema(fields);

      const [metadata] = await table.getMetadata();

      expect(metadata.schema).toBeUndefined();
      expect(fields[0]).toBeUndefined();
    });
  });

  describe("getPartitionValue", () => {
    test("returns a value when timePartitioningField and timePartitioningFirestoreField string value has been defined", async () => {
      const config: FirestoreBigQueryEventHistoryTrackerConfig = {
        datasetId: "",
        tableId: "",
        datasetLocation: "",
        timePartitioning: "",
        timePartitioningField: "end_date",
        timePartitioningFieldType: "DATETIME",
        timePartitioningFirestoreField: "end_date",
        transformFunction: "",
        clustering: [],
        bqProjectId: null,
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

      const partitioning = new Partitioning(config, table);
      const value = partitioning.getPartitionValue(event);

      expect(value.end_date).toBeDefined();
    });

    test("returns a value when timePartitioningField and timePartitioningFirestoreField string value has been defined, with a timestamp-like value", async () => {
      const config: FirestoreBigQueryEventHistoryTrackerConfig = {
        datasetId: "",
        tableId: "",
        datasetLocation: "",
        timePartitioning: "",
        timePartitioningField: "end_date",
        timePartitioningFieldType: "DATETIME",
        timePartitioningFirestoreField: "end_date",
        transformFunction: "",
        clustering: [],
        bqProjectId: null,
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

      const partitioning = new Partitioning(config, table);
      const value = partitioning.getPartitionValue(event);

      expect(value.end_date).toBeDefined();
    });

    test("returns an empty object when _seconds or _nanoseconds is not a number", async () => {
      const config: FirestoreBigQueryEventHistoryTrackerConfig = {
        datasetId: "",
        tableId: "",
        datasetLocation: "",
        timePartitioning: "",
        timePartitioningField: "end_date",
        timePartitioningFieldType: "DATETIME",
        timePartitioningFirestoreField: "end_date",
        transformFunction: "",
        clustering: [],
        bqProjectId: null,
      };

      // a Timestamp-Like object (we lose the instance after serialization)
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

      const partitioning = new Partitioning(config, table);
      const value = partitioning.getPartitionValue(event);

      expect(value).toEqual({});
    });

    test("returns a value when timePartitioningField and timePartitioningFirestoreField string value has been defined, and is timestamp-like", async () => {
      const config: FirestoreBigQueryEventHistoryTrackerConfig = {
        datasetId: "",
        tableId: "",
        datasetLocation: "",
        timePartitioning: "",
        timePartitioningField: "end_date",
        timePartitioningFieldType: "DATETIME",
        timePartitioningFirestoreField: "end_date",
        transformFunction: "",
        clustering: [],
        bqProjectId: null,
      };

      // a Timestamp-Like object (we lose the instance after serialization)
      const end_date = JSON.parse(
        JSON.stringify(admin.firestore.Timestamp.now())
      );

      const event: FirestoreDocumentChangeEvent = {
        timestamp: "",
        operation: ChangeType.CREATE,
        documentName: "",
        eventId: "",
        documentId: "",
        data: { end_date },
      };

      const partitioning = new Partitioning(config, table);
      const value = partitioning.getPartitionValue(event);

      expect(value.end_date).toBeDefined();
    });

    test("returns an empty object if timePartitioningFirestoreField has not been provided", async () => {
      const config: FirestoreBigQueryEventHistoryTrackerConfig = {
        datasetId: "",
        tableId: "",
        datasetLocation: "",
        timePartitioning: "DAY",
        timePartitioningField: "end_date",
        timePartitioningFieldType: "DATETIME",
        timePartitioningFirestoreField: null,
        transformFunction: "",
        clustering: [],
        bqProjectId: null,
      };

      const event: FirestoreDocumentChangeEvent = {
        timestamp: "",
        operation: ChangeType.CREATE,
        documentName: "",
        eventId: "",
        documentId: "",
        data: { end_date: "testing" },
      };

      const partitioning = new Partitioning(config, table);
      const value = partitioning.getPartitionValue(event);

      expect(value).toEqual({});
    });
    test("returns an empty object if timePartitioningFirestoreField has not been provided", async () => {
      const config: FirestoreBigQueryEventHistoryTrackerConfig = {
        datasetId: "",
        tableId: "",
        datasetLocation: "",
        timePartitioning: "DAY",
        timePartitioningField: "end_date",
        timePartitioningFieldType: "DATETIME",
        timePartitioningFirestoreField: null,
        transformFunction: "",
        clustering: [],
        bqProjectId: null,
      };

      const event: FirestoreDocumentChangeEvent = {
        timestamp: "",
        operation: ChangeType.CREATE,
        documentName: "",
        eventId: "",
        documentId: "",
        data: { end_date: "testing" },
      };

      const partitioning = new Partitioning(config, table);
      const value = partitioning.getPartitionValue(event);

      expect(value).toEqual({});
    });

    test("returns an empty object if timePartitioningFirestoreField timePartitioningField", async () => {
      const config: FirestoreBigQueryEventHistoryTrackerConfig = {
        datasetId: "",
        tableId: "",
        datasetLocation: "",
        timePartitioning: "DAY",
        timePartitioningField: "end_date",
        timePartitioningFieldType: "DATETIME",
        timePartitioningFirestoreField: "date_end",
        transformFunction: "",
        clustering: [],
        bqProjectId: null,
      };

      const event: FirestoreDocumentChangeEvent = {
        timestamp: "",
        operation: ChangeType.CREATE,
        documentName: "",
        eventId: "",
        documentId: "",
        data: { end_date: "testing" },
      };

      const partitioning = new Partitioning(config, table);
      const value = partitioning.getPartitionValue(event);

      expect(value).toEqual({});
    });

    test("returns an empty object if no event data has been provided", async () => {
      const config: FirestoreBigQueryEventHistoryTrackerConfig = {
        datasetId: "",
        tableId: "",
        datasetLocation: "",
        timePartitioning: "DAY",
        timePartitioningField: "end_date",
        timePartitioningFieldType: "DATETIME",
        timePartitioningFirestoreField: "end_date",
        transformFunction: "",
        clustering: [],
        bqProjectId: null,
      };

      const event: FirestoreDocumentChangeEvent = {
        timestamp: "",
        operation: ChangeType.CREATE,
        documentName: "",
        eventId: "",
        documentId: "",
        data: {},
      };

      const partitioning = new Partitioning(config, table);
      const value = partitioning.getPartitionValue(event);

      expect(value).toEqual({});
    });

    test("returns an empty object if a non string or Timestamp value is synced from Firestore", async () => {
      const config: FirestoreBigQueryEventHistoryTrackerConfig = {
        datasetId: "",
        tableId: "",
        datasetLocation: "",
        timePartitioning: "DAY",
        timePartitioningField: "end_date",
        timePartitioningFieldType: "DATETIME",
        timePartitioningFirestoreField: "end_date",
        transformFunction: "",
        clustering: [],
        bqProjectId: null,
      };

      const event: FirestoreDocumentChangeEvent = {
        timestamp: "",
        operation: ChangeType.CREATE,
        documentName: "",
        eventId: "",
        documentId: "",
        data: { end_date: 20 },
      };

      const partitioning = new Partitioning(config, table);
      const value = partitioning.getPartitionValue(event);

      expect(value).toEqual({});
    });
  });

  test("partition return false if table is not provided", async () => {
    const config: FirestoreBigQueryEventHistoryTrackerConfig = {
      datasetId: "",
      tableId: "",
      datasetLocation: "",
      timePartitioning: "HOUR",
      timePartitioningField: "end_date",
      timePartitioningFieldType: "DATETIME",
      timePartitioningFirestoreField: null,
      transformFunction: "",
      clustering: [],
      bqProjectId: process.env.PROJECT_ID,
    };

    const fields = [];

    const partitioning = new Partitioning(config);

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
  test("updates the table metadata with the timestamp field", async () => {
    const config: FirestoreBigQueryEventHistoryTrackerConfig = {
      datasetId: "",
      tableId: "",
      datasetLocation: "",
      timePartitioning: "MONTH",
      timePartitioningField: "timestamp",
      timePartitioningFieldType: undefined,
      timePartitioningFirestoreField: undefined,
      transformFunction: "",
      clustering: [],
      bqProjectId: null,
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
  test("Should not update if there is a custom option with the timestamp option", async () => {
    const config: FirestoreBigQueryEventHistoryTrackerConfig = {
      datasetId: "",
      tableId: "",
      datasetLocation: "",
      timePartitioning: "MONTH",
      timePartitioningField: "timestamp",
      timePartitioningFieldType: "DATETIME",
      timePartitioningFirestoreField: undefined,
      transformFunction: "",
      clustering: [],
      bqProjectId: null,
    };
    const options = {};

    const partitioning = new Partitioning(config, table);

    await partitioning.updateTableMetadata(options);

    expect(options).toEqual({});
  });
});
