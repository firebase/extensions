import { BigQuery, Dataset, TableMetadata } from "@google-cloud/bigquery";
import { firestore } from "firebase-admin";
import { RawChangelogViewSchema } from "../../../bigquery/schema";
import {
  buildMaterializedViewQuery,
  buildNonIncrementalMaterializedViewQuery,
} from "../../../bigquery/snapshot";
import { shouldRecreateMaterializedView } from "../../../bigquery/initializeLatestMaterializedView";
import {
  changeTracker,
  changeTrackerEvent,
} from "../../fixtures/changeTracker";
import { deleteTable } from "../../fixtures/clearTables";

describe("Materialized View Recreation", () => {
  const projectId = "dev-extensions-testing";
  const bq = new BigQuery({ projectId });

  let dataset: Dataset;
  let testConfig: {
    datasetId: string;
    tableId: string;
    tableIdRaw: string;
    viewIdRaw: string;
  };

  beforeEach(() => {
    const randomId = (Math.random() + 1).toString(36).substring(7);
    testConfig = {
      datasetId: `dataset_${randomId}`,
      tableId: `table_${randomId}`,
      tableIdRaw: `table_${randomId}_raw_changelog`,
      viewIdRaw: `table_${randomId}_raw_latest`,
    };
    dataset = bq.dataset(testConfig.datasetId);
  });

  afterEach(async () => {
    await deleteTable({ datasetId: testConfig.datasetId });
  });

  test("should not recreate incremental materialized view when unchanged", async () => {
    // Create initial event
    const event = changeTrackerEvent({
      data: { end_date: firestore.Timestamp.now() },
      eventId: "testing2",
    });

    // Setup materialized view
    await changeTracker({
      datasetId: testConfig.datasetId,
      tableId: testConfig.tableId,
      useMaterializedView: true,
      useIncrementalMaterializedView: true,
    }).record([event]);

    // Verify view metadata
    const [metadata] = (await dataset
      .table(testConfig.viewIdRaw)
      .getMetadata()) as unknown as [TableMetadata];

    expect(metadata.materializedView).toBeDefined();
    expect(metadata.materializedView?.enableRefresh).toBe(true);
    expect(
      metadata.materializedView?.allowNonIncrementalDefinition
    ).toBeUndefined();

    // Check if view needs recreation
    const view = dataset.table(testConfig.viewIdRaw);
    const config = {
      datasetId: testConfig.datasetId,
      tableId: testConfig.tableId,
      useMaterializedView: true,
      useIncrementalMaterializedView: true,
      clustering: null,
    };

    const { source } = buildMaterializedViewQuery({
      schema: RawChangelogViewSchema,
      projectId,
      datasetId: config.datasetId,
      tableName: testConfig.tableIdRaw,
      rawLatestViewName: testConfig.viewIdRaw,
    });

    const shouldRecreate = await shouldRecreateMaterializedView(
      view,
      config,
      source
    );
    expect(shouldRecreate).toBe(false);
  });

  test("should not recreate non-incremental materialized view when unchanged", async () => {
    // Create initial event
    const event = changeTrackerEvent({
      data: { end_date: firestore.Timestamp.now() },
      eventId: "testing2",
    });

    // Setup materialized view
    await changeTracker({
      datasetId: testConfig.datasetId,
      tableId: testConfig.tableId,
      useMaterializedView: true,
      maxStaleness: `INTERVAL "4:0:0" HOUR TO SECOND`,
      refreshIntervalMinutes: 5,
      clustering: null,
    }).record([event]);

    // // Verify view metadata
    const [metadata] = (await dataset
      .table(testConfig.viewIdRaw)
      .getMetadata()) as unknown as [TableMetadata];

    expect(metadata.materializedView).toBeDefined();
    expect(metadata.materializedView?.enableRefresh).toBe(true);
    expect(
      metadata.materializedView?.allowNonIncrementalDefinition
    ).toBeDefined();

    // Check if view needs recreation
    const view = dataset.table(testConfig.viewIdRaw);
    const config = {
      datasetId: testConfig.datasetId,
      tableId: testConfig.tableId,
      useMaterializedView: true,
      maxStaleness: `INTERVAL "4:0:0" HOUR TO SECOND`,
      refreshIntervalMinutes: 5,
      clustering: null,
    };

    const { source } = buildNonIncrementalMaterializedViewQuery({
      schema: RawChangelogViewSchema,
      projectId,
      datasetId: config.datasetId,
      tableName: testConfig.tableIdRaw,
      rawLatestViewName: testConfig.viewIdRaw,
    });

    const shouldRecreate = await shouldRecreateMaterializedView(
      view,
      config,
      source
    );
    expect(shouldRecreate).toBe(false);
  });

  test("should recreate materialized view when inc -> non-inc ", async () => {
    // Create initial event
    const event = changeTrackerEvent({
      data: { end_date: firestore.Timestamp.now() },
      eventId: "testing2",
    });

    // Setup materialized view
    await changeTracker({
      datasetId: testConfig.datasetId,
      tableId: testConfig.tableId,
      useMaterializedView: true,
      useIncrementalMaterializedView: true,
    }).record([event]);

    // Verify view metadata
    const [metadata] = (await dataset
      .table(testConfig.viewIdRaw)
      .getMetadata()) as unknown as [TableMetadata];

    expect(metadata.materializedView).toBeDefined();
    expect(metadata.materializedView?.enableRefresh).toBe(true);
    expect(
      metadata.materializedView?.allowNonIncrementalDefinition
    ).toBeUndefined();

    // Check if view needs recreation
    const view = dataset.table(testConfig.viewIdRaw);
    const config = {
      datasetId: testConfig.datasetId,
      tableId: testConfig.tableId,
      useMaterializedView: true,
      maxStaleness: `INTERVAL "4:0:0" HOUR TO SECOND`,
      refreshIntervalMinutes: 5,
      clustering: null,
    };

    const { source } = buildNonIncrementalMaterializedViewQuery({
      schema: RawChangelogViewSchema,
      projectId,
      datasetId: config.datasetId,
      tableName: testConfig.tableIdRaw,
      rawLatestViewName: testConfig.viewIdRaw,
    });

    const shouldRecreate = await shouldRecreateMaterializedView(
      view,
      config,
      source
    );
    expect(shouldRecreate).toBe(true);
  });

  test("should recreate materialized view when non-inc -> inc ", async () => {
    // Create initial event
    const event = changeTrackerEvent({
      data: { end_date: firestore.Timestamp.now() },
      eventId: "testing2",
    });

    // Setup materialized view
    await changeTracker({
      datasetId: testConfig.datasetId,
      tableId: testConfig.tableId,
      useMaterializedView: true,
      maxStaleness: `INTERVAL "4:0:0" HOUR TO SECOND`,
      refreshIntervalMinutes: 5,
      clustering: null,
    }).record([event]);

    // Verify view metadata
    const [metadata] = (await dataset
      .table(testConfig.viewIdRaw)
      .getMetadata()) as unknown as [TableMetadata];

    expect(metadata.materializedView).toBeDefined();
    expect(metadata.materializedView?.enableRefresh).toBe(true);
    expect(
      metadata.materializedView?.allowNonIncrementalDefinition
    ).toBeDefined();

    // Check if view needs recreation
    const view = dataset.table(testConfig.viewIdRaw);
    const config = {
      datasetId: testConfig.datasetId,
      tableId: testConfig.tableId,
      useMaterializedView: true,
      useIncrementalMaterializedView: true,
      clustering: null,
    };

    const { source } = buildNonIncrementalMaterializedViewQuery({
      schema: RawChangelogViewSchema,
      projectId,
      datasetId: config.datasetId,
      tableName: testConfig.tableIdRaw,
      rawLatestViewName: testConfig.viewIdRaw,
    });

    const shouldRecreate = await shouldRecreateMaterializedView(
      view,
      config,
      source
    );
    expect(shouldRecreate).toBe(true);
  });
});
