import { BigQuery, Dataset, Table } from "@google-cloud/bigquery";
import { FirestoreDocumentChangeEvent } from "../..";
import { RawChangelogSchema } from "../../bigquery";
import { changeTracker, changeTrackerEvent } from "../fixtures/changeTracker";
import { deleteTable } from "../fixtures/clearTables";

process.env.PROJECT_ID = "extensions-testing";

const bq = new BigQuery();
let event: FirestoreDocumentChangeEvent;
let randomID: string;
let datasetId: string;
let tableId: string;
let tableId_raw: string;
let viewId_raw: string;
let dataset: Dataset;
let table: Table;
let view: Table;

describe("Stress testing", () => {
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

  describe("running multiple chnages simulatenously", () => {
    test("Successfully handles 100 simulteaneous inserts.", async () => {
      const toRun = Array.from(Array(100).keys()).map((documentId) => {
        return new Promise(async (resolve) => {
          event = changeTrackerEvent({
            documentId,
          });

          await changeTracker({
            datasetId,
            tableId,
          }).record([event]);

          resolve(documentId);
        });
      });

      await Promise.all(toRun);

      table = bq.dataset(datasetId).table(tableId_raw);

      const rows = await table.getRows();
      expect(rows[0].length).toEqual(100);
    }, 120000);
  });
});
