import { BigQuery, Dataset, Table } from "@google-cloud/bigquery";
import { FirestoreDocumentChangeEvent } from "../..";
import { RawChangelogSchema } from "../../bigquery";
import { changeTracker, changeTrackerEvent } from "../fixtures/changeTracker";
import { deleteTable } from "../fixtures/clearTables";

process.env.PROJECT_ID = "dev-extensions-testing";

const bq = new BigQuery({ projectId: process.env.PROJECT_ID });
let event: FirestoreDocumentChangeEvent;
let randomID: string;
let datasetId: string;
let tableId: string;
let tableId_raw: string;
let viewId_raw: string;
let dataset: Dataset;
let table: Table;
let view: Table;

describe("Configuring a document wildcard column ", () => {
  beforeEach(() => {
    randomID = (Math.random() + 1).toString(36).substring(7);
    datasetId = `dataset_${randomID}`;
    tableId = `table_${randomID}`;
    tableId_raw = `${tableId}_raw_changelog`;
    viewId_raw = `${tableId}_raw_latest`;
    dataset = bq.dataset(datasetId);
  });

  afterEach(async () => {
    // await deleteTable({
    //   datasetId,
    // });
  });

  describe("A non existing table", () => {
    test("Successfully adds a path_params column with single JSON param when a collection path has a single wildcard.", async () => {
      event = changeTrackerEvent({
        pathParams: { documentId: "123", postId: "post1" },
      });

      await changeTracker({
        datasetId,
        tableId,
        wildcardIds: true,
      }).record([event]);

      table = bq.dataset(datasetId).table(tableId_raw);

      const [metadata] = await table.getMetadata();

      const isPathParamSchemaExist = metadata.schema.fields.find(
        (column) => column.name === "path_params"
      );

      expect(isPathParamSchemaExist).toBeTruthy();

      const rows = await table.getRows();
      const path_params = JSON.parse(rows[0][0].path_params);

      expect(path_params.postId).toBe("post1");
    });

    test("Successfully adds a path_params column with multiple ids a collection path has more than one wildcard", async () => {
      event = changeTrackerEvent({
        pathParams: { documentId: "123", postId: "post1", userId: "user1" },
      });

      await changeTracker({
        datasetId,
        tableId,
        wildcardIds: true,
      }).record([event]);

      table = bq.dataset(datasetId).table(tableId_raw);

      view = bq.dataset(datasetId).table(viewId_raw);

      const [changeLogMetaData] = await table.getMetadata();

      const [latestViewMetaData] = await view.getMetadata();

      const isChangelogPathParams = changeLogMetaData.schema.fields.find(
        (column) => column.name === "path_params"
      );

      const isViewPathParams = latestViewMetaData.schema.fields.find(
        (column) => column.name === "path_params"
      );

      expect(isChangelogPathParams).toBeTruthy();
      expect(isViewPathParams).toBeTruthy();

      const rows = await table.getRows();
      const path_params = JSON.parse(rows[0][0].path_params);

      expect(path_params.postId).toBe("post1");
      expect(path_params.userId).toBe("user1");
    });

    test("Successfully adds a path_params column with an empty JSON object if a collection path has no wildcards", async () => {
      event = changeTrackerEvent({
        pathParams: { documentId: "123" },
      });
      await changeTracker({
        datasetId,
        tableId,
        wildcardIds: true,
      }).record([event]);

      table = bq.dataset(datasetId).table(tableId_raw);

      view = bq.dataset(datasetId).table(viewId_raw);

      const [changeLogMetaData] = await table.getMetadata();

      const [latestViewMetaData] = await view.getMetadata();

      const isChangelogPathParams = changeLogMetaData.schema.fields.find(
        (column) => column.name === "path_params"
      );

      const isViewPathParams = latestViewMetaData.schema.fields.find(
        (column) => column.name === "path_params"
      );

      expect(isChangelogPathParams).toBeTruthy();
      expect(isViewPathParams).toBeTruthy();

      const rows = await table.getRows();
      const path_params = JSON.parse(rows[0][0].path_params);

      expect(path_params.documentId).toBeUndefined();
    });
  });

  describe("An already existing table", () => {
    beforeEach(async () => {
      [dataset] = await bq.dataset(datasetId).create();
      [table] = await dataset.createTable(tableId, {
        timePartitioning: { type: "HOUR" },
        schema: RawChangelogSchema,
      });
    });

    test("Successfully adds a path_params column with a single JSON param when a collection path has a single wildcard.", async () => {
      event = changeTrackerEvent({
        pathParams: { documentId: "123", postId: "post1" },
      });
      await changeTracker({
        datasetId,
        tableId,
        wildcardIds: true,
      }).record([event]);

      table = bq.dataset(datasetId).table(tableId_raw);

      view = bq.dataset(datasetId).table(viewId_raw);

      const [changeLogMetaData] = await table.getMetadata();

      const [latestViewMetaData] = await view.getMetadata();

      const isChangelogPathParams = changeLogMetaData.schema.fields.find(
        (column) => column.name === "path_params"
      );

      const isViewPathParams = latestViewMetaData.schema.fields.find(
        (column) => column.name === "path_params"
      );

      expect(isChangelogPathParams).toBeTruthy();
      expect(isViewPathParams).toBeTruthy();

      const rows = await table.getRows();
      const path_params = JSON.parse(rows[0][0].path_params);

      expect(path_params.documentId).toBeUndefined();
      expect(path_params.postId).toBe("post1");
    });

    test("Successfully adds a path_params column with multiple ids a collection path has more than one wildcard", async () => {
      event = changeTrackerEvent({
        pathParams: { documentId: "123", postId: "post1", userId: "user1" },
      });
      await changeTracker({
        datasetId,
        tableId,
        wildcardIds: true,
      }).record([event]);

      table = bq.dataset(datasetId).table(tableId_raw);

      view = bq.dataset(datasetId).table(viewId_raw);

      const [changeLogMetaData] = await table.getMetadata();

      const [latestViewMetaData] = await view.getMetadata();

      const isChangelogPathParams = changeLogMetaData.schema.fields.find(
        (column) => column.name === "path_params"
      );

      const isViewPathParams = latestViewMetaData.schema.fields.find(
        (column) => column.name === "path_params"
      );

      expect(isChangelogPathParams).toBeTruthy();
      expect(isViewPathParams).toBeTruthy();

      const rows = await table.getRows();
      const path_params = JSON.parse(rows[0][0].path_params);

      expect(path_params.documentId).toBeUndefined();
      expect(path_params.postId).toBe("post1");
      expect(path_params.userId).toBe("user1");
    });

    test("Successfully adds a path_params column with an empty JSON object if a collection path has no wildcards", async () => {
      event = changeTrackerEvent({
        pathParams: { documentId: "123" },
      });

      await changeTracker({
        datasetId,
        tableId,
        wildcardIds: true,
      }).record([event]);

      table = bq.dataset(datasetId).table(tableId_raw);

      view = bq.dataset(datasetId).table(viewId_raw);

      const [changeLogMetaData] = await table.getMetadata();

      const [latestViewMetaData] = await view.getMetadata();

      const isChangelogPathParams = changeLogMetaData.schema.fields.find(
        (column) => column.name === "path_params"
      );

      const isViewPathParams = latestViewMetaData.schema.fields.find(
        (column) => column.name === "path_params"
      );

      expect(isChangelogPathParams).toBeTruthy();
      expect(isViewPathParams).toBeTruthy();

      const rows = await table.getRows();
      const path_params = JSON.parse(rows[0][0].path_params);

      expect(path_params.documentId).toBeUndefined();
      expect(path_params.postId).toBeUndefined();
      expect(path_params.userId).toBeUndefined();
      expect(path_params).toBeInstanceOf(Object);
    });

    test("Does not add a path_params column if wilcard config has not been included", async () => {
      event = changeTrackerEvent({
        pathParams: { documentId: "123", postId: "post1", userId: "user1" },
      });
      await changeTracker({
        datasetId,
        tableId,
      }).record([event]);

      table = bq.dataset(datasetId).table(tableId_raw);

      view = bq.dataset(datasetId).table(viewId_raw);

      const [changeLogMetaData] = await table.getMetadata();

      const [latestViewMetaData] = await view.getMetadata();

      const isChangelogPathParams = changeLogMetaData.schema.fields.find(
        (column) => column.name === "path_params"
      );

      const isViewPathParams = latestViewMetaData.schema.fields.find(
        (column) => column.name === "path_params"
      );

      expect(isChangelogPathParams).toBeFalsy();
      expect(isViewPathParams).toBeFalsy();

      const rows = await table.getRows();
      const path_params = rows[0][0].path_params;

      expect(path_params).toBeUndefined();
    });
  });
});
