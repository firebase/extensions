import { initializeLatestView } from "../../../bigquery/initializeLatestView";
import { initializeLatestMaterializedView } from "../../../bigquery/initializeLatestMaterializedView";
import { FirestoreBigQueryEventHistoryTrackerConfig } from "../../../bigquery";

jest.mock("../../../bigquery/initializeLatestMaterializedView");

describe("initializeLatestView", () => {
  const mockView = {
    id: "test_view",
    getMetadata: jest.fn(),
    setMetadata: jest.fn(),
    create: jest.fn(),
  };

  const mockConfig: FirestoreBigQueryEventHistoryTrackerConfig = {
    wildcardIds: true,
    datasetId: "test_dataset",
    useNewSnapshotQuerySyntax: true,
    clustering: [],
    tableId: "test_raw_table",
    useMaterializedView: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("initializeLatestView", () => {
    it("calls initializeLatestMaterializedView when useMaterializedView is true", async () => {
      const mockOptions = {
        bq: {} as any, // Mocked BigQuery instance
        dataset: { id: "test_dataset" } as any, // Mocked Dataset instance
        view: mockView as any, // Mocked Table instance
        viewExists: false,
        rawChangeLogTableName: "test_raw_table",
        rawLatestViewName: "test_raw_view",
        changeTrackerConfig: { ...mockConfig, useMaterializedView: true },
        useMaterializedView: true,
        useIncrementalMaterializedView: false,
      };

      await initializeLatestView(mockOptions);

      expect(initializeLatestMaterializedView).toHaveBeenCalled();
    });

    it("does not call initializeLatestMaterializedView when useMaterializedView is false", async () => {
      const mockOptions = {
        bq: {} as any, // Mocked BigQuery instance
        dataset: { id: "test_dataset" } as any, // Mocked Dataset instance
        view: mockView as any, // Mocked Table instance
        viewExists: false,
        rawChangeLogTableName: "test_raw_table",
        rawLatestViewName: "test_raw_view",
        changeTrackerConfig: { ...mockConfig, useMaterializedView: false },
        useMaterializedView: false,
        useIncrementalMaterializedView: false,
      };

      await initializeLatestView(mockOptions);

      expect(initializeLatestMaterializedView).not.toHaveBeenCalled();
    });
  });
});
