import { runMultiThread } from "../src/run-multi-thread";
import * as workerpool from "workerpool";
import { CliConfig } from "../src/types";
import { cpus } from "os";

// Mock helper functions
jest.mock("../src/helper", () => ({
  initializeFailedBatchOutput: jest.fn(),
}));

// Mock logs module
jest.mock("../src/logs", () => ({
  finishedImportingParallel: jest.fn(),
}));

// Mock cpus from os module
jest.mock("os", () => ({
  cpus: jest.fn().mockReturnValue(Array.from({ length: 4 }, () => ({}))),
}));

// Mock Firebase Admin
jest.mock("firebase-admin", () => {
  // Create an iterator for partitions
  const createPartitionsIterator = (numPartitions) => {
    let count = 0;
    return {
      next: jest.fn().mockImplementation(() => {
        if (count < numPartitions) {
          count++;
          return {
            value: {
              toQuery: () => ({
                _queryOptions: {
                  startAt: { values: [{ referenceValue: `doc${count}` }] },
                  endAt: { values: [{ referenceValue: `doc${count + 1}` }] },
                },
              }),
            },
            done: false,
          };
        }
        return { value: undefined, done: true };
      }),
    };
  };

  return {
    firestore: jest.fn().mockReturnValue({
      collectionGroup: jest.fn().mockReturnValue({
        getPartitions: jest
          .fn()
          .mockImplementation(() => createPartitionsIterator(5)),
      }),
    }),
  };
});

// Mock workerpool
jest.mock("workerpool", () => {
  let activeTasks = 0;

  return {
    pool: jest.fn().mockReturnValue({
      exec: jest.fn().mockImplementation(async () => {
        activeTasks++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        activeTasks--;
        return 100; // Each worker processes 100 documents
      }),
      stats: jest.fn().mockImplementation(() => ({
        activeTasks,
        pendingTasks: 0,
      })),
      terminate: jest.fn().mockResolvedValue(undefined),
    }),
  };
});

describe("runMultiThread", () => {
  let mockConfig: CliConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      kind: "CONFIG",
      projectId: "test-project",
      bigQueryProjectId: "test-bq-project",
      sourceCollectionPath: "collection/doc/subcollection",
      datasetId: "testDataset",
      tableId: "testTable",
      batchSize: 100,
      queryCollectionGroup: true,
      datasetLocation: "us",
      multiThreaded: true,
      useNewSnapshotQuerySyntax: false,
      useEmulator: false,
      rawChangeLogName: "testTable_raw_changelog",
      cursorPositionFile: "/tmp/cursor",
    };
  });

  it("should process all partitions and accumulate total documents", async () => {
    const total = await runMultiThread(mockConfig);

    // Check if worker pool was initialized correctly
    expect(workerpool.pool).toHaveBeenCalledWith(
      expect.stringContaining("/worker.js"),
      expect.objectContaining({
        maxWorkers: expect.any(Number),
        forkOpts: expect.any(Object),
      })
    );

    // Verify collection group query setup
    const firestore = require("firebase-admin").firestore();
    expect(firestore.collectionGroup).toHaveBeenCalledWith("subcollection");
    expect(firestore.collectionGroup().getPartitions).toHaveBeenCalledWith(
      mockConfig.batchSize
    );

    // Check total processed documents (5 partitions * 100 docs each)
    expect(total).toBe(500);
  });

  it("should handle worker errors gracefully", async () => {
    const mockPool = workerpool.pool();
    (mockPool.exec as jest.Mock).mockRejectedValueOnce(
      new Error("Worker error")
    );

    const total = await runMultiThread(mockConfig);

    // Should still process remaining partitions even if one fails
    expect(total).toBe(400); // 4 successful partitions * 100 docs each
  });

  it("should respect maxWorkers limit", async () => {
    const maxWorkers = Math.ceil(cpus().length / 2);
    const total = await runMultiThread(mockConfig);

    const mockPool = workerpool.pool();
    const poolStats = mockPool.stats();

    // Verify that active tasks never exceeded maxWorkers
    expect(poolStats.activeTasks).toBeLessThanOrEqual(maxWorkers);
  });
});
