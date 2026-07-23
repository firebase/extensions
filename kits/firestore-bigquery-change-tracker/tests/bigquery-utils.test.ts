import { Dataset, Table } from "@google-cloud/bigquery";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { waitForInitialization } from "../src/bigquery/utils";
import * as logs from "../src/logs";

vi.mock("@google-cloud/bigquery");
vi.mock("../src/logs");
const dataset = {
  exists: vi.fn(),
  table: vi.fn(),
};
const table = {
  exists: vi.fn(),
};
const changelogName = "testTable";

describe("waitForInitialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dataset.table.mockReturnValue(table);
  });

  test("should successfully find the dataset and table", async () => {
    dataset.exists.mockResolvedValue([true]);
    table.exists.mockResolvedValue([true]);

    const result = await waitForInitialization({
      dataset: dataset as unknown as Dataset,
      changelogName,
    });
    expect(result).toBe(table);
    expect(dataset.exists).toHaveBeenCalledTimes(1);
    expect(table.exists).toHaveBeenCalledTimes(1);
  });

  test("should fail after max attempts if table does not exist", async () => {
    dataset.exists.mockResolvedValue([true]);
    table.exists.mockResolvedValue([false]);

    await expect(
      waitForInitialization(
        { dataset: dataset as unknown as Dataset, changelogName },
        3
      )
    ).rejects.toThrow(
      "Initialization timed out. Dataset or table could not be verified to exist after multiple attempts."
    );
    expect(dataset.exists).toHaveBeenCalledTimes(3);
    expect(table.exists).toHaveBeenCalledTimes(3);
  });

  test("should handle and throw an error if dataset.exists throws", async () => {
    const error = new Error("Access denied");
    dataset.exists.mockRejectedValue(error);

    await expect(
      waitForInitialization({
        dataset: dataset as unknown as Dataset,
        changelogName,
      })
    ).rejects.toThrow("Access denied");
    expect(logs.failedToInitializeWait).toHaveBeenCalledWith(error.message);
  });

  test("should handle and throw an error if table.exists throws", async () => {
    dataset.exists.mockResolvedValue([true]);
    const error = new Error("Table error");
    table.exists.mockRejectedValue(error);

    await expect(
      waitForInitialization({
        dataset: dataset as unknown as Dataset,
        changelogName,
      })
    ).rejects.toThrow("Table error");
    expect(logs.failedToInitializeWait).toHaveBeenCalledWith(error.message);
  });

  test("should handle unexpected error types gracefully", async () => {
    dataset.exists.mockRejectedValue("String error");

    await expect(
      waitForInitialization({
        dataset: dataset as unknown as Dataset,
        changelogName,
      })
    ).rejects.toThrow("An unexpected error occurred");
    expect(logs.failedToInitializeWait).toHaveBeenCalledWith(
      "An unexpected error occurred"
    );
  });
});
