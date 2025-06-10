import { BigQuery, Dataset, Table } from "@google-cloud/bigquery";
import { logger } from "firebase-functions";
import { ZodError } from "zod";

import {
  RawChangelogSchema,
  RawChangelogViewSchema,
} from "../../bigquery/schema";

import { FirestoreDocumentChangeEvent } from "../..";
import { latestConsistentSnapshotView } from "../../bigquery/snapshot";
import { deleteTable } from "../fixtures/clearTables";
import { changeTracker, changeTrackerEvent } from "../fixtures/changeTracker";
import { getBigQueryTableData } from "../fixtures/queries";
import { firestore } from "firebase-admin";

process.env.PROJECT_ID = "dev-extensions-testing";

// Mock logger to keep test output clean
jest.spyOn(logger, "log").mockImplementation();
jest.spyOn(logger, "info").mockImplementation();
jest.spyOn(logger, "warn").mockImplementation();
jest.spyOn(logger, "debug").mockImplementation();

const bq: BigQuery = new BigQuery({ projectId: process.env.PROJECT_ID });
const event: FirestoreDocumentChangeEvent = changeTrackerEvent({});
let randomID: string;
let datasetId: string;
let tableId: string;
let tableId_raw: string;
let dataset: Dataset;
let table: Table;
let view: Table;

describe("e2e", () => {
  describe("initialization", () => {
    beforeEach(() => {
      randomID = (Math.random() + 1).toString(36).substring(7);
      datasetId = `dataset_${randomID}`;
      tableId = `table_${randomID}`;
      tableId_raw = `${tableId}_raw_changelog`;
      dataset = bq.dataset(datasetId);
    });

    afterEach(async () => {
      await deleteTable({ datasetId });
    });

    test("successfully creates a dataset and table", async () => {
      await changeTracker({
        datasetId,
        tableId,
      }).record([event]);

      const [metadata] = await dataset.table(tableId_raw).getMetadata();
      expect(metadata).toBeDefined();
    });
  });

  describe("Partitioning", () => {
    beforeEach(() => {
      randomID = (Math.random() + 1).toString(36).substring(7);
      datasetId = `dataset_${randomID}`;
      tableId = `table_${randomID}`;
      tableId_raw = `${tableId}_raw_changelog`;
      dataset = bq.dataset(datasetId);
    });

    afterEach(async () => {
      await deleteTable({ datasetId });
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

      test("throws an error with an unrecognized timePartitioning option", async () => {
        const tracker = changeTracker({
          datasetId,
          tableId,
          timePartitioning: "UNKNOWN",
        } as any);

        // Assert that the constructor throws a ZodError
        await expect(tracker.record([event])).rejects.toThrow(ZodError);
      });

      test("successfully partitions a changelog table with a timePartitioning option only", async () => {
        await changeTracker({
          datasetId,
          tableId,
          timePartitioning: "HOUR",
        }).record([event]);

        const [metadata] = await dataset.table(tableId_raw).getMetadata();
        expect(metadata.timePartitioning).toBeDefined();
        expect(metadata.timePartitioning.type).toBe("HOUR");
      });

      test("successfully partitions with a valid Firebase Timestamp value and Date type", async () => {
        const created = firestore.Timestamp.now();
        const expectedDate = created.toDate().toISOString().substring(0, 10);
        const eventWithDate: FirestoreDocumentChangeEvent = changeTrackerEvent({
          data: { created },
        });

        await changeTracker({
          datasetId,
          tableId,
          timePartitioning: "DAY",
          timePartitioningColumn: "created",
          timePartitioningFieldType: "DATE",
          timePartitioningFirestoreField: "created",
        }).record([eventWithDate]);

        const [metadata] = await dataset.table(`${tableId_raw}`).getMetadata();
        const [changeLogRows] = await getBigQueryTableData(
          process.env.PROJECT_ID,
          datasetId,
          tableId
        );

        expect(metadata.timePartitioning).toBeDefined();
        expect(changeLogRows[0].created.value).toBe(expectedDate);
      });

      test("successfully partitions with a valid Firebase Timestamp value and DateTime type", async () => {
        const created = firestore.Timestamp.now();
        const eventWithDate: FirestoreDocumentChangeEvent = changeTrackerEvent({
          data: { created },
        });

        await changeTracker({
          datasetId,
          tableId,
          timePartitioning: "DAY",
          timePartitioningColumn: "created",
          timePartitioningFieldType: "DATETIME",
          timePartitioningFirestoreField: "created",
        }).record([eventWithDate]);

        const [metadata] = await dataset.table(`${tableId_raw}`).getMetadata();
        const [changeLogRows] = await getBigQueryTableData(
          process.env.PROJECT_ID,
          datasetId,
          tableId
        );

        expect(metadata.timePartitioning).toBeDefined();
        // Comparing substrings to avoid floating point differences in nanoseconds
        expect(changeLogRows[0].created.value.substring(0, 22)).toBe(
          BigQuery.datetime(created.toDate().toISOString()).value.substring(
            0,
            22
          )
        );
      });

      test("successfully partitions by ingestion time when timePartitioningColumn is 'timestamp'", async () => {
        await changeTracker({
          datasetId,
          tableId,
          timePartitioning: "DAY",
          timePartitioningColumn: "timestamp",
        }).record([event]);

        const [metadata] = await dataset.table(`${tableId_raw}`).getMetadata();
        expect(metadata.timePartitioning).toBeDefined();
        expect(metadata.timePartitioning.type).toEqual("DAY");
        expect(metadata.timePartitioning.field).toEqual("timestamp");
      });

      test("old_data is null if is not provided", async () => {
        const event: FirestoreDocumentChangeEvent = changeTrackerEvent({
          data: { foo: "foo" },
        });

        await changeTracker({ datasetId, tableId }).record([event]);

        const [changeLogRows] = await getBigQueryTableData(
          process.env.PROJECT_ID,
          datasetId,
          tableId
        );

        expect(changeLogRows[0].old_data).toBe(null);
      });

      test("changeLog table has a value for old_data", async () => {
        const event: FirestoreDocumentChangeEvent = changeTrackerEvent({
          oldData: { foo: "foo" },
          data: { foo: "bar" },
        });

        await changeTracker({ datasetId, tableId }).record([event]);

        const [changeLogRows] = await getBigQueryTableData(
          process.env.PROJECT_ID,
          datasetId,
          tableId
        );

        expect(changeLogRows[0].old_data).toBeDefined();
      });

      test("throws an error if timePartitioningColumn is null for field partitioning", async () => {
        const tracker = changeTracker({
          datasetId,
          tableId,
          timePartitioning: "HOUR",
          timePartitioningColumn: null,
          timePartitioningFieldType: "TIMESTAMP",
          timePartitioningFirestoreField: "end_date",
        });

        await expect(tracker.record([event])).rejects.toThrow(ZodError);
      });

      test("throws an error if timePartitioningFieldType is missing for field partitioning", async () => {
        const tracker = changeTracker({
          datasetId,
          tableId,
          timePartitioning: "HOUR",
          timePartitioningColumn: "endDate",
          timePartitioningFirestoreField: "end_date",
        });
        await expect(tracker.record([event])).rejects.toThrow(ZodError);
      });

      test("throws an error if timePartitioningFirestoreField is missing for field partitioning", async () => {
        const tracker = changeTracker({
          datasetId,
          tableId,
          timePartitioning: "HOUR",
          timePartitioningColumn: "endDate",
          timePartitioningFieldType: "TIMESTAMP",
        });
        await expect(tracker.record([event])).rejects.toThrow(ZodError);
      });

      test("Should not partition when timePartitioning is HOUR for a DATE field", async () => {
        // This combination is valid at construction but blocked by logic during table creation.
        await changeTracker({
          datasetId,
          tableId,
          timePartitioning: "HOUR",
          timePartitioningColumn: "endDate",
          timePartitioningFieldType: "DATE",
          timePartitioningFirestoreField: "end_date",
        }).record([event]);

        const [metadata] = await dataset.table(tableId_raw).getMetadata();
        // The table gets created, but without the partitioning metadata.
        expect(metadata.timePartitioning).toBeUndefined();
      });
    });

    describe("a pre existing dataset, table and view", () => {
      beforeEach(async () => {
        [dataset] = await bq.dataset(datasetId).create();
        [table] = await dataset.createTable(tableId_raw, {
          schema: RawChangelogSchema,
        });

        const latestSnapshot = latestConsistentSnapshotView({
          datasetId,
          tableName: tableId_raw,
          schema: RawChangelogViewSchema,
          useLegacyQuery: false,
        });

        [view] = await dataset.createTable(`${tableId}_raw_latest`, {
          view: latestSnapshot,
        });
      });

      test("does not add ingestion-time partitioning to an existing table", async () => {
        await changeTracker({
          datasetId,
          tableId,
          timePartitioning: "HOUR",
        }).record([event]);

        const [metadata] = await dataset.table(tableId_raw).getMetadata();
        // Partitioning should not be added to an existing table this way
        expect(metadata.timePartitioning).toBeUndefined();
      });

      test("does not add field partitioning to an existing table", async () => {
        await changeTracker({
          datasetId,
          tableId,
          timePartitioning: "HOUR",
          timePartitioningColumn: "endDate",
          timePartitioningFieldType: "DATE",
          timePartitioningFirestoreField: "end_date",
        }).record([event]);

        const [metadata] = await dataset.table(tableId_raw).getMetadata();
        // Partitioning should not be added to an existing table
        expect(metadata.timePartitioning).toBeUndefined();
      });

      test("does not add a custom partitioning column if the column already exists", async () => {
        // Add a custom field to the table.
        const [metaData] = await table.getMetadata();
        metaData.schema.fields.push({
          name: "custom_field",
          mode: "NULLABLE",
          type: "DATE",
        });
        await table.setMetadata(metaData);

        // This should not throw, but it also should not modify the schema again.
        await changeTracker({
          datasetId,
          tableId,
          timePartitioning: "DAY",
          timePartitioningColumn: "custom_field",
          timePartitioningFieldType: "DATE",
          timePartitioningFirestoreField: "custom_field",
        }).record([event]);

        const [metadata] = await dataset.table(tableId_raw).getMetadata();
        // The table still should not be partitioned, and the field count remains 1.
        expect(metadata.timePartitioning).toBeUndefined();
        expect(
          metadata.schema.fields.filter(
            (field) => field.name === "custom_field"
          ).length
        ).toBe(1);
      });
    });
  });

  describe("SQL opt-in", () => {
    let view_raw_latest;
    beforeEach(() => {
      randomID = (Math.random() + 1).toString(36).substring(7);
      datasetId = `dataset_${randomID}`;
      tableId = `table_${randomID}`;
      view_raw_latest = `${tableId}_raw_latest`;
      dataset = bq.dataset(datasetId);
    });

    afterEach(async () => {
      await deleteTable({
        datasetId,
      });
    });
    test("successfully updates the view if opt-in is selected and the current query is a legacy query ", async () => {
      let legacyView: Table;
      let optimisedView: Table;

      /** Get legacy view */
      const legacyEvent: FirestoreDocumentChangeEvent = changeTrackerEvent({
        data: { test: "one" },
        eventId: "one",
      });

      await changeTracker({
        datasetId,
        tableId,
        useNewSnapshotQuerySyntax: false,
      }).record([legacyEvent]);

      legacyView = dataset.table(view_raw_latest);
      const [legacyViewMetadata] = await legacyView.getMetadata();

      /** Get legacy view */
      const optimizedEvent: FirestoreDocumentChangeEvent = changeTrackerEvent({
        data: { test: "two" },
        eventId: "two",
      });

      /** Get optimised view */
      await changeTracker({
        datasetId,
        tableId,
        useNewSnapshotQuerySyntax: true,
      }).record([optimizedEvent]);

      optimisedView = dataset.table(view_raw_latest);
      const [optimisedViewMetadata] = await optimisedView.getMetadata();

      /** Create SQL jobs */
      const [legacyDataJob] = await legacyView.createQueryJob(
        legacyViewMetadata.view.query
      );

      const [optimisedDataJob] = await optimisedView.createQueryJob(
        optimisedViewMetadata.view.query
      );

      /** Assertions */
      const [legacyData] = await legacyDataJob.getQueryResults();
      const [optimisedData] = await optimisedDataJob.getQueryResults();

      expect(legacyData.length).toEqual(optimisedData.length);

      expect(legacyData[0]).toEqual(optimisedData[0]);

      expect(legacyViewMetadata.view.query.includes("FIRST_VALUE")).toBe(true);

      expect(optimisedViewMetadata.view.query.includes("FIRST_VALUE")).toBe(
        false
      );
    });
  });

  describe("old data field", () => {
    let table_raw_changelog;
    beforeEach(() => {
      randomID = (Math.random() + 1).toString(36).substring(7);
      datasetId = `dataset_${randomID}`;
      tableId = `${randomID}`;
      table_raw_changelog = `${tableId}_raw_changelog`;
      dataset = bq.dataset(datasetId);
    });

    afterEach(async () => {
      await deleteTable({
        datasetId,
      });
    });
    test("successfully adds old data field if it does not yet exist", async () => {
      /** Create a table without an old_data column */
      const schema = [{ name: "Name", type: "STRING" }];

      const [originalRawTable] = await dataset.createTable(
        table_raw_changelog,
        {
          schema,
        }
      );

      expect(
        originalRawTable.metadata.schema.fields.filter(
          ($) => $.name === "old_data"
        ).length
      ).toBe(0);

      await changeTracker({ datasetId, tableId }).record([event]);

      const [metadata] = await dataset.table(table_raw_changelog).getMetadata();

      /** Assertions */
      expect(
        metadata.schema.fields.filter(($) => $.name === "old_data").length
      ).toBe(1);
    });
  });
});
