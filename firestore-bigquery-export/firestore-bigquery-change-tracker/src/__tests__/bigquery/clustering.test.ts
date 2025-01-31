import { BigQuery, Dataset, Table } from "@google-cloud/bigquery";
import { FirestoreDocumentChangeEvent } from "../..";
import { RawChangelogSchema } from "../../bigquery/schema";
import { changeTracker, changeTrackerEvent } from "../fixtures/changeTracker";
import { deleteTable } from "../fixtures/clearTables";

process.env.PROJECT_ID = "dev-extensions-testing";

const bq: BigQuery = new BigQuery({ projectId: process.env.PROJECT_ID });
const event: FirestoreDocumentChangeEvent = changeTrackerEvent({});
let randomID: string;
let datasetId: string;
let tableId: string;
let tableId_raw: string;
let myTable: Table;
let myDataset: Dataset;

const { logger } = require("firebase-functions");

const consoleLogSpy = jest.spyOn(logger, "log").mockImplementation();
const consoleWarnSpy = jest.spyOn(logger, "warn").mockImplementation();

describe("Clustering ", () => {
  beforeEach(() => {
    randomID = (Math.random() + 1).toString(36).substring(7);
    datasetId = `dataset_${randomID}`;
    tableId = `table_${randomID}`;
    tableId_raw = `${tableId}_raw_changelog`;
  });

  afterEach(async () => {
    await deleteTable({
      datasetId,
    });
  });

  describe("without an existing table", () => {
    test("does not error when an empty array of options are provided", async () => {
      await changeTracker({
        datasetId,
        tableId,
        clustering: [],
      }).record([event]);

      const raw_changelog_table = bq.dataset(datasetId).table(tableId_raw);

      const [changeLogMetaData] = await raw_changelog_table.getMetadata();

      expect(changeLogMetaData.clustering).toBeUndefined();

      expect(consoleLogSpy).toBeCalledWith(
        `Creating BigQuery table: ${raw_changelog_table.id}`
      );
    });

    test("does not error when an null clustering option has been provided", async () => {
      await changeTracker({
        datasetId,
        tableId,
        clustering: null,
      }).record([event]);

      const [metadata] = await bq
        .dataset(datasetId)
        .table(tableId_raw)
        .getMetadata();

      expect(metadata.clustering).toBeUndefined();
    });

    test("successfully adds clustering with an existing schema field", async () => {
      await changeTracker({
        datasetId,
        tableId,
        clustering: ["timestamp"],
      }).record([event]);

      const [metadata] = await bq
        .dataset(datasetId)
        .table(tableId_raw)
        .getMetadata();

      expect(metadata.clustering).toBeDefined();
      expect(metadata.clustering.fields.length).toBe(1);
      expect(metadata.clustering.fields[0]).toBe("timestamp");
    });

    test("successfully adds clustering on a currently partitioned imported Firestore field", async () => {
      await changeTracker({
        datasetId,
        tableId,
        timePartitioning: "DAY",
        timePartitioningField: "end_date",
        timePartitioningFieldType: "TIMESTAMP",
        timePartitioningFirestoreField: "endDate",
        clustering: ["end_date"],
      }).record([event]);

      const [metadata] = await bq
        .dataset(datasetId)
        .table(tableId_raw)
        .getMetadata();

      expect(metadata.clustering).toBeDefined();
      expect(metadata.clustering.fields.length).toBe(1);
      expect(metadata.clustering.fields[0]).toBe("end_date");
    });
  });

  describe("with existing table", () => {
    beforeEach(async () => {
      [myDataset] = await bq.dataset(datasetId).create();
    });

    //TODO: Consider what happens to a partitioned able that was created without a schema, can we add clustering?
    test.skip("successfully adds clustering with a table that has already been partitioned without schema", async () => {
      [myTable] = await myDataset.createTable(tableId_raw, {
        timePartitioning: { type: "HOUR" },
      });

      await changeTracker({
        datasetId,
        tableId,
        clustering: ["timestamp"],
      }).record([event]);

      const [metadata] = await myDataset.table(tableId_raw).getMetadata();

      expect(metadata.clustering).toBeDefined();
    });

    test("successfully adds clustering with a table that has already been partitioned with schema", async () => {
      [myTable] = await myDataset.createTable(tableId_raw, {
        timePartitioning: { type: "HOUR" },
        schema: RawChangelogSchema,
      });

      await changeTracker({
        datasetId,
        tableId,
        clustering: ["timestamp"],
      }).record([event]);

      const [metadata] = await myDataset.table(tableId_raw).getMetadata();

      expect(metadata.clustering).toBeDefined();
    });

    test("delete clustering from partitioned table", async () => {
      [myTable] = await myDataset.createTable(tableId_raw, {
        timePartitioning: { type: "HOUR" },
        schema: RawChangelogSchema,
        clustering: { fields: ["timestamp", "data"] },
      });
      await changeTracker({
        datasetId,
        tableId,
        clustering: null,
      }).record([event]);

      const [metadata] = await myDataset.table(tableId_raw).getMetadata();

      expect(metadata.clustering).toBeUndefined();
    });

    test("update clustering with different fields for partitioned table", async () => {
      [myTable] = await myDataset.createTable(tableId_raw, {
        timePartitioning: { type: "HOUR" },
        schema: RawChangelogSchema,
        clustering: { fields: ["timestamp", "document_id"] },
      });

      await changeTracker({
        datasetId,
        tableId,
        clustering: ["data"],
      }).record([event]);

      const [metadata] = await myDataset.table(tableId_raw).getMetadata();

      expect(metadata.clustering).toBeDefined();
      expect(metadata.clustering.fields.length).toBe(1);
      expect(metadata.clustering.fields[0]).toBe("data");
    });

    test("update clustering with the same values and length but different order for partitioned table", async () => {
      [myTable] = await myDataset.createTable(tableId_raw, {
        timePartitioning: { type: "HOUR" },
        schema: RawChangelogSchema,
        clustering: { fields: ["timestamp", "document_id"] },
      });

      await changeTracker({
        datasetId,
        tableId,
        clustering: ["document_id", "timestamp"],
      }).record([event]);

      const [metadata] = await myDataset.table(tableId_raw).getMetadata();

      expect(metadata.clustering).toBeDefined();
      expect(metadata.clustering.fields.length).toBe(2);
      expect(metadata.clustering.fields[0]).toBe("document_id");
    });

    test("update clustering with different values for unpartitioned table", async () => {
      [myTable] = await myDataset.createTable(tableId_raw, {
        schema: RawChangelogSchema,
        clustering: { fields: ["timestamp", "document_id"] },
      });

      await changeTracker({
        datasetId,
        tableId,
        clustering: ["data"],
      }).record([event]);

      const [metadata] = await myDataset.table(tableId_raw).getMetadata();

      expect(metadata.clustering).toBeDefined();
      expect(metadata.clustering.fields.length).toBe(1);
      expect(metadata.clustering.fields[0]).toBe("data");
    });

    test("delete clustering with different values for unpartitioned table", async () => {
      [myTable] = await myDataset.createTable(tableId_raw, {
        schema: RawChangelogSchema,
        clustering: { fields: ["timestamp", "document_id"] },
      });

      await changeTracker({
        datasetId,
        tableId,
        clustering: null,
      }).record([event]);

      const [metadata] = await myDataset.table(tableId_raw).getMetadata();

      expect(metadata.clustering).toBeUndefined();
    });

    test("successfully adds clustering on a non default schema field", async () => {
      [myTable] = await myDataset.createTable(tableId_raw, {
        schema: {
          fields: [
            ...RawChangelogSchema.fields,
            {
              name: "custom",
              mode: "NULLABLE",
              type: "STRING",
              description: "Custom field",
            },
          ],
        },
      });

      await changeTracker({
        datasetId,
        tableId,
        clustering: ["custom"],
      }).record([event]);

      const [metadata] = await myDataset.table(tableId_raw).getMetadata();

      expect(metadata.clustering.fields[0]).toBe("custom");
    });

    test("keeps existing clustering and warns the user when an invalid field has been provided", async () => {
      [myTable] = await myDataset.createTable(tableId_raw, {
        schema: {
          fields: [...RawChangelogSchema.fields],
        },
        clustering: { fields: ["data", "timestamp"] },
      });

      await changeTracker({
        datasetId,
        tableId,
        clustering: ["data", "unknown", "timestamp"],
      }).record([event]);

      const [metadata] = await myDataset.table(tableId_raw).getMetadata();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Unable to add clustering, field(s) unknown do not exist on the expected table"
      );

      expect(metadata.clustering.fields[0]).toBe("data");
      expect(metadata.clustering.fields[1]).toBe("timestamp");
    });

    test("does not add clustering and warns the user when an invalid field has been provided when clustering does exist", async () => {
      [myTable] = await myDataset.createTable(tableId_raw, {
        schema: {
          fields: [...RawChangelogSchema.fields],
        },
      });

      await changeTracker({
        datasetId,
        tableId,
        clustering: ["data,unknown,timestamp"],
      }).record([event]);

      const [metadata] = await myDataset.table(tableId_raw).getMetadata();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Unable to add clustering, field(s) data,unknown,timestamp do not exist on the expected table"
      );
      expect(metadata.clustering).toBeUndefined();
    });

    test("does not add clustering and warns the user when an invalid type has been provided", async () => {
      const schema = {
        fields: [
          ...RawChangelogSchema.fields,
          {
            name: "custom",
            mode: "NULLABLE",
            type: "JSON",
            description: "Custom field",
          },
        ],
      };

      [myTable] = await myDataset.createTable(tableId_raw, {
        schema,
      });

      await changeTracker({
        datasetId,
        tableId,
        clustering: ["custom"],
      }).record([event]);

      const [metadata] = await myDataset.table(tableId_raw).getMetadata();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Unable to add clustering, field(s) custom (JSON) have invalid types."
      );
      expect(metadata.clustering).toBeUndefined();
    });
  });
});
