import { BigQuery, Dataset, Table } from "@google-cloud/bigquery";
import { initializeRawChangelogTable } from "./initializeRawChangeLogTable";
import * as logs from "../../../logs";
import { FirestoreBigQueryEventHistoryTrackerConfig } from "../..";

const mockCreate = jest.fn();
const mockExists = jest.fn();
const mockGetMetadata = jest.fn();
const mockSetMetadata = jest.fn();
jest.mock("@google-cloud/bigquery", () => {
  return {
    BigQuery: jest.fn(),
    Dataset: jest.fn(),
    Table: jest.fn(() => ({
      exists: mockExists,
      getMetadata: mockGetMetadata,
      setMetadata: mockSetMetadata,
      create: mockCreate,
    })),
  };
});
jest.mock("../../logs", () => ({
  bigQueryTableAlreadyExists: jest.fn(),
  bigQueryTableCreating: jest.fn(),
  bigQueryTableCreated: jest.fn(),
  tableCreationError: jest.fn(),
  addNewColumn: jest.fn(),
  updatingMetadata: jest.fn(),
  removedClustering: jest.fn(),
}));

const mockTableRequiresUpdate = jest.fn();

jest.mock("../checkUpdates", () => ({
  tableRequiresUpdate: jest.fn(),
}));

describe("initializeRawChangeLogTable Tests", () => {
  const changelogName = "testChangelog";
  const bq = new BigQuery();
  const dataset = new Dataset(bq, "mock-dataset");
  const table = new Table(dataset, changelogName);
  const config: FirestoreBigQueryEventHistoryTrackerConfig = {
    wildcardIds: true,
    kmsKeyName: "testKey",
  } as unknown as FirestoreBigQueryEventHistoryTrackerConfig;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("initializes an existing table", async () => {
    mockExists.mockResolvedValue([true]);
    mockGetMetadata.mockResolvedValue([{ schema: { fields: [] } }]);
    mockTableRequiresUpdate.mockReturnValue(false);

    await initializeRawChangelogTable({
      changelogName,
      dataset,
      table,
      config,
    });

    expect(logs.bigQueryTableAlreadyExists).toHaveBeenCalledWith(
      table.id,
      dataset.id
    );
    expect(table.getMetadata).toHaveBeenCalled();
  });

  test("creates a new table when it does not exist", async () => {
    mockExists.mockResolvedValue([false]);

    await initializeRawChangelogTable({
      changelogName,
      dataset,
      table,
      config,
    });

    expect(logs.bigQueryTableCreating).toHaveBeenCalledWith(changelogName);
    expect(table.create).toHaveBeenCalled();
    expect(logs.bigQueryTableCreated).toHaveBeenCalledWith(changelogName);
  });

  test("handles errors during new table creation", async () => {
    const error = new Error("Creation failed");
    mockExists.mockResolvedValue([false]);
    mockExists.mockRejectedValue(error);

    await expect(
      initializeRawChangelogTable({ changelogName, dataset, table, config })
    ).rejects.toThrow("Creation failed");
    expect(logs.tableCreationError).toHaveBeenCalledWith(
      changelogName,
      error.message
    );
  });
});
