import { BigQuery } from "@google-cloud/bigquery";
import { FirestoreDocumentChangeEvent } from "../..";
import { changeTracker, changeTrackerEvent } from "../fixtures/changeTracker";
import { deleteTable } from "../fixtures/clearTables";

import {
  tableRequiresUpdate,
  viewRequiresUpdate,
} from "../../bigquery/checkUpdates";

process.env.PROJECT_ID = "dev-extensions-testing";

const bq: BigQuery = new BigQuery({ projectId: process.env.PROJECT_ID });
const event: FirestoreDocumentChangeEvent = changeTrackerEvent({});
let randomID: string;
let datasetId: string;
let tableId: string;
let tableId_raw: string;
describe("Checking updates", () => {
  describe("for a table", () => {
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
    describe("clustering", () => {
      test("does not update the table metadata is clustering is unchanged as an empty array", async () => {
        await changeTracker({
          datasetId,
          tableId,
          clustering: [],
        }).record([event]);

        const raw_changelog_table = bq.dataset(datasetId).table(tableId_raw);
        const [metadata] = await raw_changelog_table.getMetadata();

        expect(
          await tableRequiresUpdate({
            table: raw_changelog_table,
            config: {
              clustering: [],
              datasetId,
              tableId,
            },
            documentIdColExists: true,
            pathParamsColExists: false,
            oldDataColExists: true,
          })
        ).toBe(false);
      });

      test("successfully updates metadata when adding a new clustering option", async () => {
        await changeTracker({
          datasetId,
          tableId,
          clustering: ["test1"],
        }).record([event]);

        const raw_changelog_table = bq.dataset(datasetId).table(tableId_raw);
        const [metadata] = await raw_changelog_table.getMetadata();

        expect(
          await tableRequiresUpdate({
            table: raw_changelog_table,
            config: {
              clustering: ["test1", "test2"],
              datasetId,
              tableId,
              datasetLocation: undefined,
              transformFunction: undefined,
              timePartitioning: undefined,
              timePartitioningField: undefined,
              timePartitioningFieldType: undefined,
              timePartitioningFirestoreField: undefined,
              bqProjectId: undefined,
            },
            documentIdColExists: true,
            pathParamsColExists: false,
            oldDataColExists: true,
          })
        ).toBe(true);
      });

      test("successfully updates metadata when updating an exiting clustering option", async () => {
        await changeTracker({
          datasetId,
          tableId,
          clustering: ["test1"],
        }).record([event]);

        const raw_changelog_table = bq.dataset(datasetId).table(tableId_raw);
        const [metadata] = await raw_changelog_table.getMetadata();

        expect(
          await tableRequiresUpdate({
            table: raw_changelog_table,
            config: {
              clustering: ["test2"],
              datasetId,
              tableId,
              datasetLocation: undefined,
              transformFunction: undefined,
              timePartitioning: undefined,
              timePartitioningField: undefined,
              timePartitioningFieldType: undefined,
              timePartitioningFirestoreField: undefined,
              bqProjectId: undefined,
            },
            documentIdColExists: true,
            pathParamsColExists: false,
            oldDataColExists: true,
          })
        ).toBe(true);
      });

      test("successfully updates metadata when changing the order of cluster options", async () => {
        await changeTracker({
          datasetId,
          tableId,
          clustering: ["test1", "test2"],
        }).record([event]);

        const raw_changelog_table = bq.dataset(datasetId).table(tableId_raw);

        expect(
          await tableRequiresUpdate({
            table: raw_changelog_table,
            config: {
              clustering: ["test2", "test1"],
              datasetId,
              tableId,
              datasetLocation: undefined,
              transformFunction: undefined,
              timePartitioning: undefined,
              timePartitioningField: undefined,
              timePartitioningFieldType: undefined,
              timePartitioningFirestoreField: undefined,
              bqProjectId: undefined,
            },
            documentIdColExists: true,
            pathParamsColExists: false,
            oldDataColExists: true,
          })
        ).toBe(true);
      });
    });

    describe("partitioning", () => {
      test("does not update the table metatdata on already partitioned table", async () => {
        await changeTracker({
          datasetId,
          tableId,
          timePartitioning: "DAY",
          timePartitioningField: "test",
          timePartitioningFieldType: "TIMESTAMP",
        }).record([event]);

        const raw_changelog_table = bq.dataset(datasetId).table(tableId_raw);

        expect(
          await tableRequiresUpdate({
            table: raw_changelog_table,
            config: {
              clustering: [],
              datasetId,
              tableId,
              datasetLocation: undefined,
              transformFunction: undefined,
              timePartitioning: undefined,
              timePartitioningField: undefined,
              timePartitioningFieldType: undefined,
              timePartitioningFirestoreField: undefined,
              bqProjectId: undefined,
            },
            documentIdColExists: true,
            pathParamsColExists: false,
            oldDataColExists: true,
          })
        ).toBe(false);
      });

      test("does not update the table metatdata with invalid config", async () => {
        await changeTracker({
          datasetId,
          tableId,
          timePartitioning: "DAY",
          timePartitioningField: "test",
          timePartitioningFieldType: "TIMESTAMP",
        }).record([event]);

        const raw_changelog_table = bq.dataset(datasetId).table(tableId_raw);
        const [metadata] = await raw_changelog_table.getMetadata();

        expect(
          await tableRequiresUpdate({
            table: raw_changelog_table,
            config: {
              clustering: [],
              datasetId,
              tableId,
              datasetLocation: undefined,
              transformFunction: undefined,
              timePartitioning: undefined,
              timePartitioningField: undefined,
              timePartitioningFieldType: undefined,
              timePartitioningFirestoreField: undefined,
              bqProjectId: undefined,
            },
            documentIdColExists: true,
            pathParamsColExists: false,
            oldDataColExists: true,
          })
        ).toBe(false);
      });

      test("successfully updates the table metatdata when valid partition config is provided", async () => {
        await changeTracker({
          datasetId,
          tableId,
        }).record([event]);

        const raw_changelog_table = bq.dataset(datasetId).table(tableId_raw);
        const [metadata] = await raw_changelog_table.getMetadata();

        expect(
          await tableRequiresUpdate({
            table: raw_changelog_table,
            config: {
              clustering: [],
              datasetId,
              tableId,
              timePartitioning: "DAY",
              timePartitioningField: "test",
              timePartitioningFieldType: "TIMESTAMP",
              timePartitioningFirestoreField: "test",
            },
            documentIdColExists: true,
            pathParamsColExists: false,
            oldDataColExists: true,
          })
        ).toBe(true);
      });
    });

    describe("wildcards", () => {
      test("does not update the table metatdata with no wildcard settings on a non-wildcarded table", async () => {
        await changeTracker({
          datasetId,
          tableId,
        }).record([event]);

        const raw_changelog_table = bq.dataset(datasetId).table(tableId_raw);

        expect(
          await tableRequiresUpdate({
            table: raw_changelog_table,
            config: {
              clustering: [],
              datasetId,
              tableId,
            },
            documentIdColExists: true,
            pathParamsColExists: false,
            oldDataColExists: true,
          })
        ).toBe(false);
      });

      test("successfully updates the table metatdata with valid configuration", async () => {
        await changeTracker({
          datasetId,
          tableId,
        }).record([event]);

        const raw_changelog_table = bq.dataset(datasetId).table(tableId_raw);

        expect(
          await tableRequiresUpdate({
            table: raw_changelog_table,
            config: {
              clustering: [],
              datasetId,
              tableId,
              wildcardIds: true,
            },
            documentIdColExists: true,
            pathParamsColExists: false,
            oldDataColExists: true,
          })
        ).toBe(true);
      });
    });
    describe("old_data", () => {
      test("successfully updates the table with the new old_data column", async () => {
        await changeTracker({
          datasetId,
          tableId,
        }).record([event]);

        const raw_changelog_table = bq.dataset(datasetId).table(tableId_raw);

        expect(
          await tableRequiresUpdate({
            table: raw_changelog_table,
            config: {
              clustering: [],
              datasetId,
              tableId,
            },
            documentIdColExists: true,
            pathParamsColExists: true,
            oldDataColExists: false,
          })
        ).toBe(true);
      });
    });
  });

  describe("for a view", () => {
    beforeEach(() => {
      randomID = (Math.random() + 1).toString(36).substring(7);
      datasetId = `dataset_${randomID}`;
      tableId = `table_${randomID}`;
      tableId_raw = `${tableId}_raw_latest`;
    });

    afterEach(async () => {
      await deleteTable({
        datasetId,
      });
    });

    describe("clustering", () => {
      test("does not update the table metatdata is clustering is unchanged as an empty array", async () => {
        await changeTracker({
          datasetId,
          tableId,
          clustering: [],
        }).record([event]);

        const raw_changelog_table = bq.dataset(datasetId).table(tableId_raw);
        const [metadata] = await raw_changelog_table.getMetadata();

        expect(
          viewRequiresUpdate({
            config: {
              clustering: [],
              datasetId,
              tableId,
            },
            documentIdColExists: true,
            pathParamsColExists: false,
            oldDataColExists: true,
          })
        ).toBe(false);
      });

      test("does not update the metadata when adding a new clustering option", async () => {
        await changeTracker({
          datasetId,
          tableId,
          clustering: ["test1"],
        }).record([event]);

        const raw_changelog_table = bq.dataset(datasetId).table(tableId_raw);
        const [metadata] = await raw_changelog_table.getMetadata();

        expect(
          viewRequiresUpdate({
            config: {
              clustering: ["test1", "test2"],
              datasetId,
              tableId,
              datasetLocation: undefined,
              transformFunction: undefined,
              timePartitioning: undefined,
              timePartitioningField: undefined,
              timePartitioningFieldType: undefined,
              timePartitioningFirestoreField: undefined,
              bqProjectId: undefined,
            },
            documentIdColExists: true,
            pathParamsColExists: false,
            oldDataColExists: true,
          })
        ).toBe(false);
      });

      test("does not update the metadata when updating an exiting clustering option", async () => {
        await changeTracker({
          datasetId,
          tableId,
          clustering: ["test1"],
        }).record([event]);

        const raw_changelog_table = bq.dataset(datasetId).table(tableId_raw);
        const [metadata] = await raw_changelog_table.getMetadata();

        expect(
          viewRequiresUpdate({
            config: {
              clustering: ["test2"],
              datasetId,
              tableId,
              datasetLocation: undefined,
              transformFunction: undefined,
              timePartitioning: undefined,
              timePartitioningField: undefined,
              timePartitioningFieldType: undefined,
              timePartitioningFirestoreField: undefined,
              bqProjectId: undefined,
            },
            documentIdColExists: true,
            pathParamsColExists: false,
            oldDataColExists: true,
          })
        ).toBe(false);
      });

      test("does not update the metadata when changing the order of cluster options", async () => {
        await changeTracker({
          datasetId,
          tableId,
          clustering: ["test1", "test2"],
        }).record([event]);

        const raw_changelog_table = bq.dataset(datasetId).table(tableId_raw);

        expect(
          viewRequiresUpdate({
            config: {
              clustering: ["test2", "test1"],
              datasetId,
              tableId,
              datasetLocation: undefined,
              transformFunction: undefined,
              timePartitioning: undefined,
              timePartitioningField: undefined,
              timePartitioningFieldType: undefined,
              timePartitioningFirestoreField: undefined,
              bqProjectId: undefined,
            },
            documentIdColExists: true,
            pathParamsColExists: false,
            oldDataColExists: true,
          })
        ).toBe(false);
      });
    });

    describe("partitioning", () => {
      test("does not update the table metatdata on already partitioned table", async () => {
        await changeTracker({
          datasetId,
          tableId,
          timePartitioning: "DAY",
          timePartitioningField: "test",
          timePartitioningFieldType: "TIMESTAMP",
        }).record([event]);

        expect(
          viewRequiresUpdate({
            config: {
              clustering: [],
              datasetId,
              tableId,
              datasetLocation: undefined,
              transformFunction: undefined,
              timePartitioning: undefined,
              timePartitioningField: undefined,
              timePartitioningFieldType: undefined,
              timePartitioningFirestoreField: undefined,
              bqProjectId: undefined,
            },
            documentIdColExists: true,
            pathParamsColExists: false,
            oldDataColExists: true,
          })
        ).toBe(false);
      });

      test("does not update the table metatdata with invalid config", async () => {
        await changeTracker({
          datasetId,
          tableId,
          timePartitioning: "DAY",
          timePartitioningField: "test",
          timePartitioningFieldType: "TIMESTAMP",
        }).record([event]);

        const raw_changelog_table = bq.dataset(datasetId).table(tableId_raw);
        const [metadata] = await raw_changelog_table.getMetadata();

        expect(
          viewRequiresUpdate({
            config: {
              clustering: [],
              datasetId,
              tableId,
              datasetLocation: undefined,
              transformFunction: undefined,
              timePartitioning: undefined,
              timePartitioningField: undefined,
              timePartitioningFieldType: undefined,
              timePartitioningFirestoreField: undefined,
              bqProjectId: undefined,
            },
            documentIdColExists: true,
            pathParamsColExists: false,
            oldDataColExists: true,
          })
        ).toBe(false);
      });

      test("does not update the table metatdata when valid partition config is provided", async () => {
        await changeTracker({
          datasetId,
          tableId,
        }).record([event]);

        const raw_changelog_table = bq.dataset(datasetId).table(tableId_raw);
        const [metadata] = await raw_changelog_table.getMetadata();

        expect(
          viewRequiresUpdate({
            config: {
              clustering: [],
              datasetId,
              tableId,
              timePartitioning: "DAY",
              timePartitioningField: "test",
              timePartitioningFieldType: "TIMESTAMP",
              timePartitioningFirestoreField: "test",
            },
            documentIdColExists: true,
            pathParamsColExists: false,
            oldDataColExists: true,
          })
        ).toBe(false);
      });
    });

    describe("wildcards", () => {
      test("does not update the table metatdata with no wildcard settings on a non-wildcarded table", async () => {
        await changeTracker({
          datasetId,
          tableId,
        }).record([event]);

        expect(
          viewRequiresUpdate({
            config: {
              clustering: [],
              datasetId,
              tableId,
            },
            documentIdColExists: true,
            pathParamsColExists: false,
            oldDataColExists: true,
          })
        ).toBe(false);
      });

      test("successfully updates the table metatdata with valid configuration", async () => {
        await changeTracker({
          datasetId,
          tableId,
        }).record([event]);

        expect(
          viewRequiresUpdate({
            config: {
              clustering: [],
              datasetId,
              tableId,
              wildcardIds: true,
            },
            documentIdColExists: true,
            pathParamsColExists: false,
            oldDataColExists: true,
          })
        ).toBe(true);
      });

      test("successfully updates the table metatdata with when switching off wildcards configuration", async () => {
        await changeTracker({
          datasetId,
          tableId,
          wildcardIds: false,
        }).record([event]);

        expect(
          viewRequiresUpdate({
            config: {
              clustering: [],
              datasetId,
              tableId,
              wildcardIds: false,
            },
            documentIdColExists: true,
            pathParamsColExists: true,
            oldDataColExists: true,
          })
        ).toBe(true);
      });
    });

    describe("useNewViewSyntax", () => {
      test("successfully updates the view if opt-in is selected and the current query is a legacy query ", async () => {
        await changeTracker({
          datasetId,
          tableId,
        }).record([event]);

        const raw_changelog_table = bq.dataset(datasetId).table(tableId_raw);
        const [metadata] = await raw_changelog_table.getMetadata();

        expect(
          viewRequiresUpdate({
            metadata,
            config: {
              clustering: [],
              useNewSnapshotQuerySyntax: true,
              datasetId,
              tableId,
            },
            documentIdColExists: true,
            pathParamsColExists: false,
            oldDataColExists: true,
          })
        ).toBe(true);
      });

      test("does not update view if opt-in is selected and the current query has been already updated ", async () => {
        await changeTracker({
          datasetId,
          tableId,
          useNewSnapshotQuerySyntax: true,
        }).record([event]);

        const raw_changelog_table = bq.dataset(datasetId).table(tableId_raw);
        const [metadata] = await raw_changelog_table.getMetadata();

        expect(
          viewRequiresUpdate({
            metadata,
            config: {
              clustering: [],
              useNewSnapshotQuerySyntax: true,
              datasetId,
              tableId,
            },
            documentIdColExists: true,
            pathParamsColExists: false,
            oldDataColExists: true,
          })
        ).toBe(false);
      });

      test("successfully updates the view if opt-in is not selected and the current query has been already updated ", async () => {
        await changeTracker({
          datasetId,
          tableId,
          useNewSnapshotQuerySyntax: true,
        }).record([event]);

        const raw_changelog_table = bq.dataset(datasetId).table(tableId_raw);
        const [metadata] = await raw_changelog_table.getMetadata();

        expect(
          viewRequiresUpdate({
            metadata,
            config: {
              clustering: [],
              datasetId,
              tableId,
            },
            documentIdColExists: true,
            pathParamsColExists: false,
            oldDataColExists: true,
          })
        ).toBe(true);
      });

      test("does not update view if opt-in is not selected and the current query is a legacy query ", async () => {
        await changeTracker({
          datasetId,
          tableId,
        }).record([event]);

        const raw_changelog_table = bq.dataset(datasetId).table(tableId_raw);
        const [metadata] = await raw_changelog_table.getMetadata();

        expect(
          viewRequiresUpdate({
            metadata,
            config: {
              clustering: [],
              datasetId,
              tableId,
            },
            documentIdColExists: true,
            pathParamsColExists: false,
            oldDataColExists: true,
          })
        ).toBe(false);
      });
      test("updates view if no existing view/table", async () => {
        expect(
          viewRequiresUpdate({
            config: {
              clustering: [],
              datasetId,
              tableId,
            },
            documentIdColExists: true,
            pathParamsColExists: false,
            oldDataColExists: true,
          })
        ).toBe(false);
      });
    });

    describe("old_data", () => {
      test("successfully updates the view with the new old_data column", async () => {
        await changeTracker({
          datasetId,
          tableId,
        }).record([event]);

        const raw_changelog_table = bq.dataset(datasetId).table(tableId_raw);

        const [metadata] = await raw_changelog_table.getMetadata();

        expect(
          viewRequiresUpdate({
            metadata,
            config: {
              clustering: [],
              useNewSnapshotQuerySyntax: true,
              datasetId,
              tableId,
            },
            documentIdColExists: true,
            pathParamsColExists: true,
            oldDataColExists: false,
          })
        ).toBe(true);
      });
    });
  });
});
