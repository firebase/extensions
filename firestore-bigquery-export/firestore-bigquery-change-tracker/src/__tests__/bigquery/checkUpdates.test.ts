import { BigQuery, Dataset, Table } from "@google-cloud/bigquery";
import { FirestoreDocumentChangeEvent } from "../..";
import { RawChangelogSchema } from "../../bigquery/schema";
import { changeTracker, changeTrackerEvent } from "../fixtures/changeTracker";
import { deleteTable } from "../fixtures/clearTables";

import {
  tableRequiresUpdate,
  viewRequiresUpdate,
} from "../../bigquery/checkUpdates";

process.env.PROJECT_ID = "extensions-testing";

const bq: BigQuery = new BigQuery();
const event: FirestoreDocumentChangeEvent = changeTrackerEvent({});
let randomID: string;
let datasetId: string;
let tableId: string;
let tableId_raw: string;

const { logger } = require("firebase-functions");

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
      test("does not update the table metatdata is clustering is unchanged as an empty array", async () => {
        await changeTracker({
          datasetId,
          tableId,
          clustering: [],
        }).record([event]);

        const raw_changelog_table = bq.dataset(datasetId).table(tableId_raw);
        const [metadata] = await raw_changelog_table.getMetadata();

        expect(
          await tableRequiresUpdate(
            raw_changelog_table,
            {
              clustering: [],
              datasetId,
              tableId,
            },
            metadata.schema.fields,
            true,
            true
          )
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
          await tableRequiresUpdate(
            raw_changelog_table,
            {
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
            metadata.schema.fields,
            true,
            true
          )
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
          await tableRequiresUpdate(
            raw_changelog_table,
            {
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
            metadata.schema.fields,
            true,
            true
          )
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
          await tableRequiresUpdate(
            raw_changelog_table,
            {
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
            [],
            true,
            true
          )
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
          await tableRequiresUpdate(
            raw_changelog_table,
            {
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
            [],
            true,
            true
          )
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
          await tableRequiresUpdate(
            raw_changelog_table,
            {
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
            metadata.schema.fields,
            true,
            true
          )
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
          await tableRequiresUpdate(
            raw_changelog_table,
            {
              clustering: [],
              datasetId,
              tableId,
              timePartitioning: "DAY",
              timePartitioningField: "test",
              timePartitioningFieldType: "TIMESTAMP",
              timePartitioningFirestoreField: "test",
            },
            metadata.schema.fields,
            true,
            true
          )
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
          await tableRequiresUpdate(
            raw_changelog_table,
            {
              clustering: [],
              datasetId,
              tableId,
            },
            [],
            true,
            true
          )
        ).toBe(false);
      });

      test("successfully updates the table metatdata with valid configuration", async () => {
        await changeTracker({
          datasetId,
          tableId,
        }).record([event]);

        const raw_changelog_table = bq.dataset(datasetId).table(tableId_raw);

        expect(
          await tableRequiresUpdate(
            raw_changelog_table,
            {
              clustering: [],
              datasetId,
              tableId,
              wildcardIds: true,
            },
            [],
            true,
            true
          )
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
          viewRequiresUpdate(
            {
              clustering: [],
              datasetId,
              tableId,
            },
            metadata.schema.fields,
            true,
            true
          )
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
          viewRequiresUpdate(
            {
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
            metadata.schema.fields,
            true,
            true
          )
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
          await viewRequiresUpdate(
            {
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
            metadata.schema.fields,
            true,
            true
          )
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
          await viewRequiresUpdate(
            {
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
            [],
            true,
            true
          )
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
          await viewRequiresUpdate(
            {
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
            [],
            true,
            true
          )
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
          await viewRequiresUpdate(
            {
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
            metadata.schema.fields,
            true,
            true
          )
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
          await viewRequiresUpdate(
            {
              clustering: [],
              datasetId,
              tableId,
              timePartitioning: "DAY",
              timePartitioningField: "test",
              timePartitioningFieldType: "TIMESTAMP",
              timePartitioningFirestoreField: "test",
            },
            metadata.schema.fields,
            true,
            true
          )
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
          await viewRequiresUpdate(
            {
              clustering: [],
              datasetId,
              tableId,
            },
            [],
            true,
            true
          )
        ).toBe(false);
      });

      test("successfully updates the table metatdata with valid configuration", async () => {
        await changeTracker({
          datasetId,
          tableId,
        }).record([event]);

        expect(
          viewRequiresUpdate(
            {
              clustering: [],
              datasetId,
              tableId,
              wildcardIds: true,
            },
            [],
            true,
            true
          )
        ).toBe(true);
      });
    });
  });
});
