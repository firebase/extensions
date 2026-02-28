import { BigQuery } from "@google-cloud/bigquery";
import { FirestoreDocumentChangeEvent } from "../..";

import { changeTracker, changeTrackerEvent } from "../fixtures/changeTracker";

import { deleteTable } from "../fixtures/clearTables";
import { getBigQueryTableData } from "../fixtures/queries";

process.env.PROJECT_ID = "dev-extensions-testing";

let bq: BigQuery;
let randomID: string;
let datasetId: string;
let tableId: string;
let bqProjectId: string;

const { logger } = require("firebase-functions");
const consoleLogSpy = jest.spyOn(logger, "warn").mockImplementation();
describe("Using an alternative bigquery project", () => {
  beforeEach(() => {
    randomID = (Math.random() + 1).toString(36).substring(7);
    datasetId = `dataset_${randomID}`;
    tableId = `table_${randomID}`;
    bq = new BigQuery({ projectId: process.env.PROJECT_ID });
  });
  describe("has a valid alternative project id", () => {
    beforeEach(async () => {
      bqProjectId = "messaging-test-4395c";
    });

    xtest("successfully uses alternative project name when provided", async () => {
      const event: FirestoreDocumentChangeEvent = changeTrackerEvent({});

      await changeTracker({
        datasetId,
        tableId,
        bqProjectId,
      }).record([event]);

      const [changeLogRows, latestRows] = await getBigQueryTableData(
        bqProjectId,
        datasetId,
        tableId
      );

      expect(changeLogRows.length).toEqual(1);
      expect(latestRows.length).toEqual(1);
    });
  });

  describe("does not have valid alternative project id", () => {
    test("defaults to default project name if none provided", async () => {
      const event: FirestoreDocumentChangeEvent = changeTrackerEvent({});

      await changeTracker({
        datasetId,
        tableId,
        bqProjectId: null,
      }).record([event]);

      // Run the query as a job
      const [changeLogRows, latestRows] = await getBigQueryTableData(
        process.env.PROJECT_ID,
        datasetId,
        tableId
      );

      expect(changeLogRows.length).toEqual(1);
      expect(latestRows.length).toEqual(1);
    });
  });

  describe("An inaccessible project id has been provided", () => {
    beforeEach(async () => {
      bqProjectId = "an_invalid_projectId";
    });

    //TODO: Find a way to check an invalid Id or assert before inserting records.
    test.skip("Warns the user if an invalid project Id has been provided", async () => {
      const event: FirestoreDocumentChangeEvent = changeTrackerEvent({});

      await changeTracker({
        datasetId,
        tableId,
        bqProjectId,
      }).record([event]);

      const [changeLogExists] = await bq
        .dataset(datasetId)
        .table(`${tableId}_raw_changelog`)
        .exists();

      expect(changeLogExists).toBeFalsy();

      expect(consoleLogSpy).toBeCalledWith(
        `Invalid project Id ${bqProjectId}, data cannot be synchronized`
      );
    });
  });
  afterEach(
    async () =>
      await deleteTable({
        datasetId,
      })
  );
});
