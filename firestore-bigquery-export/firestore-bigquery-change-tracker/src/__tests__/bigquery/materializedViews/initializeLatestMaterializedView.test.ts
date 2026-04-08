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

import { logger } from "../../../logger";

import * as functions from "firebase-functions";

const functionsLogger = functions.logger;
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
    jest.spyOn(logger, "debug").mockImplementation(() => {});
    jest.spyOn(logger, "info").mockImplementation(() => {});
    jest.spyOn(logger, "warn").mockImplementation(() => {});
    jest.spyOn(logger, "error").mockImplementation(() => {});

    jest.spyOn(functionsLogger, "debug").mockImplementation(() => {});
    jest.spyOn(functionsLogger, "info").mockImplementation(() => {});
    jest.spyOn(functionsLogger, "warn").mockImplementation(() => {});
    jest.spyOn(functionsLogger, "error").mockImplementation(() => {});
    jest.spyOn(functionsLogger, "log").mockImplementation(() => {});
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
    // For logger (these should work fine if they're real methods)
    if (logger.debug && jest.isMockFunction(logger.debug)) {
      (logger.debug as jest.Mock).mockRestore();
    }
    if (logger.info && jest.isMockFunction(logger.info)) {
      (logger.info as jest.Mock).mockRestore();
    }
    if (logger.warn && jest.isMockFunction(logger.warn)) {
      (logger.warn as jest.Mock).mockRestore();
    }
    if (logger.error && jest.isMockFunction(logger.error)) {
      (logger.error as jest.Mock).mockRestore();
    }

    // For functionsLogger, check if it's a mock function first
    if (functionsLogger.debug && jest.isMockFunction(functionsLogger.debug)) {
      (functionsLogger.debug as jest.Mock).mockReset();
    }
    if (functionsLogger.info && jest.isMockFunction(functionsLogger.info)) {
      (functionsLogger.info as jest.Mock).mockReset();
    }
    if (functionsLogger.warn && jest.isMockFunction(functionsLogger.warn)) {
      (functionsLogger.warn as jest.Mock).mockReset();
    }
    if (functionsLogger.error && jest.isMockFunction(functionsLogger.error)) {
      (functionsLogger.error as jest.Mock).mockReset();
    }
    if (functionsLogger.log && jest.isMockFunction(functionsLogger.log)) {
      (functionsLogger.log as jest.Mock).mockReset();
    }
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
