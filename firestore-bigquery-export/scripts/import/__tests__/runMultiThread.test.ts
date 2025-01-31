import { runMultiThread } from "../src/run-multi-thread";
import * as admin from "firebase-admin";
import { CliConfig } from "../src/types";
import * as workerpool from "workerpool";

// Initialize Firebase Admin (Ensure credentials are set)
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const firestore = admin.firestore();

jest.mock("workerpool", () => ({
  pool: jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(5), // Simulating 5 docs processed per worker
    stats: jest.fn().mockReturnValue({ activeTasks: 0, pendingTasks: 0 }),
    terminate: jest.fn().mockResolvedValue(undefined),
  }),
}));

describe("runMultiThread Partitioning with Firestore", () => {
  let testCollection = `testCollection_${Date.now()}`;
  let mockConfig: CliConfig;
  let mockPool: any;
  let mockExec: jest.Mock;

  beforeAll(async () => {
    console.log("Creating test documents...");

    // Creating only 10 documents for a fast test
    for (let i = 0; i < 10; i++) {
      await firestore.collection(`test_partition/${i % 2}/docs`).add({
        index: i,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool = workerpool.pool();
    mockExec = mockPool.exec;

    mockConfig = {
      kind: "CONFIG",
      projectId: "test-project",
      bigQueryProjectId: "test-bq-project",
      sourceCollectionPath: "test_partition/{partitionId}/docs",
      datasetId: "testDataset",
      tableId: "testTable",
      batchSize: 5, // Small batch size for controlled partitioning
      queryCollectionGroup: true,
      datasetLocation: "us",
      multiThreaded: true,
      useNewSnapshotQuerySyntax: false,
      useEmulator: false,
      rawChangeLogName: "testTable_raw_changelog",
      cursorPositionFile: "/tmp/test_cursor_position",
    };
  });

  it("should correctly distribute partitions and process all documents", async () => {
    console.log("Running multi-thread import...");

    const totalProcessed = await runMultiThread(mockConfig);

    console.log(`Total documents processed: ${totalProcessed}`);

    // Ensure workerpool.exec() was called multiple times (each partition)
    expect(mockExec).toHaveBeenCalled();

    // Ensure `runMultiThread` terminates properly
    expect(mockPool.terminate).toHaveBeenCalled();

    // Check if at least all 10 test docs are processed
    expect(totalProcessed).toBeGreaterThanOrEqual(10);
  });

  afterAll(async () => {
    console.log("Cleaning up test data...");

    // Clean up only test collections
    const collectionRefs = ["test_partition/0/docs", "test_partition/1/docs"];
    for (const collectionPath of collectionRefs) {
      const collectionRef = firestore.collection(collectionPath);
      const docs = await collectionRef.listDocuments();
      await Promise.all(docs.map((doc) => doc.delete()));
    }
  });
});
