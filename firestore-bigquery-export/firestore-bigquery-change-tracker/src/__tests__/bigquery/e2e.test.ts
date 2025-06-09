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
let tableIdRaw: string;
let dataset: Dataset;
let table: Table;
let view: Table;

/**
 * BigQuery Change Tracker End-to-End Tests
 *
 * These tests verify the functionality of the BigQuery Change Tracker,
 * including dataset/table creation, time partitioning, data handling,
 * and query optimization.
 */
describe("BigQuery Change Tracker E2E", () => {
  // Common setup for all tests
  beforeEach(async () => {
    randomID = (Math.random() + 1).toString(36).substring(7);
    datasetId = `dataset_${randomID}`;
    tableId = `table_${randomID}`;
    tableIdRaw = `${tableId}_raw_changelog`;
    dataset = bq.dataset(datasetId);
  });

  afterEach(async () => {
    await deleteTable({
      datasetId,
    });
  });

  describe("Basic Setup and Initialization", () => {
    test("should create dataset and table successfully", async () => {
      // Arrange
      await changeTracker({
        datasetId,
        tableId,
      }).record([event]);

      // Act
      const [metadata] = await dataset.table(tableIdRaw).getMetadata();

      // Assert
      expect(metadata).toBeDefined();
      expect(metadata.schema).toBeDefined();
      expect(metadata.schema.fields).toBeDefined();
    });

    test("should handle invalid dataset ID", async () => {
      // Arrange
      const invalidDatasetId = "";

      // Act & Assert
      await expect(
        changeTracker({
          datasetId: invalidDatasetId,
          tableId,
        }).record([event])
      ).rejects.toThrow();
    });
  });

  describe("Time Partitioning Configuration", () => {
    describe("New Dataset and Table Creation", () => {
      describe("Various Partitioning Options", () => {
        test("should not partition when timePartitioning is not defined", async () => {
          // Arrange
          await changeTracker({
            datasetId,
            tableId,
          }).record([event]);

          // Act
          const [metadata] = await dataset.table(tableIdRaw).getMetadata();

          // Assert
          expect(metadata.timePartitioning).toBeUndefined();
        });

        test("should partition with missing timePartitioningFieldType", async () => {
          // Arrange
          await changeTracker({
            datasetId,
            tableId,
            timePartitioning: "HOUR",
            timePartitioningField: "endDate",
            timePartitioningFirestoreField: "end_date",
          }).record([event]);

          // Act
          const [metadata] = await dataset.table(tableIdRaw).getMetadata();

          // Assert
          expect(metadata.timePartitioning).toBeDefined();
        });

        test("should partition with missing timePartitioningFirestoreField", async () => {
          // Arrange
          await changeTracker({
            datasetId,
            tableId,
            timePartitioning: "HOUR",
            timePartitioningField: "endDate",
            timePartitioningFieldType: "TIMESTAMP",
          }).record([event]);

          // Act
          const [metadata] = await dataset.table(tableIdRaw).getMetadata();

          // Assert
          expect(metadata.timePartitioning).toBeDefined();
        });

        test("should not partition when all partitioning options are given but timePartitioning is NONE", async () => {
          // Arrange
          await changeTracker({
            datasetId,
            tableId,
            timePartitioning: "NONE",
            timePartitioningField: "endDate",
            timePartitioningFieldType: "TIMESTAMP",
            timePartitioningFirestoreField: "end_date",
          }).record([event]);

          // Act
          const [metadata] = await dataset.table(tableIdRaw).getMetadata();

          // Assert
          expect(metadata.timePartitioning).toBeUndefined();
        });

        test("should partition when timePartitioningField is only not defined", async () => {
          // Arrange
          await changeTracker({
            datasetId,
            tableId,
            timePartitioning: "HOUR",
            timePartitioningFieldType: "TIMESTAMP",
            timePartitioningFirestoreField: "end_date",
          }).record([event]);

          // Act
          const [metadata] = await dataset.table(tableIdRaw).getMetadata();

          // Assert
          expect(metadata.timePartitioning).toBeDefined();
        });
      });

      describe("Table Partitioning Param Configuration", () => {
        test("should not partition with unrecognized timePartitioning option", async () => {
          // Arrange
          await changeTracker({
            datasetId,
            tableId,
            timePartitioning: "UNKNOWN",
          }).record([event]);

          // Act
          const [metadata] = await dataset.table(tableIdRaw).getMetadata();

          // Assert
          expect(metadata.timePartitioning).toBeUndefined();
        });

        test("should partition with HOUR timePartitioning", async () => {
          // Arrange
          await changeTracker({
            datasetId,
            tableId,
            timePartitioning: "HOUR",
          }).record([event]);

          // Act
          const [metadata] = await dataset.table(tableIdRaw).getMetadata();

          // Assert
          expect(metadata.timePartitioning).toBeDefined();
          expect(metadata.timePartitioning.type).toBe("HOUR");
        });

        test("should partition with DAY timePartitioning", async () => {
          // Arrange
          await changeTracker({
            datasetId,
            tableId,
            timePartitioning: "DAY",
          }).record([event]);

          // Act
          const [metadata] = await dataset.table(tableIdRaw).getMetadata();

          // Assert
          expect(metadata.timePartitioning).toBeDefined();
          expect(metadata.timePartitioning.type).toBe("DAY");
        });

        test("should partition with MONTH timePartitioning", async () => {
          // Arrange
          await changeTracker({
            datasetId,
            tableId,
            timePartitioning: "MONTH",
          }).record([event]);

          // Act
          const [metadata] = await dataset.table(tableIdRaw).getMetadata();

          // Assert
          expect(metadata.timePartitioning).toBeDefined();
          expect(metadata.timePartitioning.type).toBe("MONTH");
        });

        test("should partition with YEAR timePartitioning", async () => {
          // Arrange
          await changeTracker({
            datasetId,
            tableId,
            timePartitioning: "YEAR",
          }).record([event]);

          // Act
          const [metadata] = await dataset.table(tableIdRaw).getMetadata();

          // Assert
          expect(metadata.timePartitioning).toBeDefined();
          expect(metadata.timePartitioning.type).toBe("YEAR");
        });

        test("should not partition with NONE timePartitioning", async () => {
          // Arrange
          await changeTracker({
            datasetId,
            tableId,
            timePartitioning: "NONE",
          }).record([event]);

          // Act
          const [metadata] = await dataset.table(tableIdRaw).getMetadata();

          // Assert
          expect(metadata.timePartitioning).toBeUndefined();
        });
      });

      describe("Partitioning Field Configuration", () => {
        test("should partition with timestamp field and DAY partitioning", async () => {
          // Arrange
          await changeTracker({
            datasetId,
            tableId,
            timePartitioning: "DAY",
            timePartitioningField: "timestamp",
          }).record([event]);

          // Act
          const [metadata] = await dataset.table(tableIdRaw).getMetadata();

          // Assert
          expect(metadata.timePartitioning).toBeDefined();
          expect(metadata.timePartitioning.field).toBe("timestamp");
        });

        test("should partition with created field and DAY partitioning", async () => {
          // Arrange
          await changeTracker({
            datasetId,
            tableId,
            timePartitioning: "DAY",
            timePartitioningField: "created",
          }).record([event]);

          // Act
          const [metadata] = await dataset.table(tableIdRaw).getMetadata();

          // Assert
          expect(metadata.timePartitioning).toBeDefined();
          expect(metadata.timePartitioning.field).toBe("created");
        });

        test("should partition with TIMESTAMP field type", async () => {
          // Arrange
          await changeTracker({
            datasetId,
            tableId,
            timePartitioning: "DAY",
            timePartitioningField: "created",
            timePartitioningFieldType: "TIMESTAMP",
          }).record([event]);

          // Act
          const [metadata] = await dataset.table(tableIdRaw).getMetadata();

          // Assert
          expect(metadata.timePartitioning).toBeDefined();
          expect(metadata.timePartitioning.field).toBe("created");
        });
      });

      describe("Timestamp Handling", () => {
        describe("Firebase Timestamp Handling", () => {
          test("should handle Firebase Timestamp with TIMESTAMP type", async () => {
            // Arrange
            const created = firestore.Timestamp.now();
            const event: FirestoreDocumentChangeEvent = changeTrackerEvent({
              data: { created },
            });

            // Act
            await changeTracker({
              datasetId,
              tableId,
              timePartitioning: "DAY",
              timePartitioningField: "created",
              timePartitioningFieldType: "TIMESTAMP",
              timePartitioningFirestoreField: "created",
            }).record([event]);

            const [metadata] = await dataset.table(tableIdRaw).getMetadata();
            const [changeLogRows] = await getBigQueryTableData(
              process.env.PROJECT_ID,
              datasetId,
              tableId
            );

            // Assert
            expect(metadata.timePartitioning).toBeDefined();
            expect(changeLogRows[0].created.value).toBe(
              BigQuery.timestamp(created.toDate()).value
            );
          });

          test("should handle Firebase Timestamp with DATE type", async () => {
            // Arrange
            const created = firestore.Timestamp.now();
            const expectedDate = created
              .toDate()
              .toISOString()
              .substring(0, 10);
            const event: FirestoreDocumentChangeEvent = changeTrackerEvent({
              data: { created },
            });

            // Act
            await changeTracker({
              datasetId,
              tableId,
              timePartitioning: "DAY",
              timePartitioningField: "created",
              timePartitioningFieldType: "DATE",
              timePartitioningFirestoreField: "created",
            }).record([event]);

            const [metadata] = await dataset.table(tableIdRaw).getMetadata();
            const [changeLogRows] = await getBigQueryTableData(
              process.env.PROJECT_ID,
              datasetId,
              tableId
            );

            // Assert
            expect(metadata.timePartitioning).toBeDefined();
            expect(changeLogRows[0].created.value).toBe(expectedDate);
          });

          test("should handle Firebase Timestamp with DATETIME type", async () => {
            // Arrange
            const created = firestore.Timestamp.now();
            const expectedDate = created
              .toDate()
              .toISOString()
              .substring(0, 22);
            const event: FirestoreDocumentChangeEvent = changeTrackerEvent({
              data: { created },
            });

            // Act
            await changeTracker({
              datasetId,
              tableId,
              timePartitioning: "DAY",
              timePartitioningField: "created",
              timePartitioningFieldType: "DATETIME",
              timePartitioningFirestoreField: "created",
            }).record([event]);

            const [metadata] = await dataset.table(tableIdRaw).getMetadata();
            const [changeLogRows] = await getBigQueryTableData(
              process.env.PROJECT_ID,
              datasetId,
              tableId
            );

            // Assert
            expect(metadata.timePartitioning).toBeDefined();
            expect(changeLogRows[0].created.value.substring(0, 22)).toBe(
              expectedDate
            );
          });

          test("should handle invalid Firebase Timestamp", async () => {
            // Arrange
            const invalidTimestamp = new firestore.Timestamp(NaN, 0);
            const event: FirestoreDocumentChangeEvent = changeTrackerEvent({
              data: { created: invalidTimestamp },
            });

            // Act & Assert
            await expect(
              changeTracker({
                datasetId,
                tableId,
                timePartitioning: "DAY",
                timePartitioningField: "created",
                timePartitioningFieldType: "TIMESTAMP",
                timePartitioningFirestoreField: "created",
              }).record([event])
            ).rejects.toThrow();
          });
        });

        describe("DateTime Handling", () => {
          test("should handle DateTime Timestamp correctly", async () => {
            // Arrange
            const created = firestore.Timestamp.now();
            const event: FirestoreDocumentChangeEvent = changeTrackerEvent({
              data: { created },
            });

            // Act
            await changeTracker({
              datasetId,
              tableId,
              timePartitioning: "DAY",
              timePartitioningField: "timestamp",
              timePartitioningFieldType: "TIMESTAMP",
              timePartitioningFirestoreField: "created",
            }).record([event]);

            const [metadata] = await dataset.table(tableIdRaw).getMetadata();
            const [changeLogRows] = await getBigQueryTableData(
              process.env.PROJECT_ID,
              datasetId,
              tableId
            );

            // Assert
            expect(metadata.timePartitioning).toBeDefined();
            expect(changeLogRows[0].timestamp.value).toBe(
              BigQuery.timestamp(created.toDate()).value
            );
          });

          test("should handle DateTime Timestamp Date correctly", async () => {
            // Arrange
            const created = firestore.Timestamp.now().toDate();
            const event: FirestoreDocumentChangeEvent = changeTrackerEvent({
              data: { created },
            });

            // Act
            await changeTracker({
              datasetId,
              tableId,
              timePartitioning: "DAY",
              timePartitioningField: "created",
              timePartitioningFieldType: "TIMESTAMP",
              timePartitioningFirestoreField: "created",
            }).record([event]);

            const [metadata] = await dataset.table(tableIdRaw).getMetadata();
            const [changeLogRows] = await getBigQueryTableData(
              process.env.PROJECT_ID,
              datasetId,
              tableId
            );

            // Assert
            expect(metadata.timePartitioning).toBeDefined();
            expect(changeLogRows[0].created.value).toBe(
              BigQuery.timestamp(created).value
            );
          });

          test("should handle invalid Date object", async () => {
            // Arrange
            const invalidDate = new Date("invalid-date");
            const event: FirestoreDocumentChangeEvent = changeTrackerEvent({
              data: { created: invalidDate },
            });

            // Act & Assert
            await expect(
              changeTracker({
                datasetId,
                tableId,
                timePartitioning: "DAY",
                timePartitioningField: "created",
                timePartitioningFieldType: "TIMESTAMP",
                timePartitioningFirestoreField: "created",
              }).record([event])
            ).rejects.toThrow();
          });
        });
      });

      describe("Invalid Partitioning Configurations", () => {
        describe("Missing Required Fields", () => {
          test("should not partition with missing timePartitioningField", async () => {
            // Arrange
            await changeTracker({
              datasetId,
              tableId,
              timePartitioning: "HOUR",
              timePartitioningField: null,
              timePartitioningFieldType: "TIMESTAMP",
              timePartitioningFirestoreField: "end_date",
            }).record([event]);

            // Act
            const [metadata] = await dataset.table(tableIdRaw).getMetadata();

            // Assert
            expect(metadata.timePartitioning).toBeUndefined();
          });
        });

        describe("Invalid Field Types", () => {
          test("should not partition with unknown timePartitioningFieldType", async () => {
            // Arrange
            await changeTracker({
              datasetId,
              tableId,
              timePartitioning: "HOUR",
              timePartitioningField: "endDate",
              timePartitioningFieldType: "unknown",
              timePartitioningFirestoreField: "end_date",
            }).record([event]);

            // Act
            const [metadata] = await dataset.table(tableIdRaw).getMetadata();

            // Assert
            expect(metadata.timePartitioning).toBeUndefined();
          });

          test("should not partition with DATE type and HOUR partitioning", async () => {
            // Arrange
            await changeTracker({
              datasetId,
              tableId,
              timePartitioning: "HOUR",
              timePartitioningField: "endDate",
              timePartitioningFieldType: "DATE",
              timePartitioningFirestoreField: "end_date",
            }).record([event]);

            // Act
            const [metadata] = await dataset.table(tableIdRaw).getMetadata();

            // Assert
            expect(metadata.timePartitioning).toBeUndefined();
          });
        });
      });
    });

    describe("Existing Dataset and Table Handling", () => {
      beforeEach(async () => {
        [dataset] = await bq.dataset(datasetId).create();
        [table] = await dataset.createTable(tableIdRaw, {
          schema: RawChangelogSchema,
        });

        const latestSnapshot = latestConsistentSnapshotView({
          datasetId,
          tableName: tableIdRaw,
          schema: RawChangelogViewSchema,
          useLegacyQuery: false,
        });

        [view] = await dataset.createTable(`${tableId}_raw_latest`, {
          view: latestSnapshot,
        });
      });

      test("should not update existing non-partitioned table with timePartitioning only", async () => {
        // Arrange
        const tableExists = await dataset.table(tableIdRaw).exists();
        expect(tableExists[0]).toBe(true);

        // Act
        await changeTracker({
          datasetId,
          tableId,
          timePartitioning: "HOUR",
        }).record([event]);

        const [metadata] = await dataset.table(tableIdRaw).getMetadata();

        // Assert
        expect(metadata.timePartitioning).toBeUndefined();
        expect(consoleLogSpyWarn).toHaveBeenCalledWith(
          `Did not add partitioning to schema: Partition field not provided`
        );
        expect(consoleInfoSpy).toHaveBeenCalledWith(
          `BigQuery dataset already exists: ${datasetId}`
        );
        expect(consoleDebugSpy).toHaveBeenCalledWith(
          `BigQuery table with name ${tableIdRaw} already exists in dataset ${datasetId}!`
        );
        expect(consoleInfoSpy).toHaveBeenCalledWith(
          `View with id ${tableId}_raw_latest already exists in dataset ${datasetId}.`
        );
      });

      test("should not update existing table with custom partitioning config", async () => {
        // Arrange & Act
        await changeTracker({
          datasetId,
          tableId,
          timePartitioning: "HOUR",
          timePartitioningField: "endDate",
          timePartitioningFieldType: "DATE",
          timePartitioningFirestoreField: "end_date",
        }).record([event]);

        // Assert
        const [metadata] = await dataset.table(tableIdRaw).getMetadata();
        expect(metadata.timePartitioning).toBeUndefined();
      });

      test("should not add custom partitioning column when partitioning exists", async () => {
        // Arrange & Act
        await changeTracker({
          datasetId,
          tableId,
          timePartitioning: "HOUR",
          timePartitioningField: "endDate",
          timePartitioningFieldType: "DATE",
          timePartitioningFirestoreField: "end_date",
        }).record([event]);

        // Assert
        const [metadata] = await dataset.table(tableIdRaw).getMetadata();
        expect(
          metadata.schema.fields.filter(($) => $.name === "endDate").length
        ).toBe(0);
        expect(metadata.timePartitioning).toBeUndefined();
      });

      test("should not add duplicate custom field when it already exists", async () => {
        // Arrange
        const [metaData] = await table.getMetadata();
        metaData.schema.fields.push({
          name: "custom_field",
          mode: "NULLABLE",
          type: "Date",
          description: "example custom field",
        });

        await table.setMetadata(metaData);

        // Act
        await changeTracker({
          datasetId,
          tableId,
          timePartitioning: "DAY",
          timePartitioningField: "custom_field",
          timePartitioningFieldType: "DATE",
          timePartitioningFirestoreField: "custom_field",
        }).record([event]);

        // Assert
        const [metadata] = await dataset.table(tableIdRaw).getMetadata();
        expect(
          metadata.schema.fields.filter(($) => $.name === "custom_field").length
        ).toBe(1);
      });

      test("should use table's current field type to override extension configuration", async () => {
        // Arrange
        const [metaData] = await table.getMetadata();
        metaData.schema.fields.push({
          name: "timestamp_field",
          mode: "NULLABLE",
          type: "TIMESTAMP",
          description: "example timestamp field",
        });

        await table.setMetadata(metaData);

        // Act
        await changeTracker({
          datasetId,
          tableId,
          timePartitioning: "DAY",
          timePartitioningField: "timestamp_field",
          timePartitioningFieldType: "DATE", // Different from table's type
          timePartitioningFirestoreField: "timestamp_field",
        }).record([event]);

        // Assert
        const [metadata] = await dataset.table(tableIdRaw).getMetadata();
        expect(metadata.timePartitioning).toBeDefined();
        expect(metadata.timePartitioning.field).toBe("timestamp_field");
      });
    });
  });

  describe("SQL Query Optimization", () => {
    let viewRawLatest: string;
    beforeEach(async () => {
      randomID = (Math.random() + 1).toString(36).substring(7);
      datasetId = `dataset_${randomID}`;
      tableId = `table_${randomID}`;
      viewRawLatest = `${tableId}_raw_latest`;
      dataset = bq.dataset(datasetId);
    });

    test("should update view when switching from legacy to optimized query", async () => {
      // Arrange
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

      legacyView = await dataset.table(viewRawLatest);
      const [legacyViewMetadata] = await legacyView.getMetadata();

      const optimizedEvent: FirestoreDocumentChangeEvent = changeTrackerEvent({
        data: { test: "two" },
        eventId: "two",
      });

      // Act
      await changeTracker({
        datasetId,
        tableId,
        useNewSnapshotQuerySyntax: true,
      }).record([optimizedEvent]);

      optimisedView = dataset.table(viewRawLatest);
      const [optimisedViewMetadata] = await optimisedView.getMetadata();

      const [legacyDataJob] = await legacyView.createQueryJob({
        query: legacyViewMetadata.view.query,
      });

      const [optimisedDataJob] = await optimisedView.createQueryJob({
        query: optimisedViewMetadata.view.query,
      });

      const legacyData = await legacyDataJob.getQueryResults();
      const optimisedData = await optimisedDataJob.getQueryResults();

      // Assert
      expect(legacyData.length).toEqual(optimisedData.length);
      const firstPageLegacy = legacyData[0];
      const firstPageOptimised = optimisedData[0];

      expect(firstPageLegacy.length).toEqual(firstPageOptimised.length);
      expect(firstPageLegacy).toEqual(firstPageOptimised);

      expect(legacyViewMetadata.view.query.includes("FIRST_VALUE")).toBe(true);
      expect(optimisedViewMetadata.view.query.includes("FIRST_VALUE")).toBe(
        false
      );
    });
  });

  describe("Data Field Handling", () => {
    let tableRawChangelog: string;
    beforeEach(async () => {
      randomID = (Math.random() + 1).toString(36).substring(7);
      datasetId = `dataset_${randomID}`;
      tableId = `${randomID}`;
      tableRawChangelog = `${tableId}_raw_changelog`;
      [dataset] = await bq.createDataset(datasetId, {});
    });

    test("should add old_data field if it doesn't exist", async () => {
      // Arrange
      const event: FirestoreDocumentChangeEvent = changeTrackerEvent({});
      let schema = [{ name: "Name", type: "STRING" }];

      let [originalRawTable] = await dataset.createTable(tableRawChangelog, {
        schema,
      });

      expect(
        originalRawTable.metadata.schema.fields.filter(
          ($) => $.name === "old_data"
        ).length
      ).toBe(0);

      // Act
      await changeTracker({ datasetId, tableId }).record([event]);

      // Assert
      const [metadata] = await dataset.table(tableRawChangelog).getMetadata();
      expect(
        metadata.schema.fields.filter(($) => $.name === "old_data").length
      ).toBe(1);
    });

    test("should set old_data to null when not provided", async () => {
      // Arrange
      const event: FirestoreDocumentChangeEvent = changeTrackerEvent({
        data: { foo: "foo" },
      });

      // Act
      await changeTracker({ datasetId, tableId }).record([event]);

      // Assert
      const [changeLogRows] = await getBigQueryTableData(
        process.env.PROJECT_ID,
        datasetId,
        tableId
      );

      expect(changeLogRows[0].old_data).toBe(null);
    });

    test("should include old_data value when provided", async () => {
      // Arrange
      const event: FirestoreDocumentChangeEvent = changeTrackerEvent({
        old_data: { foo: "foo" },
        data: { foo: "bar" },
      });

      // Act
      await changeTracker({ datasetId, tableId }).record([event]);

      // Assert
      const [changeLogRows] = await getBigQueryTableData(
        process.env.PROJECT_ID,
        datasetId,
        tableId
      );

      expect(changeLogRows[0].old_data).toBeDefined();
      expect(changeLogRows[0].old_data.foo).toBe("foo");
    });

    test("should handle null data field", async () => {
      // Arrange
      const event: FirestoreDocumentChangeEvent = changeTrackerEvent({
        data: null,
      });

      // Act & Assert
      await expect(
        changeTracker({ datasetId, tableId }).record([event])
      ).rejects.toThrow();
    });

    test("should handle undefined data field", async () => {
      // Arrange
      const event: FirestoreDocumentChangeEvent = changeTrackerEvent({
        data: undefined,
      });

      // Act & Assert
      await expect(
        changeTracker({ datasetId, tableId }).record([event])
      ).rejects.toThrow();
    });
  });
});
