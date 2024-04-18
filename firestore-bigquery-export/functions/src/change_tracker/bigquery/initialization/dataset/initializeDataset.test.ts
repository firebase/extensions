import { initializeDataset } from "./initializeDataset";
import { Dataset } from "@google-cloud/bigquery";
import * as logs from "../../../logs";

jest.mock("@google-cloud/bigquery");
jest.mock("../../logs");
const mockCreate = jest.fn();
const mockExists = jest.fn();
const datasetId = "test-dataset";
const dataset = {
  id: datasetId,
  create: mockCreate,
  exists: mockExists,
} as unknown as Dataset;

describe("initializeDataset", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should not create dataset if it already exists", async () => {
    mockExists.mockResolvedValue([true]); // Simulate dataset already exists

    await initializeDataset({ dataset });

    expect(mockExists).toHaveBeenCalledTimes(1);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(logs.bigQueryDatasetExists).toHaveBeenCalledWith(datasetId);
  });

  test("should create dataset if it does not exist", async () => {
    mockExists.mockResolvedValue([false]); // Simulate dataset does not exist
    mockCreate.mockResolvedValue({}); // Simulate successful creation

    await initializeDataset({ dataset });

    expect(mockExists).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(logs.bigQueryDatasetCreated).toHaveBeenCalledWith(datasetId);
  });

  test("should log and throw an error if dataset creation fails", async () => {
    const error = new Error("Creation failed");
    mockExists.mockResolvedValue([false]);
    mockCreate.mockRejectedValue(error); // Simulate creation error

    await expect(initializeDataset({ dataset })).rejects.toThrow(
      "Creation failed"
    );

    expect(mockExists).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(logs.tableCreationError).toHaveBeenCalledWith(
      datasetId,
      error.message
    );
  });

  test("should handle unexpected error types gracefully", async () => {
    mockExists.mockRejectedValue("String error");

    await expect(initializeDataset({ dataset })).rejects.toThrow(
      "An unexpected error occurred during initializing dataset test-dataset."
    );

    expect(logs.tableCreationError).toHaveBeenCalledWith(
      datasetId,
      "An unexpected error occurred during initializing dataset test-dataset."
    );
  });
});
