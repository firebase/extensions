import { BigQuery, Dataset, Table } from "@google-cloud/bigquery";
import { logger } from "firebase-functions";
import waitForExpect from "wait-for-expect";
import { firestore } from "firebase-admin";

import {
  RawChangelogSchema,
  RawChangelogViewSchema,
} from "../../bigquery/schema";

import { ChangeType, FirestoreDocumentChangeEvent } from "../..";
import { latestConsistentSnapshotView } from "../../bigquery/snapshot";
import { deleteTable } from "../fixtures/clearTables";
import { changeTracker, changeTrackerEvent } from "../fixtures/changeTracker";
import { getBigQueryTableData } from "../fixtures/queries";

process.env.PROJECT_ID = "dev-extensions-testing";

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

beforeAll(() => {
  waitForExpect.defaults.timeout = 15000;
  waitForExpect.defaults.interval = 500;
});

const testUtils = {
  async waitForTableExists(
    dataset: Dataset,
    tableName: string,
    timeout = 10000
  ) {
    await waitForExpect(async () => {
      const table = dataset.table(tableName);
      const [exists] = await table.exists();
      expect(exists).toBe(true);
    }, timeout);
  },

  async waitForTableMetadata(
    table: Table,
    validator: (metadata: any) => void,
    timeout = 10000
  ) {
    await waitForExpect(async () => {
      const [metadata] = await table.getMetadata();
      validator(metadata);
    }, timeout);
  },

  async waitForRawTableRowCount(
    projectId: string,
    datasetId: string,
    tableId: string,
    expectedCount: number,
    timeout = 30000
  ) {
    const rawTableName = `${tableId}_raw_changelog`;

    await waitForExpect(async () => {
      const query = `
        SELECT COUNT(*) as row_count 
        FROM \`${projectId}.${datasetId}.${rawTableName}\`
      `;

      const [job] = await bq.createQueryJob({ query });
      const [rows] = await job.getQueryResults();

      expect(Number(rows[0].row_count)).toBe(expectedCount);
    }, timeout);
  },

  async waitForRowCount(
    projectId: string,
    datasetId: string,
    tableId: string,
    expectedCount: number,
    timeout = 15000
  ) {
    await waitForExpect(async () => {
      const [rows] = await getBigQueryTableData(projectId, datasetId, tableId);
      expect(rows.length).toBe(expectedCount);
    }, timeout);
  },

  async waitForViewReady(dataset: Dataset, viewName: string, timeout = 10000) {
    await waitForExpect(async () => {
      const view = dataset.table(viewName);
      const [exists] = await view.exists();
      expect(exists).toBe(true);

      const [metadata] = await view.getMetadata();
      expect(metadata.view).toBeDefined();
      expect(metadata.view.query).toBeDefined();
    }, timeout);
  },
};

const createTestEvent = (overrides = {}) => {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(7);
  const uniqueId = `${timestamp}-${randomSuffix}`;

  const defaults = {
    timestamp: new Date().toISOString(),
    documentName: `test-doc-${uniqueId}`,
    eventId: `event-${uniqueId}`,
    documentId: `doc-${uniqueId}`,
    data: { test_data: "value" },
  };

  return changeTrackerEvent({ ...defaults, ...overrides });
};

const expectPartitioning = (
  metadata: any,
  expectedType?: string,
  expectedField?: string
) => {
  expect(metadata.timePartitioning).toBeDefined();
  if (expectedType) {
    expect(metadata.timePartitioning.type).toBe(expectedType);
  }
  if (expectedField) {
    expect(metadata.timePartitioning.field).toBe(expectedField);
  }
};

const expectNoPartitioning = (metadata: any) => {
  expect(metadata.timePartitioning).toBeUndefined();
};

describe("BigQuery Change Tracker E2E", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    randomID = (Math.random() + 1).toString(36).substring(7);
    datasetId = `dataset_${randomID}`;
    tableId = `table_${randomID}`;
    tableIdRaw = `${tableId}_raw_changelog`;
    dataset = bq.dataset(datasetId);
  });

  afterEach(async () => {
    try {
      await deleteTable({ datasetId });
    } catch (error) {
      console.warn(`Cleanup failed for dataset ${datasetId}:`, error);
    }
  });

  describe("Basic Setup and Initialization", () => {
    test("should create dataset and table successfully", async () => {
      await changeTracker({
        datasetId,
        tableId,
      }).record([event]);

      await testUtils.waitForTableExists(dataset, tableIdRaw);

      await testUtils.waitForTableMetadata(
        dataset.table(tableIdRaw),
        (metadata) => {
          expect(metadata).toBeDefined();
          expect(metadata.schema).toBeDefined();
          expect(metadata.schema.fields).toBeDefined();
        }
      );
    });

    test("should handle invalid dataset ID", async () => {
      const invalidDatasetId = "dataset-with-hyphens";

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
      const createTableWithPartitioning = async (partitioningConfig: any) => {
        await changeTracker({
          datasetId,
          tableId,
          ...partitioningConfig,
        }).record([event]);

        await testUtils.waitForTableExists(dataset, tableIdRaw);
        const [metadata] = await dataset.table(tableIdRaw).getMetadata();
        return metadata;
      };

      describe("Various Partitioning Options", () => {
        test("should not partition when timePartitioning is not defined", async () => {
          const metadata = await createTableWithPartitioning({});
          expectNoPartitioning(metadata);
        });

        test("should partition with missing timePartitioningFieldType", async () => {
          const metadata = await createTableWithPartitioning({
            timePartitioning: "HOUR",
            timePartitioningField: "endDate",
            timePartitioningFirestoreField: "end_date",
          });

          expectPartitioning(metadata);
        });

        test("should NOT partition with missing timePartitioningFirestoreField", async () => {
          const metadata = await createTableWithPartitioning({
            timePartitioning: "HOUR",
            timePartitioningField: "endDate",
            timePartitioningFieldType: "TIMESTAMP",
          });

          expectNoPartitioning(metadata);
        });

        test("should not partition when all partitioning options are given but timePartitioning is NONE", async () => {
          const metadata = await createTableWithPartitioning({
            timePartitioning: "NONE",
            timePartitioningField: "endDate",
            timePartitioningFieldType: "TIMESTAMP",
            timePartitioningFirestoreField: "end_date",
          });

          expectNoPartitioning(metadata);
        });

        test("should not partition when timePartitioningField is not defined", async () => {
          const metadata = await createTableWithPartitioning({
            timePartitioning: "HOUR",
            timePartitioningFieldType: "TIMESTAMP",
            timePartitioningFirestoreField: "end_date",
          });

          expectNoPartitioning(metadata);

          expect(consoleLogSpyWarn).toHaveBeenCalledWith(
            expect.stringContaining("Cannot create partitioning")
          );
        });
      });

      describe("Table Partitioning Param Configuration", () => {
        test("should not partition with unrecognized timePartitioning option", async () => {
          const metadata = await createTableWithPartitioning({
            timePartitioning: "UNKNOWN",
          });

          expectNoPartitioning(metadata);
        });

        const partitioningTypes = ["HOUR", "DAY", "MONTH", "YEAR"];

        partitioningTypes.forEach((type) => {
          test(`should partition with ${type} timePartitioning using ingestion time`, async () => {
            const metadata = await createTableWithPartitioning({
              timePartitioning: type,
            });

            expectPartitioning(metadata, type);
            expect(metadata.timePartitioning.field).toBeUndefined();
          });
        });

        test("should not partition with NONE timePartitioning", async () => {
          const metadata = await createTableWithPartitioning({
            timePartitioning: "NONE",
          });

          expectNoPartitioning(metadata);
        });
      });

      describe("Partitioning Field Configuration", () => {
        test("should partition with built-in timestamp field and DAY partitioning", async () => {
          const metadata = await createTableWithPartitioning({
            timePartitioning: "DAY",
            timePartitioningField: "timestamp",
          });

          // Built-in timestamp field should work without requiring a Firestore field
          expectPartitioning(metadata, "DAY", "timestamp");
        });

        // And optionally add a test for custom fields that DO require Firestore field:
        test("should NOT partition with custom field when missing Firestore field", async () => {
          const metadata = await createTableWithPartitioning({
            timePartitioning: "DAY",
            timePartitioningField: "customDate", // Not a built-in field
          });

          expectNoPartitioning(metadata);
        });

        test("should partition when all required fields are provided", async () => {
          const metadata = await createTableWithPartitioning({
            timePartitioning: "DAY",
            timePartitioningField: "timestamp",
          });

          expectPartitioning(metadata, "DAY", "timestamp");
        });

        test("should partition with created field and DAY partitioning when all fields provided", async () => {
          const metadata = await createTableWithPartitioning({
            timePartitioning: "DAY",
            timePartitioningField: "created",
            timePartitioningFirestoreField: "created", // Add this
          });

          expectPartitioning(metadata, "DAY", "created");
        });

        // "should partition with TIMESTAMP field type" needs Firestore field
        test("should partition with TIMESTAMP field type when all fields provided", async () => {
          const metadata = await createTableWithPartitioning({
            timePartitioning: "DAY",
            timePartitioningField: "created",
            timePartitioningFieldType: "TIMESTAMP",
            timePartitioningFirestoreField: "created", // Add this
          });

          expectPartitioning(metadata, "DAY", "created");
        });
      });

      describe("Timestamp Handling", () => {
        describe("Firebase Timestamp Handling", () => {
          test("should handle Firebase Timestamp with TIMESTAMP type", async () => {
            const created = firestore.Timestamp.now();
            const event = createTestEvent({
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

            await testUtils.waitForRowCount(
              process.env.PROJECT_ID,
              datasetId,
              tableId,
              1
            );

            const [changeLogRows] = await getBigQueryTableData(
              process.env.PROJECT_ID,
              datasetId,
              tableId
            );

            expect(changeLogRows[0].created.value).toBe(
              BigQuery.timestamp(created.toDate()).value
            );
          });

          test("should handle Firebase Timestamp with DATE type", async () => {
            const created = firestore.Timestamp.now();
            const expectedDate = created
              .toDate()
              .toISOString()
              .substring(0, 10);
            const event = createTestEvent({
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

            await testUtils.waitForRowCount(
              process.env.PROJECT_ID,
              datasetId,
              tableId,
              1
            );

            const [changeLogRows] = await getBigQueryTableData(
              process.env.PROJECT_ID,
              datasetId,
              tableId
            );

            expect(changeLogRows[0].created.value).toBe(expectedDate);
          });

          test("should handle Firebase Timestamp with DATETIME type", async () => {
            const created = firestore.Timestamp.now();
            const expectedDate = created
              .toDate()
              .toISOString()
              .substring(0, 22);
            const event = createTestEvent({
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

            await testUtils.waitForRowCount(
              process.env.PROJECT_ID,
              datasetId,
              tableId,
              1
            );

            const [changeLogRows] = await getBigQueryTableData(
              process.env.PROJECT_ID,
              datasetId,
              tableId
            );

            expect(changeLogRows[0].created.value.substring(0, 22)).toBe(
              expectedDate
            );
          });

          test("should handle invalid Firebase Timestamp gracefully", async () => {
            const invalidTimestamp = {
              _seconds: NaN,
              _nanoseconds: 0,
              toDate: () => new Date(NaN),
            };

            const event = createTestEvent({
              data: { created: invalidTimestamp },
            });

            await changeTracker({
              datasetId,
              tableId,
              timePartitioning: "DAY",
              timePartitioningField: "created",
              timePartitioningFieldType: "TIMESTAMP",
              timePartitioningFirestoreField: "created",
            }).record([event]);

            await testUtils.waitForRowCount(
              process.env.PROJECT_ID,
              datasetId,
              tableId,
              1
            );

            const [rows] = await getBigQueryTableData(
              process.env.PROJECT_ID,
              datasetId,
              tableId
            );

            expect(rows[0].created).toBeNull();
            expect(rows[0].event_id).toBe(event.eventId);
            expect(rows[0].document_name).toBe(event.documentName);
            expect(rows[0].operation).toBe(ChangeType[event.operation]);
          });

          test("should handle invalid date from toDate gracefully", async () => {
            const invalidTimestamp = {
              toDate: () => new Date("invalid-date"),
            };

            const event = createTestEvent({
              data: { created: invalidTimestamp },
            });

            await changeTracker({
              datasetId,
              tableId,
              timePartitioning: "DAY",
              timePartitioningField: "created",
              timePartitioningFieldType: "TIMESTAMP",
              timePartitioningFirestoreField: "created",
            }).record([event]);

            await testUtils.waitForRowCount(
              process.env.PROJECT_ID,
              datasetId,
              tableId,
              1
            );

            const [rows] = await getBigQueryTableData(
              process.env.PROJECT_ID,
              datasetId,
              tableId
            );

            expect(rows[0].created).toBeNull();
          });

          test("should handle timestamp-like with string seconds gracefully", async () => {
            const invalidTimestamp = {
              _seconds: "not-a-number" as any,
              _nanoseconds: 0,
            };

            const event = createTestEvent({
              data: { created: invalidTimestamp },
            });

            await changeTracker({
              datasetId,
              tableId,
              timePartitioning: "DAY",
              timePartitioningField: "created",
              timePartitioningFieldType: "TIMESTAMP",
              timePartitioningFirestoreField: "created",
            }).record([event]);

            await testUtils.waitForRowCount(
              process.env.PROJECT_ID,
              datasetId,
              tableId,
              1
            );

            const [rows] = await getBigQueryTableData(
              process.env.PROJECT_ID,
              datasetId,
              tableId
            );

            expect(rows[0].created).toBeNull();
          });

          test("should handle object with toDate that throws gracefully", async () => {
            const invalidTimestamp = {
              toDate: () => {
                throw new Error("toDate failed");
              },
            };

            const event = createTestEvent({
              data: { created: invalidTimestamp },
            });

            await changeTracker({
              datasetId,
              tableId,
              timePartitioning: "DAY",
              timePartitioningField: "created",
              timePartitioningFieldType: "TIMESTAMP",
              timePartitioningFirestoreField: "created",
            }).record([event]);

            await testUtils.waitForRowCount(
              process.env.PROJECT_ID,
              datasetId,
              tableId,
              1
            );

            const [rows] = await getBigQueryTableData(
              process.env.PROJECT_ID,
              datasetId,
              tableId
            );

            expect(rows[0].created).toBeNull();
          });
        });

        describe("DateTime Handling", () => {
          test("should handle DateTime Timestamp correctly", async () => {
            const created = firestore.Timestamp.now();
            const event = createTestEvent({
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

            await testUtils.waitForRowCount(
              process.env.PROJECT_ID,
              datasetId,
              tableId,
              1
            );

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
            const event = createTestEvent({
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

            await testUtils.waitForRowCount(
              process.env.PROJECT_ID,
              datasetId,
              tableId,
              1
            );

            const [changeLogRows] = await getBigQueryTableData(
              process.env.PROJECT_ID,
              datasetId,
              tableId
            );

            expect(changeLogRows[0].created.value).toBe(
              BigQuery.timestamp(created).value
            );
          });

          test("should handle invalid Date object gracefully", async () => {
            const invalidDate = new Date("invalid-date");
            const event = createTestEvent({
              data: { created: invalidDate },
            });

            await changeTracker({
              datasetId,
              tableId,
              timePartitioning: "DAY",
              timePartitioningField: "created",
              timePartitioningFieldType: "TIMESTAMP",
              timePartitioningFirestoreField: "created",
            }).record([event]);

            await testUtils.waitForRowCount(
              process.env.PROJECT_ID,
              datasetId,
              tableId,
              1
            );

            const [rows] = await getBigQueryTableData(
              process.env.PROJECT_ID,
              datasetId,
              tableId
            );

            expect(rows[0].created).toBeNull();
          });
        });
      });

      describe("Invalid Partitioning Configurations", () => {
        describe("Missing Required Fields", () => {
          test("should not partition with missing timePartitioningField", async () => {
            const metadata = await createTableWithPartitioning({
              timePartitioning: "HOUR",
              timePartitioningField: null,
              timePartitioningFieldType: "TIMESTAMP",
              timePartitioningFirestoreField: "end_date",
            });

            expectNoPartitioning(metadata);
          });
        });

        describe("Invalid Field Types", () => {
          test("should not partition with unknown timePartitioningFieldType", async () => {
            const metadata = await createTableWithPartitioning({
              timePartitioning: "HOUR",
              timePartitioningField: "endDate",
              timePartitioningFieldType: "unknown",
              timePartitioningFirestoreField: "end_date",
            });

            expectNoPartitioning(metadata);
          });

          test("should not partition with DATE type and HOUR partitioning", async () => {
            const metadata = await createTableWithPartitioning({
              timePartitioning: "HOUR",
              timePartitioningField: "endDate",
              timePartitioningFieldType: "DATE",
              timePartitioningFirestoreField: "end_date",
            });

            expectNoPartitioning(metadata);
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

        await testUtils.waitForTableExists(dataset, tableIdRaw);
        await testUtils.waitForViewReady(dataset, `${tableId}_raw_latest`);
      });

      test("should not update existing non-partitioned table with timePartitioning only", async () => {
        await changeTracker({
          datasetId,
          tableId,
          timePartitioning: "HOUR",
        }).record([event]);

        await waitForExpect(async () => {
          const [metadata] = await dataset.table(tableIdRaw).getMetadata();
          expectNoPartitioning(metadata);
        }, 5000);

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
        await changeTracker({
          datasetId,
          tableId,
          timePartitioning: "HOUR",
          timePartitioningField: "endDate",
          timePartitioningFieldType: "DATE",
          timePartitioningFirestoreField: "end_date",
        }).record([event]);

        await waitForExpect(async () => {
          const [metadata] = await dataset.table(tableIdRaw).getMetadata();
          expectNoPartitioning(metadata);
        });
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

        await waitForExpect(async () => {
          const [metadata] = await dataset.table(tableIdRaw).getMetadata();
          expect(
            metadata.schema.fields.filter(($) => $.name === "endDate").length
          ).toBe(0);
          expectNoPartitioning(metadata);
        });
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

        await testUtils.waitForTableMetadata(table, (metadata) => {
          const customField = metadata.schema.fields.find(
            (f: any) => f.name === "custom_field"
          );
          expect(customField).toBeDefined();
        });

        await changeTracker({
          datasetId,
          tableId,
          timePartitioning: "DAY",
          timePartitioningField: "custom_field",
          timePartitioningFieldType: "DATE",
          timePartitioningFirestoreField: "custom_field",
        }).record([event]);

        await waitForExpect(async () => {
          const [metadata] = await dataset.table(tableIdRaw).getMetadata();
          expect(
            metadata.schema.fields.filter(($) => $.name === "custom_field")
              .length
          ).toBe(1);
        });
      });

      test("should not attempt to modify existing table's partitioning configuration", async () => {
        await table.delete();

        const customSchema = {
          fields: [
            ...RawChangelogSchema.fields,
            {
              name: "custom_timestamp",
              mode: "NULLABLE",
              type: "TIMESTAMP",
              description: "Custom timestamp field for partitioning",
            },
          ],
        };

        [table] = await dataset.createTable(tableIdRaw, {
          schema: customSchema,
          timePartitioning: {
            type: "DAY",
            field: "custom_timestamp",
          },
        });

        await testUtils.waitForTableMetadata(table, (metadata) => {
          expect(metadata.timePartitioning).toBeDefined();
          expect(metadata.timePartitioning.field).toBe("custom_timestamp");
          expect(metadata.timePartitioning.type).toBe("DAY");
        });

        await changeTracker({
          datasetId,
          tableId,
          timePartitioning: "HOUR",
          timePartitioningField: "custom_timestamp",
          timePartitioningFieldType: "DATE",
          timePartitioningFirestoreField: "custom_timestamp",
        }).record([event]);

        await waitForExpect(async () => {
          const [finalMetadata] = await dataset.table(tableIdRaw).getMetadata();

          expect(finalMetadata.timePartitioning.type).toBe("DAY");
          expect(finalMetadata.timePartitioning.field).toBe("custom_timestamp");

          const field = finalMetadata.schema.fields.find(
            (f) => f.name === "custom_timestamp"
          );
          expect(field.type).toBe("TIMESTAMP");
        });

        await testUtils.waitForRowCount(
          process.env.PROJECT_ID,
          datasetId,
          tableId,
          1
        );

        expect(consoleDebugSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            `BigQuery table with name ${tableIdRaw} already exists`
          )
        );
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
      const legacyEvent = createTestEvent({
        data: { test: "one" },
        eventId: "one",
      });

      await changeTracker({
        datasetId,
        tableId,
        useNewSnapshotQuerySyntax: false,
      }).record([legacyEvent]);

      await testUtils.waitForViewReady(dataset, viewRawLatest);

      const legacyView = dataset.table(viewRawLatest);
      const [legacyViewMetadata] = await legacyView.getMetadata();
      expect(legacyViewMetadata.view.query).toContain("FIRST_VALUE");

      const optimizedEvent = createTestEvent({
        data: { test: "two" },
        eventId: "two",
      });

      await changeTracker({
        datasetId,
        tableId,
        useNewSnapshotQuerySyntax: true,
      }).record([optimizedEvent]);

      await testUtils.waitForTableMetadata(
        dataset.table(viewRawLatest),
        (metadata) => {
          expect(metadata.view.query).not.toContain("FIRST_VALUE");
        }
      );

      const optimisedView = dataset.table(viewRawLatest);
      const [optimisedViewMetadata] = await optimisedView.getMetadata();

      const [legacyDataJob] = await legacyView.createQueryJob({
        query: legacyViewMetadata.view.query,
      });

      const [optimisedDataJob] = await optimisedView.createQueryJob({
        query: optimisedViewMetadata.view.query,
      });

      await waitForExpect(async () => {
        const legacyData = await legacyDataJob.getQueryResults();
        const optimisedData = await optimisedDataJob.getQueryResults();

        expect(legacyData.length).toEqual(optimisedData.length);
        const firstPageLegacy = legacyData[0];
        const firstPageOptimised = optimisedData[0];

        expect(firstPageLegacy.length).toEqual(firstPageOptimised.length);
        expect(firstPageLegacy).toEqual(firstPageOptimised);
      });
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
      const event = createTestEvent({});
      const schema = [{ name: "Name", type: "STRING" }];

      const [originalRawTable] = await dataset.createTable(tableRawChangelog, {
        schema,
      });

      expect(
        originalRawTable.metadata.schema.fields.filter(
          ($) => $.name === "old_data"
        ).length
      ).toBe(0);

      await changeTracker({ datasetId, tableId }).record([event]);

      await testUtils.waitForTableMetadata(
        dataset.table(tableRawChangelog),
        (metadata) => {
          const oldDataFields = metadata.schema.fields.filter(
            ($: any) => $.name === "old_data"
          );
          expect(oldDataFields.length).toBe(1);
        }
      );
    });

    test("should set old_data to null when not provided", async () => {
      const event = createTestEvent({
        data: { foo: "foo" },
      });

      await changeTracker({ datasetId, tableId }).record([event]);

      await testUtils.waitForRowCount(
        process.env.PROJECT_ID,
        datasetId,
        tableId,
        1
      );

      const [changeLogRows] = await getBigQueryTableData(
        process.env.PROJECT_ID,
        datasetId,
        tableId
      );

      expect(changeLogRows[0].old_data).toBe(null);
    });

    test("should include old_data value when provided", async () => {
      const event = createTestEvent({
        oldData: { foo: "foo" },
        data: { foo: "bar" },
      });

      await changeTracker({ datasetId, tableId }).record([event]);

      await testUtils.waitForRowCount(
        process.env.PROJECT_ID,
        datasetId,
        tableId,
        1
      );

      const [changeLogRows] = await getBigQueryTableData(
        process.env.PROJECT_ID,
        datasetId,
        tableId
      );

      expect(typeof changeLogRows[0].old_data).toBe("string");
      expect(JSON.parse(changeLogRows[0].old_data).foo).toBe("foo");
    });
  });

  describe("Performance", () => {
    test("should handle batch inserts efficiently", async () => {
      const eventCount = 10;
      const events = Array.from({ length: eventCount }, (_, i) => {
        const uniqueId = `${i}-${Date.now()}-${Math.random()
          .toString(36)
          .substring(7)}`;
        return createTestEvent({
          eventId: `batch-event-${uniqueId}`,
          documentId: `batch-doc-${uniqueId}`,
          data: {
            test_data: `value-${i}`,
            index: i,
          },
        });
      });

      const start = Date.now();
      await changeTracker({ datasetId, tableId }).record(events);
      const duration = Date.now() - start;

      await testUtils.waitForRawTableRowCount(
        process.env.PROJECT_ID,
        datasetId,
        tableId,
        eventCount
      );

      expect(duration).toBeLessThan(30000);
    });
  });
});
