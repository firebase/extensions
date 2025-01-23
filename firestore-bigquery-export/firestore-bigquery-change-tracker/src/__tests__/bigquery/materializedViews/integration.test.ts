import {
  BigQuery,
  Dataset,
  Table,
  TableMetadata,
} from "@google-cloud/bigquery";
const { logger } = require("firebase-functions");

import {
  RawChangelogSchema,
  RawChangelogViewSchema,
} from "../../../bigquery/schema";

import { FirestoreDocumentChangeEvent } from "../../..";
import { latestConsistentSnapshotView } from "../../../bigquery/snapshot";
import { deleteTable } from "../../fixtures/clearTables";
import {
  changeTracker,
  changeTrackerEvent,
} from "../../fixtures/changeTracker";
import { getBigQueryTableData } from "../../fixtures/queries";
import { firestore } from "firebase-admin";

process.env.PROJECT_ID = "dev-extensions-testing";

// export const changeTrackerEvent = ({
//   timestamp = "2022-02-13T10:17:43.505Z",
//   operation = ChangeType.CREATE,
//   documentName = "testing",
//   eventId = "testing",
//   documentId = "testing",
//   pathParams = { documentId: "12345" },
//   data = { end_date: firestore.Timestamp.now() },
//   oldData = null,
//   useNewSnapshotQuerySyntax = false,
// }: any): FirestoreDocumentChangeEvent => {
//   return {
//     timestamp,
//     operation,
//     documentName,
//     eventId,
//     documentId,
//     data,
//     oldData,
//     pathParams,
//     useNewSnapshotQuerySyntax,
//   };
// };

const bq: BigQuery = new BigQuery({ projectId: process.env.PROJECT_ID });
const event: FirestoreDocumentChangeEvent = changeTrackerEvent({});
const event2: FirestoreDocumentChangeEvent = changeTrackerEvent({
  data: { end_date: firestore.Timestamp.now() },
  eventId: "testing2",
});
let randomID: string;
let datasetId: string;
let tableId: string;
let tableId_raw: string;
let viewId_raw: string;
let dataset: Dataset;
let table: Table;
let view: Table;

describe("integration", () => {
  describe("materialized views", () => {
    beforeEach(async () => {
      randomID = (Math.random() + 1).toString(36).substring(7);
      datasetId = `dataset_${randomID}`;
      tableId = `table_${randomID}`;
      tableId_raw = `${tableId}_raw_changelog`;
      dataset = bq.dataset(datasetId);
      viewId_raw = `${tableId}_raw_latest`;
    });

    afterEach(async () => {
      await deleteTable({
        datasetId,
      });
    });
    test("successfully creates a dataset and table and view (incremental)", async () => {
      await changeTracker({
        datasetId,
        tableId,
        useMaterializedView: true,
        useIncrementalMaterializedView: true,
      }).record([event]);

      const [m] = await dataset.table(viewId_raw).getMetadata();

      const metadata = m as TableMetadata;
      expect(metadata).toBeDefined();

      expect(metadata.materializedView).toBeDefined();
      expect(metadata.materializedView.query).toBeDefined();
      expect(metadata.materializedView.enableRefresh).toBe(true);
      expect(
        metadata.materializedView.allowNonIncrementalDefinition
      ).not.toBeDefined();
    });

    test("successfully creates a dataset and table and view (non-incremental)", async () => {
      await changeTracker({
        datasetId,
        tableId,
        useMaterializedView: true,
        maxStaleness: `"4:0:0" HOUR TO SECOND`,
        refreshIntervalMinutes: 5,
      }).record([event]);

      const [m] = await dataset.table(viewId_raw).getMetadata();

      const metadata = m as TableMetadata;
      expect(metadata).toBeDefined();

      expect(metadata.materializedView).toBeDefined();
      expect(metadata.materializedView.query).toBeDefined();
      expect(metadata.materializedView.enableRefresh).toBe(true);
      expect(metadata.materializedView.allowNonIncrementalDefinition).toBe(
        true
      );
    });
    test("does not recreate a view when it already exists (incremental)", async () => {
      await changeTracker({
        datasetId,
        tableId,
        useMaterializedView: true,
        useIncrementalMaterializedView: true,
      }).record([event]);

      const [m] = await dataset.table(viewId_raw).getMetadata();

      const metadata = m as TableMetadata;
      expect(metadata).toBeDefined();

      expect(metadata.materializedView).toBeDefined();
      expect(metadata.materializedView.query).toBeDefined();
      expect(metadata.materializedView.enableRefresh).toBe(true);
      expect(
        metadata.materializedView.allowNonIncrementalDefinition
      ).not.toBeDefined();

      await new Promise((resolve) => setTimeout(resolve, 2000));

      await changeTracker({
        datasetId,
        tableId,
        useMaterializedView: true,
        useIncrementalMaterializedView: true,
      }).record([event2]);

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const [m2] = await dataset.table(viewId_raw).getMetadata();

      const metadata2 = m2 as TableMetadata;
      expect(metadata2).toBeDefined();
      expect(
        metadata2.materializedView.allowNonIncrementalDefinition
      ).not.toBeDefined();
    });

    test("successfully recreates a view when it already exists (non incremental -> incremental)", async () => {
      await changeTracker({
        datasetId,
        tableId,
        useMaterializedView: true,
        maxStaleness: `"4:0:0" HOUR TO SECOND`,
        refreshIntervalMinutes: 5,
      }).record([event]);

      const [m] = await dataset.table(viewId_raw).getMetadata();

      const metadata = m as TableMetadata;
      expect(metadata).toBeDefined();

      expect(metadata.materializedView).toBeDefined();
      expect(metadata.materializedView.query).toBeDefined();
      expect(metadata.materializedView.enableRefresh).toBe(true);
      expect(metadata.materializedView.allowNonIncrementalDefinition).toBe(
        true
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      await changeTracker({
        datasetId,
        tableId,
        useMaterializedView: true,
        useIncrementalMaterializedView: true,
      }).record([event2]);

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const [m2] = await dataset.table(viewId_raw).getMetadata();

      const metadata2 = m2 as TableMetadata;
      expect(metadata2).toBeDefined();
      expect(
        metadata2.materializedView.allowNonIncrementalDefinition
      ).not.toBeDefined();
    });
  });
});
