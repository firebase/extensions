import { BigQuery, Dataset, Table } from "@google-cloud/bigquery";
const { logger } = require("firebase-functions");

import {
  RawChangelogSchema,
  RawChangelogViewSchema,
} from "../../bigquery/schema";

import { FirestoreDocumentChangeEvent } from "../..";
import { latestConsistentSnapshotView } from "../../bigquery/snapshot";
import { deleteTable } from "../fixtures/clearTables";
import { changeTracker, changeTrackerEvent } from "../fixtures/changeTracker";

process.env.PROJECT_ID = "extensions-testing";

const consoleLogSpy = jest.spyOn(logger, "log").mockImplementation();
const consoleLogSpyWarn = jest.spyOn(logger, "warn").mockImplementation();

const bq: BigQuery = new BigQuery();
const event: FirestoreDocumentChangeEvent = changeTrackerEvent({});
let randomID: string;
let datasetId: string;
let tableId: string;
let tableId_raw: string;
let dataset: Dataset;
let table: Table;
let view: Table;

describe("Partitioning", () => {
  beforeEach(async () => {
    randomID = (Math.random() + 1).toString(36).substring(7);
    datasetId = `dataset_${randomID}`;
    tableId = `table_${randomID}`;
    tableId_raw = `${tableId}_raw_changelog`;
    dataset = bq.dataset(datasetId);
  });

  afterEach(async () => {
    await deleteTable({
      datasetId,
    });
  });

  describe("a non existing dataset and table", () => {
    test("does not partition without a defined timePartitioning option", async () => {
      await changeTracker({
        datasetId,
        tableId,
      }).record([event]);

      const [metadata] = await dataset.table(tableId_raw).getMetadata();

      expect(metadata.timePartitioning).toBeUndefined();
    });

    test("does not partition with an unrecognized timePartitioning option", async () => {
      await changeTracker({
        datasetId,
        tableId,
        timePartitioning: "UNKNOWN",
      }).record([event]);

      const [metadata] = await dataset.table(tableId_raw).getMetadata();

      expect(metadata.timePartitioning).toBeUndefined();
    });

    test("successfully partitions a changelog table with a timePartitioning option only", async () => {
      await changeTracker({
        datasetId,
        tableId,
        timePartitioning: "HOUR",
      }).record([event]);

      const [metadata] = await dataset.table(tableId_raw).getMetadata();

      expect(metadata.timePartitioning).toBeDefined();
    });

    test("successfully partitions latest view table with a timePartitioning option only", async () => {
      await changeTracker({
        datasetId,
        tableId,
        timePartitioning: "HOUR",
      }).record([event]);

      const [metadata] = await dataset
        .table(`${tableId}_raw_latest`)
        .getMetadata();

      expect(metadata.timePartitioning).toBeDefined();
    });

    test("does not partition with without a valid timePartitioningField when including timePartitioning, timePartitioningFieldType and timePartitioningFirestoreField", async () => {
      await changeTracker({
        datasetId,
        tableId,
        timePartitioning: "HOUR",
        timePartitioningField: null,
        timePartitioningFieldType: "TIMESTAMP",
        timePartitioningFirestoreField: "end_date",
      }).record([event]);

      const [metadata] = await dataset.table(tableId_raw).getMetadata();

      expect(metadata.timePartitioning).toBeUndefined();
    });

    test("does not partition with without a valid timePartitioningFieldType", async () => {
      await changeTracker({
        datasetId,
        tableId,
        timePartitioning: "HOUR",
        timePartitioningField: "endDate",
        timePartitioningFirestoreField: "end_date",
      }).record([event]);

      const [metadata] = await dataset.table(tableId_raw).getMetadata();

      expect(metadata.timePartitioning).toBeUndefined();
    });

    test("does not partition with an unknown timePartitioningFieldType", async () => {
      await changeTracker({
        datasetId,
        tableId,
        timePartitioning: "HOUR",
        timePartitioningField: "endDate",
        timePartitioningFieldType: "unknown",
        timePartitioningFirestoreField: "end_date",
      }).record([event]);

      const [metadata] = await dataset.table(tableId_raw).getMetadata();

      expect(metadata.timePartitioning).toBeUndefined();
    });

    test("does not partition with an unknown timePartitioningFirestoreField", async () => {
      await changeTracker({
        datasetId,
        tableId,
        timePartitioning: "HOUR",
        timePartitioningField: "endDate",
        timePartitioningFieldType: "TIMESTAMP",
        // timePartitioningFirestoreField: "unknown",
      }).record([event]);

      const [metadata] = await dataset.table(tableId_raw).getMetadata();

      expect(metadata.timePartitioning).toBeUndefined();
    });

    test("Should not partition when timePartitioningFieldType is a DATE type HOUR has been set as timePartitioning field", async () => {
      await changeTracker({
        datasetId,
        tableId,
        timePartitioning: "HOUR",
        timePartitioningField: "endDate",
        timePartitioningFieldType: "DATE",
        timePartitioningFirestoreField: "end_date",
      }).record([event]);

      const [metadata] = await dataset.table(tableId_raw).getMetadata();

      expect(metadata.timePartitioning).toBeUndefined();
    });
  });

  describe("a pre existing dataset, table and view", () => {
    beforeEach(async () => {
      [dataset] = await bq.dataset(datasetId).create();
      [table] = await dataset.createTable(tableId_raw, {
        schema: RawChangelogSchema,
      });

      const latestSnapshot = latestConsistentSnapshotView(
        datasetId,
        tableId_raw,
        RawChangelogViewSchema
      );

      [view] = await dataset.createTable(`${tableId}_raw_latest`, {
        view: latestSnapshot,
      });
    });

    test("does not update an existing non partitioned table, that has a valid schema with timePartitioning only", async () => {
      await changeTracker({
        datasetId,
        tableId,
        timePartitioning: "HOUR",
      }).record([event]);

      const [metadata] = await dataset.table(tableId_raw).getMetadata();

      expect(metadata.timePartitioning).toBeUndefined();

      expect(consoleLogSpyWarn).toBeCalledWith(
        `Cannot partition an existing table ${datasetId}_${tableId_raw}`
      );
      expect(consoleLogSpyWarn).toBeCalledWith(
        `Cannot partition an existing table ${datasetId}_${tableId}_raw_latest`
      );
      expect(consoleLogSpy).toBeCalledWith(
        `BigQuery dataset already exists: ${datasetId}`
      );
      expect(consoleLogSpy).toBeCalledWith(
        `BigQuery table with name ${tableId_raw} already exists in dataset ${datasetId}!`
      );
      expect(consoleLogSpy).toBeCalledWith(
        `View with id ${tableId}_raw_latest already exists in dataset ${datasetId}.`
      );
    });

    test("does not update an existing non partitioned table, that has valid custom partitioning configuration", async () => {
      await changeTracker({
        datasetId,
        tableId,
        timePartitioning: "HOUR",
        timePartitioningField: "endDate",
        timePartitioningFieldType: "DATE",
        timePartitioningFirestoreField: "end_date",
      }).record([event]);

      const [metadata] = await dataset.table(tableId_raw).getMetadata();

      expect(metadata.timePartitioning).toBeUndefined();
    });

    test("does not update add a custom partitioning column when the relevant partitioning exists", async () => {
      await changeTracker({
        datasetId,
        tableId,
        timePartitioning: "HOUR",
        timePartitioningField: "endDate",
        timePartitioningFieldType: "DATE",
        timePartitioningFirestoreField: "end_date",
      }).record([event]);

      const [metadata] = await dataset.table(tableId_raw).getMetadata();

      expect(
        metadata.schema.fields.filter(($) => $.name === "endDate").length
      ).toBe(0);

      expect(metadata.timePartitioning).toBeUndefined();
    });

    test("does not add an additional custom when the field column already exists", async () => {
      // Add a custom field to the table.
      const [metaData] = await table.getMetadata();

      metaData.schema.fields.push({
        name: "custom_field",
        mode: "NULLABLE",
        type: "Date",
        description: "example custom field",
      });

      await table.setMetadata(metaData);

      await changeTracker({
        datasetId,
        tableId,
        timePartitioning: "DAY",
        timePartitioningField: "custom_field",
        timePartitioningFieldType: "DATE",
        timePartitioningFirestoreField: "custom_field",
      }).record([event]);

      const [metadata] = await dataset.table(tableId_raw).getMetadata();

      expect(
        metadata.schema.fields.filter(($) => $.name === "custom_field").length
      ).toBe(1);
    });
  });
});
