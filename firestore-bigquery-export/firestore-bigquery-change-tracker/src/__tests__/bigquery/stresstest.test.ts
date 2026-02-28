import { BigQuery, Dataset, Table } from "@google-cloud/bigquery";
import { FirestoreDocumentChangeEvent } from "../..";
import { RawChangelogSchema } from "../../bigquery";
import { changeTracker, changeTrackerEvent } from "../fixtures/changeTracker";
import { deleteTable } from "../fixtures/clearTables";
import { ChangeType } from "../..";
import { buildLatestSnapshotViewQuery } from "../../bigquery/snapshot";
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
const count = 100;
describe.skip("Stress testing", () => {
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

  describe("running multiple changes simulatenously", () => {
    // skipping for now, as this test is flaky
    test.skip(`Successfully handles ${count} simulteaneous inserts.`, async () => {
      const toRun = Array.from(Array(count).keys()).map((documentId) => {
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

      /* Wait for data to set */
      await new Promise((resolve) => setTimeout(resolve, 20000));

      table = bq.dataset(datasetId).table(tableId_raw);

      const rows = await table.getRows({
        selectedFields: "document_id",
        maxResults: 100,
      });
      expect(rows[0].length).toEqual(count);
    }, 340000);
  });

  describe("snapshot view stresstest", () => {
    test("should run new snapshot view query on a big table", async () => {
      const query = buildLatestSnapshotViewQuery({
        datasetId: "new_stresstest",
        tableName: "test_changelog_table",
        timestampColumnName: "timestamp",
        groupByColumns: ["data", "operation", "event_id", "timestamp"],
        bqProjectId: "extensions-testing",
        useLegacyQuery: false,
      });

      const [job] = await bq.createQueryJob({
        query,
        useLegacySql: false,
      });

      const [rows] = await job.getQueryResults();

      expect(rows.length).toEqual(1);
      const snapshot = rows[0];

      // following the generateSnapshotStresstestTable query in the fixtures, we expect:
      expect(snapshot.event_id).toBeDefined();
      expect(snapshot.timestamp).toBeDefined();
      expect(typeof snapshot.data).toEqual("string");
      expect(snapshot.operation).toEqual("UPDATE");
      expect(snapshot.document_name).toBe(
        "projects/myproject/databases/(default)/documents/mycollection/mydocument"
      );
      expect(snapshot.document_id).toBe("mydocument");
    }, 240000);

    test("should fail to run legacy snapshot view query on a big table", async () => {
      const query = buildLatestSnapshotViewQuery({
        datasetId: "new_stresstest",
        tableName: "test_changelog_table",
        timestampColumnName: "timestamp",
        groupByColumns: ["data", "operation", "event_id", "timestamp"],
        bqProjectId: "extensions-testing",
      });
      try {
        await bq.createQueryJob({
          query,
          useLegacySql: false,
        });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }, 240000);
    test("should get snapshot view query if some timestamps are null", async () => {
      const query = buildLatestSnapshotViewQuery({
        datasetId: "new_stresstest",
        tableName: "some_null",
        timestampColumnName: "timestamp",
        groupByColumns: ["data", "operation", "event_id", "timestamp"],
        bqProjectId: "extensions-testing",
        useLegacyQuery: false,
      });

      const [job] = await bq.createQueryJob({
        query,
        useLegacySql: false,
      });

      const [rows] = await job.getQueryResults();

      expect(rows.length).toEqual(1);
    }, 240000);
    test("should get snapshot view query if duplicate timestamps exist", async () => {
      const query = buildLatestSnapshotViewQuery({
        datasetId: "new_stresstest",
        tableName: "duplicate_timestamp_table",
        timestampColumnName: "timestamp",
        groupByColumns: ["data", "operation", "event_id", "timestamp"],
        bqProjectId: "extensions-testing",
        useLegacyQuery: false,
      });

      const [job] = await bq.createQueryJob({
        query,
        useLegacySql: false,
      });

      const [rows] = await job.getQueryResults();

      expect(rows.length).toEqual(1);

      expect(typeof rows[0].data).toBe("string");
      expect(rows[0].operation).toBe("UPDATE");
      expect(rows[0].event_id).toBeDefined();
      expect(rows[0].timestamp).toBeDefined();
    }, 240000);

    test("legacy query results should match new query results in stress tests", async () => {
      const legacyQuery = buildLatestSnapshotViewQuery({
        datasetId: "new_stresstest",
        tableName: "some_null",
        timestampColumnName: "timestamp",
        groupByColumns: ["data", "operation", "event_id", "timestamp"],
        bqProjectId: "extensions-testing",
        useLegacyQuery: true,
      });

      const newQuery = buildLatestSnapshotViewQuery({
        datasetId: "new_stresstest",
        tableName: "some_null",
        timestampColumnName: "timestamp",
        groupByColumns: ["data", "operation", "event_id", "timestamp"],
        bqProjectId: "extensions-testing",
        useLegacyQuery: false,
      });

      const [legacyJob] = await bq.createQueryJob({
        query: legacyQuery,
        useLegacySql: false,
      });

      const [newJob] = await bq.createQueryJob({
        query: newQuery,
        useLegacySql: false,
      });

      const [legacyRows] = await legacyJob.getQueryResults();
      const [newRows] = await newJob.getQueryResults();

      expect(legacyRows).toEqual(newRows);
    }, 240000);
  });
});
