import {
  BigQuery,
  Dataset,
  TableMetadata,
  Table,
} from "@google-cloud/bigquery";
import { firestore } from "firebase-admin";
import { RawChangelogViewSchema } from "../../../bigquery/schema";
import { initializeLatestMaterializedView } from "../../../bigquery/initializeLatestMaterializedView";
import {
  changeTracker,
  changeTrackerEvent,
} from "../../fixtures/changeTracker";
import { deleteTable } from "../../fixtures/clearTables";
import * as logs from "../../../logs";

jest.mock("../../../logs");
// jest.mock("sql-formatter");

describe("initializeLatestMaterializedView", () => {
  const projectId = "dev-extensions-testing";
  const bq = new BigQuery({ projectId });

  let dataset: Dataset;
  let table: Table;
  let testConfig: {
    datasetId: string;
    tableId: string;
    tableIdRaw: string;
    viewIdRaw: string;
  };

  beforeEach(async () => {
    const randomId = (Math.random() + 1).toString(36).substring(7);
    testConfig = {
      datasetId: `dataset_${randomId}`,
      tableId: `table_${randomId}`,
      tableIdRaw: `table_${randomId}_raw_changelog`,
      viewIdRaw: `table_${randomId}_raw_latest`,
    };
    dataset = bq.dataset(testConfig.datasetId);
    table = dataset.table(testConfig.tableIdRaw);

    await dataset.create();

    await table.create({ schema: RawChangelogViewSchema });
  });

  afterEach(async () => {
    await deleteTable({ datasetId: testConfig.datasetId });
  });

  test("creates a new materialized view when view does not exist", async () => {
    const view = dataset.table(testConfig.viewIdRaw);
    const config = {
      datasetId: testConfig.datasetId,
      tableId: testConfig.tableId,
      useMaterializedView: true,
      useIncrementalMaterializedView: false,
      maxStaleness: `INTERVAL "4:0:0" HOUR TO SECOND`,
      refreshIntervalMinutes: 5,
      clustering: null,
    };

    await initializeLatestMaterializedView({
      bq,
      changeTrackerConfig: config,
      view,
      viewExists: false,
      rawChangeLogTableName: testConfig.tableIdRaw,
      rawLatestViewName: testConfig.viewIdRaw,
      schema: RawChangelogViewSchema,
    });

    const [metadata] = (await view.getMetadata()) as unknown as [TableMetadata];
    expect(metadata.materializedView).toBeDefined();
    expect(metadata.materializedView?.enableRefresh).toBe(true);
    expect(
      metadata.materializedView?.allowNonIncrementalDefinition
    ).toBeDefined();
  });

  test("does not recreate view if configuration matches", async () => {
    const event = changeTrackerEvent({
      data: { end_date: firestore.Timestamp.now() },
      eventId: "testing2",
    });

    await changeTracker({
      datasetId: testConfig.datasetId,
      tableId: testConfig.tableId,
      useMaterializedView: true,
      useIncrementalMaterializedView: true,
    }).record([event]);

    const view = dataset.table(testConfig.viewIdRaw);
    const config = {
      datasetId: testConfig.datasetId,
      tableId: testConfig.tableId,
      useMaterializedView: true,
      useIncrementalMaterializedView: true,
      clustering: null,
    };

    const [initialMetadata] = (await view.getMetadata()) as unknown as [
      TableMetadata
    ];

    await initializeLatestMaterializedView({
      bq,
      changeTrackerConfig: config,
      view,
      viewExists: true,
      rawChangeLogTableName: testConfig.tableIdRaw,
      rawLatestViewName: testConfig.viewIdRaw,
      schema: RawChangelogViewSchema,
    });

    const [finalMetadata] = (await view.getMetadata()) as unknown as [
      TableMetadata
    ];
    expect(finalMetadata).toEqual(initialMetadata);
  });

  test("recreates view when switching from incremental to non-incremental", async () => {
    const event = changeTrackerEvent({
      data: { end_date: firestore.Timestamp.now() },
      eventId: "testing3",
    });

    await changeTracker({
      datasetId: testConfig.datasetId,
      tableId: testConfig.tableId,
      useMaterializedView: true,
      useIncrementalMaterializedView: true,
    }).record([event]);

    const view = dataset.table(testConfig.viewIdRaw);
    const newConfig = {
      datasetId: testConfig.datasetId,
      tableId: testConfig.tableId,
      useMaterializedView: true,
      maxStaleness: `INTERVAL "4:0:0" HOUR TO SECOND`,
      refreshIntervalMinutes: 5,
      clustering: null,
    };

    const [initialMetadata] = (await view.getMetadata()) as unknown as [
      TableMetadata
    ];
    expect(
      initialMetadata.materializedView?.allowNonIncrementalDefinition
    ).toBeUndefined();

    await initializeLatestMaterializedView({
      bq,
      changeTrackerConfig: newConfig,
      view,
      viewExists: true,
      rawChangeLogTableName: testConfig.tableIdRaw,
      rawLatestViewName: testConfig.viewIdRaw,
      schema: RawChangelogViewSchema,
    });

    const [finalMetadata] = (await view.getMetadata()) as unknown as [
      TableMetadata
    ];
    expect(
      finalMetadata.materializedView?.allowNonIncrementalDefinition
    ).toBeDefined();
  });

  test("handles view creation errors", async () => {
    const view = dataset.table(testConfig.viewIdRaw);
    const invalidConfig = {
      datasetId: testConfig.datasetId,
      tableId: testConfig.tableId,
      useMaterializedView: true,
      maxStaleness: "invalid",
      clustering: null,
    };

    await expect(
      initializeLatestMaterializedView({
        bq,
        changeTrackerConfig: invalidConfig,
        view,
        viewExists: false,
        rawChangeLogTableName: testConfig.tableIdRaw,
        rawLatestViewName: testConfig.viewIdRaw,
        schema: RawChangelogViewSchema,
      })
    ).rejects.toThrow();

    expect(logs.tableCreationError).toHaveBeenCalled();
  });
});
