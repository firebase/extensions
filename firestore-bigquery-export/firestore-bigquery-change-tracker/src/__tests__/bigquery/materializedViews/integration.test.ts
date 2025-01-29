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

import { ChangeType, FirestoreDocumentChangeEvent } from "../../..";
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
        maxStaleness: `INTERVAL "4:0:0" HOUR TO SECOND`,
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
        maxStaleness: `INTERVAL "4:0:0" HOUR TO SECOND`,
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

    test("successfully updates incremental materialized view with new events", async () => {
      // Initial event recording
      await changeTracker({
        datasetId,
        tableId,
        useMaterializedView: true,
        useIncrementalMaterializedView: true,
      }).record([event]);

      // Wait for BigQuery to process
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Create additional test events with different data
      const event3 = changeTrackerEvent({
        timestamp: new Date().toISOString(),
        operation: "CREATE",
        documentName: "testCollection/doc3",
        eventId: "testing3",
        documentId: "doc3",
        pathParams: { documentId: "doc3" },
        data: { end_date: firestore.Timestamp.now(), status: "completed" },
        oldData: null,
      });

      const event4 = changeTrackerEvent({
        timestamp: new Date().toISOString(),
        operation: "CREATE",
        documentName: "testCollection/doc4",
        eventId: "testing4",
        documentId: "doc4",
        pathParams: { documentId: "doc4" },
        data: { end_date: firestore.Timestamp.now(), status: "pending" },
        oldData: null,
      });

      // Record additional events
      await changeTracker({
        datasetId,
        tableId,
        useMaterializedView: true,
        useIncrementalMaterializedView: true,
      }).record([event3, event4]);

      // Wait for BigQuery to process
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // // Get the materialized view data
      const [changeLogRows, latestRows] = await getBigQueryTableData(
        "dev-extensions-testing",
        datasetId,
        tableId
      );

      const query = `SELECT * FROM \`${process.env.PROJECT_ID}.${datasetId}.${tableId}_raw_latest\` LIMIT 10`;

      const [viewData] = await bq.query(query);

      expect(viewData.length).toBe(3); // Should contain all three events

      expect(viewData[0].document_id).toBe("testing"); // First event
      expect(viewData[1].document_id).toBe("doc3"); // Third event
      expect(viewData[2].document_id).toBe("doc4"); // Fourth event

      expect(JSON.parse(viewData[1].data).status).toBe("completed");
      expect(JSON.parse(viewData[2].data).status).toBe("pending");
    });
  });
});

describe("materialized views operations", () => {
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

  const testCases = [
    {
      name: "handles document updates correctly",
      events: [
        // Initial create
        changeTrackerEvent({
          timestamp: new Date().toISOString(),
          operation: ChangeType.CREATE,
          documentName: "testCollection/update1",
          eventId: "update-test-1",
          documentId: "update1",
          pathParams: { documentId: "update1" },
          data: { status: "draft", title: "Original Title" },
          oldData: null,
        }),
        // Update the document
        changeTrackerEvent({
          timestamp: new Date(Date.now() + 1000).toISOString(), // Ensure later timestamp
          operation: ChangeType.UPDATE,
          documentName: "testCollection/update1",
          eventId: "update-test-2",
          documentId: "update1",
          pathParams: { documentId: "update1" },
          data: { status: "published", title: "Updated Title" },
          oldData: { status: "draft", title: "Original Title" },
        }),
      ],
      assertions: async (viewData: any[]) => {
        expect(viewData.length).toBe(1); // Should only have one record for the document
        const doc = viewData[0];
        const data = JSON.parse(doc.data);
        expect(doc.document_id).toBe("update1");
        expect(data.status).toBe("published");
        expect(data.title).toBe("Updated Title");
      },
    },
    {
      name: "handles document deletions correctly",
      events: [
        // Create first document
        changeTrackerEvent({
          timestamp: new Date().toISOString(),
          operation: ChangeType.CREATE,
          documentName: "testCollection/delete1",
          eventId: "delete-test-1",
          documentId: "delete1",
          pathParams: { documentId: "delete1" },
          data: { status: "active" },
          oldData: null,
        }),
        // Create second document
        changeTrackerEvent({
          timestamp: new Date().toISOString(),
          operation: ChangeType.CREATE,
          documentName: "testCollection/delete2",
          eventId: "delete-test-2",
          documentId: "delete2",
          pathParams: { documentId: "delete2" },
          data: { status: "active" },
          oldData: null,
        }),
        // Delete first document
        changeTrackerEvent({
          timestamp: new Date(Date.now() + 1000).toISOString(),
          operation: ChangeType.DELETE,
          documentName: "testCollection/delete1",
          eventId: "delete-test-3",
          documentId: "delete1",
          pathParams: { documentId: "delete1" },
          data: null,
          oldData: { status: "active" },
        }),
      ],
      assertions: async (viewData: any[]) => {
        expect(viewData.length).toBe(2); // incremental materialized view cant remove deletes
        const doc1 = viewData.find((doc) => doc.document_id === "delete1");
        const doc2 = viewData.find((doc) => doc.document_id === "delete2");
        expect(doc1).toBeDefined();
        expect(doc2).toBeDefined();

        console.log(JSON.stringify(doc1, null, 2));

        const operation1 = doc1.operation;
        expect(operation1).toBe("DELETE");

        const operation2 = doc2.operation;
        expect(operation2).toBe("CREATE");
      },
    },
    {
      name: "handles multiple updates to same document correctly",
      events: [
        // Initial create
        changeTrackerEvent({
          timestamp: new Date().toISOString(),
          operation: ChangeType.CREATE,
          documentName: "testCollection/multiUpdate",
          eventId: "multi-update-1",
          documentId: "multiUpdate",
          pathParams: { documentId: "multiUpdate" },
          data: { status: "draft", version: 1 },
          oldData: null,
        }),
        // First update
        changeTrackerEvent({
          timestamp: new Date(Date.now() + 1000).toISOString(),
          operation: ChangeType.UPDATE,
          documentName: "testCollection/multiUpdate",
          eventId: "multi-update-2",
          documentId: "multiUpdate",
          pathParams: { documentId: "multiUpdate" },
          data: { status: "in_review", version: 2 },
          oldData: { status: "draft", version: 1 },
        }),
        // Second update
        changeTrackerEvent({
          timestamp: new Date(Date.now() + 2000).toISOString(),
          operation: ChangeType.UPDATE,
          documentName: "testCollection/multiUpdate",
          eventId: "multi-update-3",
          documentId: "multiUpdate",
          pathParams: { documentId: "multiUpdate" },
          data: { status: "published", version: 3 },
          oldData: { status: "in_review", version: 2 },
        }),
      ],
      assertions: async (viewData: any[]) => {
        expect(viewData.length).toBe(1);
        const doc = viewData[0];
        const data = JSON.parse(doc.data);
        expect(doc.document_id).toBe("multiUpdate");
        expect(data.status).toBe("published");
        expect(data.version).toBe(3);
      },
    },
    {
      name: "handles create-delete-create sequence correctly",
      events: [
        // Initial create
        changeTrackerEvent({
          timestamp: new Date().toISOString(),
          operation: "CREATE",
          documentName: "testCollection/recreate",
          eventId: "recreate-1",
          documentId: "recreate",
          pathParams: { documentId: "recreate" },
          data: { status: "first_version" },
          oldData: null,
        }),
        // Delete
        changeTrackerEvent({
          timestamp: new Date(Date.now() + 1000).toISOString(),
          operation: ChangeType.DELETE,
          documentName: "testCollection/recreate",
          eventId: "recreate-2",
          documentId: "recreate",
          pathParams: { documentId: "recreate" },
          data: null,
          oldData: { status: "first_version" },
        }),
        // Recreate
        changeTrackerEvent({
          timestamp: new Date(Date.now() + 2000).toISOString(),
          operation: ChangeType.CREATE,
          documentName: "testCollection/recreate",
          eventId: "recreate-3",
          documentId: "recreate",
          pathParams: { documentId: "recreate" },
          data: { status: "second_version" },
          oldData: null,
        }),
      ],
      assertions: async (viewData: any[]) => {
        expect(viewData.length).toBe(1);
        const doc = viewData[0];
        const data = JSON.parse(doc.data);
        expect(doc.document_id).toBe("recreate");
        expect(data.status).toBe("second_version");
      },
    },
  ];

  testCases.forEach(({ name, events, assertions }) => {
    test(name, async () => {
      // Set up incremental materialized view
      await changeTracker({
        datasetId,
        tableId,
        useMaterializedView: true,
        useIncrementalMaterializedView: true,
      }).record([events[0]]);

      // Wait for initial setup
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Record remaining events
      for (let i = 1; i < events.length; i++) {
        await changeTracker({
          datasetId,
          tableId,
          useMaterializedView: true,
          useIncrementalMaterializedView: true,
        }).record([events[i]]);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // Query view data
      const query = `SELECT * FROM \`${process.env.PROJECT_ID}.${datasetId}.${tableId}_raw_latest\` ORDER BY document_id`;
      const [viewData] = await bq.query(query);

      // Run test-specific assertions
      await assertions(viewData);
    });
  });
});
