/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { waitForInitialization } from "./utils";
import { Dataset, Table } from "@google-cloud/bigquery";
import * as logs from "../logs";

jest.mock("@google-cloud/bigquery");
jest.mock("../../logs");
const dataset = {
  exists: jest.fn(),
  table: jest.fn(),
};
const table = {
  exists: jest.fn(),
};
const changelogName = "testTable";

describe("waitForInitialization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
