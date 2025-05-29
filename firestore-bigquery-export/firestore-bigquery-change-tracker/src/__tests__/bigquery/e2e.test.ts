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
import { getBigQueryTableData } from "../fixtures/queries";
import { firestore } from "firebase-admin";

process.env.PROJECT_ID = "dev-extensions-testing";

const consoleLogSpy = jest.spyOn(logger, "log").mockImplementation();
const consoleInfoSpy = jest.spyOn(logger, "info").mockImplementation();
const consoleLogSpyWarn = jest.spyOn(logger, "warn").mockImplementation();
const consoleDebugSpy = jest.spyOn(logger, "debug").mockImplementation();

const bq: BigQuery = new BigQuery({ projectId: process.env.PROJECT_ID });
const event: FirestoreDocumentChangeEvent = changeTrackerEvent({});
let randomID: string;
let datasetId: string;
let tableId: string;
let tableId_raw: string;
let dataset: Dataset;
let table: Table;
let view: Table;

describe("BigQuery Change Tracker E2E", () => {
  describe("Basic Setup and Initialization", () => {
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

    test("should create dataset and table successfully", async () => {
      await changeTracker({
        datasetId,
        tableId,
      }).record([event]);

      const [metadata] = await dataset.table(tableId_raw).getMetadata();
      expect(metadata).toBeDefined();
    });
  });

  describe("Time Partitioning Configuration", () => {
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

    describe("New Dataset and Table Creation", () => {
      describe("Basic Partitioning Options", () => {
        test("should not partition when timePartitioning is not defined", async () => {
          await changeTracker({
            datasetId,
            tableId,
          }).record([event]);

          const [metadata] = await dataset.table(tableId_raw).getMetadata();
          expect(metadata.timePartitioning).toBeUndefined();
        });

        test("should not partition with unrecognized timePartitioning option", async () => {
          await changeTracker({
            datasetId,
            tableId,
            timePartitioning: "UNKNOWN",
          }).record([event]);

          const [metadata] = await dataset.table(tableId_raw).getMetadata();
          expect(metadata.timePartitioning).toBeUndefined();
        });

        test("should partition with HOUR timePartitioning", async () => {
          await changeTracker({
            datasetId,
            tableId,
            timePartitioning: "HOUR",
          }).record([event]);

          const [metadata] = await dataset.table(tableId_raw).getMetadata();
          expect(metadata.timePartitioning).toBeDefined();
        });

        test("should partition with DAY timePartitioning", async () => {
          await changeTracker({
            datasetId,
            tableId,
            timePartitioning: "DAY",
          }).record([event]);

          const [metadata] = await dataset.table(`${tableId_raw}`).getMetadata();
          expect(metadata.timePartitioning).toBeDefined();
        });

        test("should partition with MONTH timePartitioning", async () => {
          await changeTracker({
            datasetId,
            tableId,
            timePartitioning: "MONTH",
          }).record([event]);

          const [metadata] = await dataset.table(`${tableId_raw}`).getMetadata();
          expect(metadata.timePartitioning).toBeDefined();
        });

        test("should partition with YEAR timePartitioning", async () => {
          await changeTracker({
            datasetId,
            tableId,
            timePartitioning: "YEAR",
          }).record([event]);

          const [metadata] = await dataset.table(`${tableId_raw}`).getMetadata();
          expect(metadata.timePartitioning).toBeDefined();
        });

        test("should not partition with NONE timePartitioning", async () => {
          await changeTracker({
            datasetId,
            tableId,
            timePartitioning: "NONE",
          }).record([event]);

          const [metadata] = await dataset.table(`${tableId_raw}`).getMetadata();
          expect(metadata.timePartitioning).toBeUndefined();
        });
      });

      describe("Partitioning Field Configuration", () => {
        test("should partition with timestamp field and DAY partitioning", async () => {
          await changeTracker({
            datasetId,
            tableId,
            timePartitioning: "DAY",
            timePartitioningField: "timestamp",
          }).record([event]);

          const [metadata] = await dataset.table(`${tableId_raw}`).getMetadata();
          expect(metadata.timePartitioning).toBeDefined();
        });

        test("should partition with created field and DAY partitioning", async () => {
          await changeTracker({
            datasetId,
            tableId,
            timePartitioning: "DAY",
            timePartitioningField: "created",
          }).record([event]);

          const [metadata] = await dataset.table(`${tableId_raw}`).getMetadata();
          expect(metadata.timePartitioning).toBeDefined();
        });

        test("should partition with TIMESTAMP field type", async () => {
          await changeTracker({
            datasetId,
            tableId,
            timePartitioning: "DAY",
            timePartitioningField: "created",
            timePartitioningFieldType: "TIMESTAMP",
          }).record([event]);

          const [metadata] = await dataset.table(`${tableId_raw}`).getMetadata();
          expect(metadata.timePartitioning).toBeDefined();
        });

        test("should partition with DATE field type", async () => {
          await changeTracker({
            datasetId,
            tableId,
            timePartitioning: "DAY",
            timePartitioningField: "created",
            timePartitioningFieldType: "DATE",
          }).record([event]);

          const [metadata] = await dataset.table(`${tableId_raw}`).getMetadata();
          expect(metadata.timePartitioning).toBeDefined();
        });

        test("should partition with DATETIME field type", async () => {
          await changeTracker({
            datasetId,
            tableId,
            timePartitioning: "DAY",
            timePartitioningField: "created",
            timePartitioningFieldType: "DATETIME",
          }).record([event]);

          const [metadata] = await dataset.table(`${tableId_raw}`).getMetadata();
          expect(metadata.timePartitioning).toBeDefined();
        });
      });

      describe("Timestamp Handling", () => {
        test("should handle DateTime Timestamp correctly", async () => {
          const created = firestore.Timestamp.now();
          const event: FirestoreDocumentChangeEvent = changeTrackerEvent({
            data: { created },
          });

          await changeTracker({
            datasetId,
            tableId,
            timePartitioning: "DAY",
            timePartitioningField: "timestamp",
            timePartitioningFieldType: "TIMESTAMP",
            timePartitioningFirestoreField: "created",
          }).record([event]);

          const [metadata] = await dataset.table(`${tableId_raw}`).getMetadata();
          expect(metadata.timePartitioning).toBeDefined();

          const [changeLogRows] = await getBigQueryTableData(
            process.env.PROJECT_ID,
            datasetId,
            tableId
          );

          expect(changeLogRows[0].timestamp.value).toBe(
            BigQuery.timestamp(created.toDate()).value
          );
        });

        test("should handle DateTime Timestamp Date correctly", async () => {
          const created = firestore.Timestamp.now().toDate();
          const event: FirestoreDocumentChangeEvent = changeTrackerEvent({
            data: { created },
          });

          await changeTracker({
            datasetId,
            tableId,
            timePartitioning: "DAY",
            timePartitioningField: "created",
            timePartitioningFieldType: "TIMESTAMP",
            timePartitioningFirestoreField: "created",
          }).record([event]);

          const [metadata] = await dataset.table(`${tableId_raw}`).getMetadata();
          const [changeLogRows] = await getBigQueryTableData(
            process.env.PROJECT_ID,
            datasetId,
            tableId
          );

          expect(metadata.timePartitioning).toBeDefined();
          expect(changeLogRows[0].created.value).toBe(
            BigQuery.timestamp(created).value
          );
        });

        test("should handle Firebase Timestamp with TIMESTAMP type", async () => {
          const created = firestore.Timestamp.now();
          const event: FirestoreDocumentChangeEvent = changeTrackerEvent({
            data: { created },
          });

          await changeTracker({
            datasetId,
            tableId,
            timePartitioning: "DAY",
            timePartitioningField: "created",
            timePartitioningFieldType: "TIMESTAMP",
            timePartitioningFirestoreField: "created",
          }).record([event]);

          const [metadata] = await dataset.table(`${tableId_raw}`).getMetadata();
          const [changeLogRows] = await getBigQueryTableData(
            process.env.PROJECT_ID,
            datasetId,
            tableId
          );

          expect(metadata.timePartitioning).toBeDefined();
          expect(changeLogRows[0].created.value).toBe(
            BigQuery.timestamp(created.toDate()).value
          );
        });

        test("should handle Firebase Timestamp with DATE type", async () => {
          const created = firestore.Timestamp.now();
          const expectedDate = created.toDate().toISOString().substring(0, 10);
          const event: FirestoreDocumentChangeEvent = changeTrackerEvent({
            data: { created },
          });

          await changeTracker({
            datasetId,
            tableId,
            timePartitioning: "DAY",
            timePartitioningField: "created",
            timePartitioningFieldType: "DATE",
            timePartitioningFirestoreField: "created",
          }).record([event]);

          const [metadata] = await dataset.table(`${tableId_raw}`).getMetadata();
          const [changeLogRows] = await getBigQueryTableData(
            process.env.PROJECT_ID,
            datasetId,
            tableId
          );

          expect(metadata.timePartitioning).toBeDefined();
          expect(changeLogRows[0].created.value).toBe(expectedDate);
        });

        test("should handle Firebase Timestamp with DATETIME type", async () => {
          const created = firestore.Timestamp.now();
          const expectedDate = created.toDate().toISOString().substring(0, 22);
          const event: FirestoreDocumentChangeEvent = changeTrackerEvent({
            data: { created },
          });

          await changeTracker({
            datasetId,
            tableId,
            timePartitioning: "DAY",
            timePartitioningField: "created",
            timePartitioningFieldType: "DATETIME",
            timePartitioningFirestoreField: "created",
          }).record([event]);

          const [metadata] = await dataset.table(`${tableId_raw}`).getMetadata();
          const [changeLogRows] = await getBigQueryTableData(
            process.env.PROJECT_ID,
            datasetId,
            tableId
          );

          expect(metadata.timePartitioning).toBeDefined();
          expect(changeLogRows[0].created.value.substring(0, 22)).toBe(expectedDate);
        });
      });

      describe("Invalid Partitioning Configurations", () => {
        test("should not partition with missing timePartitioningField", async () => {
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

        test("should not partition with missing timePartitioningFieldType", async () => {
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

        test("should not partition with unknown timePartitioningFieldType", async () => {
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

        test("should not partition with missing timePartitioningFirestoreField", async () => {
          await changeTracker({
            datasetId,
            tableId,
            timePartitioning: "HOUR",
            timePartitioningField: "endDate",
            timePartitioningFieldType: "TIMESTAMP",
          }).record([event]);

          const [metadata] = await dataset.table(tableId_raw).getMetadata();
          expect(metadata.timePartitioning).toBeUndefined();
        });

        test("should not partition with DATE type and HOUR partitioning", async () => {
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
    });

    describe("Existing Dataset and Table Handling", () => {
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

      test("should not update existing non-partitioned table with timePartitioning only", async () => {
        const tableExists = await dataset.table(tableId_raw).exists();
        expect(tableExists[0]).toBe(true);

        await changeTracker({
          datasetId,
          tableId,
          timePartitioning: "HOUR",
        }).record([event]);

        const [metadata] = await dataset.table(tableId_raw).getMetadata();
        expect(metadata.timePartitioning).toBeUndefined();

        expect(consoleLogSpyWarn).toHaveBeenCalledWith(
          `Did not add partitioning to schema: Partition field not provided`
        );
        expect(consoleInfoSpy).toHaveBeenCalledWith(
          `BigQuery dataset already exists: ${datasetId}`
        );
        expect(consoleDebugSpy).toHaveBeenCalledWith(
          `BigQuery table with name ${tableId_raw} already exists in dataset ${datasetId}!`
        );
        expect(consoleInfoSpy).toHaveBeenCalledWith(
          `View with id ${tableId}_raw_latest already exists in dataset ${datasetId}.`
        );
      });

      test("should not update existing table with custom partitioning config", async () => {
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

      test("should not add custom partitioning column when partitioning exists", async () => {
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

      test("should not add duplicate custom field when it already exists", async () => {
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

  describe("SQL Query Optimization", () => {
    let view_raw_latest;
    beforeEach(async () => {
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

    test("should update view when switching from legacy to optimized query", async () => {
      let legacyView: Table;
      let optimisedView: Table;

      const legacyEvent: FirestoreDocumentChangeEvent = changeTrackerEvent({
        data: { test: "one" },
        eventId: "one",
      });

      await changeTracker({
        datasetId,
        tableId,
        useNewSnapshotQuerySyntax: false,
      }).record([legacyEvent]);

      legacyView = await dataset.table(view_raw_latest);
      const [legacyViewMetadata] = await legacyView.getMetadata();

      const optimizedEvent: FirestoreDocumentChangeEvent = changeTrackerEvent({
        data: { test: "two" },
        eventId: "two",
      });

      await changeTracker({
        datasetId,
        tableId,
        useNewSnapshotQuerySyntax: true,
      }).record([optimizedEvent]);

      optimisedView = dataset.table(view_raw_latest);
      const [optimisedViewMetadata] = await optimisedView.getMetadata();

      const [legacyDataJob] = await legacyView.createQueryJob({
        query: legacyViewMetadata.view.query,
      });

      const [optimisedDataJob] = await optimisedView.createQueryJob({
        query: optimisedViewMetadata.view.query,
      });

      const legacyData = await legacyDataJob.getQueryResults();
      const optimisedData = await optimisedDataJob.getQueryResults();

      expect(legacyData.length).toEqual(optimisedData.length);
      const firstPageLegacy = legacyData[0];
      const firstPageOptimised = optimisedData[0];

      expect(firstPageLegacy.length).toEqual(firstPageOptimised.length);
      expect(firstPageLegacy).toEqual(firstPageOptimised);

      expect(legacyViewMetadata.view.query.includes("FIRST_VALUE")).toBe(true);
      expect(optimisedViewMetadata.view.query.includes("FIRST_VALUE")).toBe(false);
    });
  });

  describe("Data Field Handling", () => {
    let table_raw_changelog;
    beforeEach(async () => {
      randomID = (Math.random() + 1).toString(36).substring(7);
      datasetId = `dataset_${randomID}`;
      tableId = `${randomID}`;
      table_raw_changelog = `${tableId}_raw_changelog`;
      [dataset] = await bq.createDataset(datasetId, {});
    });

    afterEach(async () => {
      await deleteTable({
        datasetId,
      });
    });

    test("should add old_data field if it doesn't exist", async () => {
      const event: FirestoreDocumentChangeEvent = changeTrackerEvent({});
      let schema = [{ name: "Name", type: "STRING" }];

      let [originalRawTable] = await dataset.createTable(table_raw_changelog, {
        schema,
      });

      expect(
        originalRawTable.metadata.schema.fields.filter(
          ($) => $.name === "old_data"
        ).length
      ).toBe(0);

      await changeTracker({ datasetId, tableId }).record([event]);

      const [metadata] = await dataset.table(table_raw_changelog).getMetadata();
      expect(
        metadata.schema.fields.filter(($) => $.name === "old_data").length
      ).toBe(1);
    });

    test("should set old_data to null when not provided", async () => {
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

    test("should include old_data value when provided", async () => {
      const event: FirestoreDocumentChangeEvent = changeTrackerEvent({
        old_data: { foo: "foo" },
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
  });
});
