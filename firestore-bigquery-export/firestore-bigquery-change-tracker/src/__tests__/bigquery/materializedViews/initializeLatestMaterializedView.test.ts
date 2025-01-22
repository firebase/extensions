import { initializeLatestMaterializedView } from "../../../bigquery/initializeLatestMaterializedView";
import { shouldRecreateMaterializedView } from "../../../bigquery/initializeLatestMaterializedView";
import * as logs from "../../../logs";
import {
  buildMaterializedViewQuery,
  buildNonIncrementalMaterializedViewQuery,
} from "../../../bigquery/snapshot";
import * as sqlFormatter from "sql-formatter";
import { FirestoreBigQueryEventHistoryTrackerConfig } from "../../../bigquery";

jest.mock("../../../logs");
jest.mock("../../../bigquery/snapshot", () => ({
  buildMaterializedViewQuery: jest.fn(),
  buildNonIncrementalMaterializedViewQuery: jest.fn(),
}));
jest.mock("../../../bigquery/initializeLatestMaterializedView", () => {
  const actualModule = jest.requireActual(
    "../../../bigquery/initializeLatestMaterializedView"
  );
  return {
    ...actualModule,
    shouldRecreateMaterializedView: jest.fn(),
  };
});

jest.mock("../../../bigquery/initializeLatestMaterializedView", () => ({
  ...jest.requireActual("../../../bigquery/initializeLatestMaterializedView"),
  shouldRecreateMaterializedView: jest.fn(), // Full mock of this function
}));
jest.mock("sql-formatter");

describe("initializeLatestMaterializedView", () => {
  let mockBigQuery: any;
  let mockView: any;
  let mockConfig: Partial<FirestoreBigQueryEventHistoryTrackerConfig>;
  const mockQuery = "SELECT * FROM test_raw_table";
  const mockFormattedQuery = "FORMATTED SQL QUERY";

  beforeAll(() => {
    // Configure static mock returns
    (sqlFormatter.format as jest.Mock).mockReturnValue(mockFormattedQuery);
    (buildMaterializedViewQuery as jest.Mock).mockReturnValue({
      query: mockQuery,
      source: "SOURCE QUERY",
    });
    (buildNonIncrementalMaterializedViewQuery as jest.Mock).mockReturnValue({
      query: mockQuery,
      source: "SOURCE QUERY",
    });
  });

  beforeEach(() => {
    mockBigQuery = {
      projectId: "test_project",
      query: jest.fn(),
    };

    mockView = {
      id: "test_view",
      delete: jest.fn(),
      getMetadata: jest.fn().mockResolvedValue([{}]),
    };

    mockConfig = {
      datasetId: "test_dataset",
      useMaterializedView: true,
      maxStaleness: "1h",
      refreshIntervalMinutes: 30,
    };

    jest.clearAllMocks();

    // Mock the behavior of shouldRecreateMaterializedView
    (shouldRecreateMaterializedView as jest.Mock).mockResolvedValue(false); // Default behavior for tests
  });

  it("creates a new materialized view when view does not exist", async () => {
    await initializeLatestMaterializedView({
      bq: mockBigQuery,
      changeTrackerConfig: {
        ...mockConfig,
        useIncrementalMaterializedView: false,
      } as any,
      view: mockView,
      viewExists: false,
      rawChangeLogTableName: "test_raw_table",
      rawLatestViewName: "test_raw_view",
      schema: {},
    });

    expect(buildMaterializedViewQuery).toHaveBeenCalled();
    expect(buildNonIncrementalMaterializedViewQuery).not.toHaveBeenCalled();
    expect(sqlFormatter.format).toHaveBeenCalledWith(mockQuery);
    expect(mockBigQuery.query).toHaveBeenCalledWith(mockFormattedQuery);
    expect(logs.bigQueryViewCreating).toHaveBeenCalledWith(
      "test_raw_view",
      mockFormattedQuery
    );
    expect(logs.bigQueryViewCreated).toHaveBeenCalledWith("test_raw_view");
  });

  it("does not recreate the view if the configuration matches", async () => {
    (shouldRecreateMaterializedView as jest.Mock).mockResolvedValue(false);

    await initializeLatestMaterializedView({
      bq: mockBigQuery,
      changeTrackerConfig: mockConfig as any,
      view: mockView,
      viewExists: true,
      rawChangeLogTableName: "test_raw_table",
      rawLatestViewName: "test_raw_view",
      schema: {},
    });

    expect(mockView.delete).not.toHaveBeenCalled();
    expect(mockBigQuery.query).not.toHaveBeenCalled();
    expect(logs.bigQueryViewCreating).not.toHaveBeenCalled();
  });

  it("deletes and recreates the view if the configuration mismatches", async () => {
    (shouldRecreateMaterializedView as jest.Mock).mockResolvedValue(true);

    await initializeLatestMaterializedView({
      bq: mockBigQuery,
      changeTrackerConfig: {
        ...mockConfig,
        useIncrementalMaterializedView: true,
      } as any,
      view: mockView,
      viewExists: true,
      rawChangeLogTableName: "test_raw_table",
      rawLatestViewName: "test_raw_view",
      schema: {},
    });

    expect(mockView.delete).toHaveBeenCalled();
    expect(mockBigQuery.query).toHaveBeenCalledWith(mockFormattedQuery);
    expect(logs.bigQueryViewCreating).toHaveBeenCalledWith(
      "test_raw_view",
      mockFormattedQuery
    );
    expect(logs.bigQueryViewCreated).toHaveBeenCalledWith("test_raw_view");
  });

  it("logs an error if view creation fails", async () => {
    mockBigQuery.query.mockRejectedValueOnce(new Error("Query failed"));

    await expect(
      initializeLatestMaterializedView({
        bq: mockBigQuery,
        changeTrackerConfig: {
          ...mockConfig,
          useIncrementalMaterializedView: false,
        } as any,
        view: mockView,
        viewExists: false,
        rawChangeLogTableName: "test_raw_table",
        rawLatestViewName: "test_raw_view",
        schema: {},
      })
    ).rejects.toThrow("Query failed");

    expect(logs.tableCreationError).toHaveBeenCalledWith(
      "test_raw_view",
      "Query failed"
    );
  });
});
