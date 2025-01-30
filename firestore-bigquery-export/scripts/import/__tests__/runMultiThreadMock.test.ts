import { runMultiThread } from "../src/run-multi-thread";
import * as workerpool from "workerpool";
import { CliConfig } from "../src/types";

// Mock Firestore partitioning logic
jest.mock("firebase-admin", () => ({
  firestore: jest.fn().mockReturnValue({
    collectionGroup: jest.fn().mockReturnValue({
      getPartitions: jest.fn().mockImplementation((batchSize: number) => {
        // Simulate partitions for a large dataset (1000+ documents)
        const partitions = Array.from({ length: 10 }, (_, index) => ({
          toQuery: jest.fn().mockReturnValue({
            _queryOptions: {
              startAt: { values: [{ referenceValue: `doc${index * 100}` }] },
              endAt: {
                values: [{ referenceValue: `doc${(index + 1) * 100}` }],
              },
            },
          }),
        }));

        return {
          next: jest.fn().mockImplementation(() => {
            if (partitions.length === 0) {
              return { value: undefined, done: true };
            }
            return { value: partitions.shift(), done: false };
          }),
        };
      }),
    }),
  }),
}));

// Mock workerpool to capture worker execution
jest.mock("workerpool", () => ({
  pool: jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(100), // Simulating 100 docs processed per worker
    stats: jest.fn().mockReturnValue({ activeTasks: 0, pendingTasks: 0 }),
    terminate: jest.fn().mockResolvedValue(undefined),
  }),
}));

describe("runMultiThread Partitioning (Mocked Firestore)", () => {
  let mockConfig: CliConfig;
  let mockPool: any;
  let mockExec: jest.Mock;

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
      batchSize: 100, // Larger batch size to simulate large-scale partitioning
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
    console.log("Running multi-thread import (mocked Firestore)...");

    const totalProcessed = await runMultiThread(mockConfig);

    console.log(`Total documents processed: ${totalProcessed}`);

    // Ensure workerpool.exec() was called once per partition (10 partitions)
    expect(mockExec).toHaveBeenCalledTimes(10);

    // Verify partitioning by checking calls
    for (let i = 0; i < 10; i++) {
      const callArgs = mockExec.mock.calls[i][1][0];
      expect(callArgs).toEqual({
        startAt: { values: [{ referenceValue: `doc${i * 100}` }] },
        endAt: { values: [{ referenceValue: `doc${(i + 1) * 100}` }] },
      });
    }

    // Ensure `runMultiThread` terminates properly
    expect(mockPool.terminate).toHaveBeenCalled();

    // Check if at least all 1000 test docs are processed
    expect(totalProcessed).toBeGreaterThanOrEqual(1000);
  });
});
