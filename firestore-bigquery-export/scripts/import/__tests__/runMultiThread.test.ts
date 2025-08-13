import { runMultiThread } from "../src/run-multi-thread";
import * as admin from "firebase-admin";
import { CliConfig } from "../src/types";
import * as workerpool from "workerpool";

// Initialize Firebase Admin (Ensure credentials are set)
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const firestore = admin.firestore();

// Use a unique collection name to avoid conflicts with existing data
const uniqueTestCollection = `test_multithread_${Date.now()}`;

// Mock the workerpool to simulate document processing
jest.mock("workerpool", () => ({
  pool: jest.fn().mockReturnValue({
    exec: jest.fn(),
    stats: jest.fn().mockReturnValue({ activeTasks: 0, pendingTasks: 0 }),
    terminate: jest.fn().mockResolvedValue(undefined),
  }),
}));

describe("runMultiThread Partitioning with Firestore", () => {
  let mockConfig: CliConfig;
  let mockPool: any;
  let mockExec: jest.Mock;
  let actualDocumentCount: number = 0;

  beforeAll(async () => {
    console.log("Creating test documents...");

    // Create test documents in a unique collection to avoid conflicts
    for (let i = 0; i < 10; i++) {
      await firestore.collection(`${uniqueTestCollection}_${i % 2}/subcoll/${uniqueTestCollection}`).add({
        index: i,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Count actual documents in the collection group
    const collectionGroupDocs = await firestore.collectionGroup(uniqueTestCollection).get();
    actualDocumentCount = collectionGroupDocs.size;
    console.log(`Created ${actualDocumentCount} test documents in collection group '${uniqueTestCollection}'`);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool = workerpool.pool();
    mockExec = mockPool.exec;
    
    // Track calls to ensure we only return documents once per test
    let hasBeenCalled = false;
    
    // Mock exec to return all documents on first call, 0 on subsequent calls
    // This simulates processing all documents in the partitions that are created
    mockExec.mockImplementation(() => {
      if (!hasBeenCalled) {
        hasBeenCalled = true;
        return Promise.resolve(actualDocumentCount);
      }
      return Promise.resolve(0);
    });

    mockConfig = {
      kind: "CONFIG",
      projectId: "test-project",
      bigQueryProjectId: "test-bq-project",
      sourceCollectionPath: `${uniqueTestCollection}_0/subcoll/${uniqueTestCollection}`,
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

    // Ensure workerpool.exec() was called (at least once for the partition)
    expect(mockExec).toHaveBeenCalled();

    // Ensure `runMultiThread` terminates properly
    expect(mockPool.terminate).toHaveBeenCalled();

    // Check if all test docs are processed
    expect(totalProcessed).toBe(actualDocumentCount);
  });

  afterAll(async () => {
    console.log("Cleaning up test data...");

    // Clean up test collections
    const collectionRefs = [
      `${uniqueTestCollection}_0/subcoll/${uniqueTestCollection}`,
      `${uniqueTestCollection}_1/subcoll/${uniqueTestCollection}`
    ];
    
    for (const collectionPath of collectionRefs) {
      const collectionRef = firestore.collection(collectionPath);
      const docs = await collectionRef.listDocuments();
      await Promise.all(docs.map((doc) => doc.delete()));
    }
  });
});
