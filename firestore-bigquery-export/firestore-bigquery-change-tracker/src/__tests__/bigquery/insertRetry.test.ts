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

import { FirestoreBigQueryEventHistoryTracker } from "../../bigquery";
import { ChangeTrackerConfig } from "../../bigquery/types";
import handleFailedTransactions from "../../bigquery/handleFailedTransactions";

jest.mock("../../bigquery/handleFailedTransactions", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined),
}));

const handleFailedTransactionsMock = handleFailedTransactions as jest.Mock;

process.env.PROJECT_ID = "test-project";

const config = (
  overrides: Partial<ChangeTrackerConfig> = {}
): ChangeTrackerConfig =>
  ({
    datasetId: "dataset",
    tableId: "table",
    datasetLocation: "us",
    backupTableId: "backup",
    transformFunction: "",
    partitioning: { granularity: "NONE" },
    clustering: [],
    bqProjectId: "test-project",
    ...overrides,
  } as ChangeTrackerConfig);

/**
 * Builds the error shape `@google-cloud/bigquery` actually throws: a
 * `PartialFailureError` whose `response` is the raw `insertAll` body, where
 * `insertErrors` is an array. Its own `errors` property is the remapped copy
 * that drops `location`.
 */
function partialFailure(
  fieldErrors: Array<{ message: string; location?: string }>
) {
  const e: any = new Error("insert failed");
  e.name = "PartialFailureError";
  e.errors = [
    {
      row: {},
      errors: fieldErrors.map(({ message }) => ({
        message,
        reason: "invalid",
      })),
    },
  ];
  e.response = {
    kind: "bigquery#tableDataInsertAllResponse",
    insertErrors: [{ index: 0, errors: fieldErrors }],
  };
  return e;
}

/** An error with no partial-failure body, e.g. a network or quota failure. */
function transportFailure() {
  const e: any = new Error("ECONNRESET");
  e.code = "ECONNRESET";
  return e;
}

const ROWS = [{ insertId: "e1", json: { event_id: "e1" } }];

/**
 * Returns a tracker whose inserts are served by `insert`, so no BigQuery
 * client is needed.
 */
function trackerWith(
  insert: jest.Mock,
  overrides?: Partial<ChangeTrackerConfig>
) {
  const tracker = new FirestoreBigQueryEventHistoryTracker(config(overrides));

  jest.spyOn(tracker as any, "bigqueryDataset").mockReturnValue({
    table: () => ({ insert }),
  });

  return tracker;
}

/** Invokes the private insert path directly. */
const insertData = (tracker: FirestoreBigQueryEventHistoryTracker) =>
  (tracker as any).insertData(ROWS);

describe("insertData retry behaviour", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("a column we just added is not streamable yet", () => {
    it("retries once ignoring unknown values, and succeeds", async () => {
      const insert = jest
        .fn()
        .mockRejectedValueOnce(
          partialFailure([
            { message: "no such field.", location: "document_id" },
          ])
        )
        .mockResolvedValueOnce(undefined);

      await expect(insertData(trackerWith(insert))).resolves.toBeUndefined();

      expect(insert).toHaveBeenCalledTimes(2);
      expect(insert.mock.calls[0][1]).toMatchObject({
        ignoreUnknownValues: false,
      });
      expect(insert.mock.calls[1][1]).toMatchObject({
        ignoreUnknownValues: true,
      });
      expect(handleFailedTransactionsMock).not.toHaveBeenCalled();
    });

    it("matches the inlined message form that omits location", async () => {
      const insert = jest
        .fn()
        .mockRejectedValueOnce(
          partialFailure([{ message: "no such field: path_params." }])
        )
        .mockResolvedValueOnce(undefined);

      await expect(insertData(trackerWith(insert))).resolves.toBeUndefined();

      expect(insert).toHaveBeenCalledTimes(2);
      expect(insert.mock.calls[1][1]).toMatchObject({
        ignoreUnknownValues: true,
      });
    });

    it("backs up and throws when the retry also fails", async () => {
      const error = partialFailure([
        { message: "no such field.", location: "old_data" },
      ]);
      const insert = jest.fn().mockRejectedValue(error);
      const tracker = trackerWith(insert);

      await expect(insertData(tracker)).rejects.toThrow("insert failed");

      expect(insert).toHaveBeenCalledTimes(2);
      expect(handleFailedTransactionsMock).toHaveBeenCalledTimes(1);
      expect(tracker._initialized).toBe(false);
    });
  });

  describe("schema drift we did not add", () => {
    it("does not retry, and does not silently drop the field", async () => {
      const insert = jest
        .fn()
        .mockRejectedValue(
          partialFailure([{ message: "no such field.", location: "user_age" }])
        );

      await expect(insertData(trackerWith(insert))).rejects.toThrow(
        "insert failed"
      );

      expect(insert).toHaveBeenCalledTimes(1);
      expect(handleFailedTransactionsMock).toHaveBeenCalledTimes(1);
    });

    it("does not retry when only some rejected fields are ours", async () => {
      const insert = jest.fn().mockRejectedValue(
        partialFailure([
          { message: "no such field.", location: "document_id" },
          { message: "no such field.", location: "user_age" },
        ])
      );

      await expect(insertData(trackerWith(insert))).rejects.toThrow(
        "insert failed"
      );

      expect(insert).toHaveBeenCalledTimes(1);
    });

    it("does not retry a rejection that is not an unknown field", async () => {
      const insert = jest.fn().mockRejectedValue(
        partialFailure([
          {
            message: "Cannot convert value to timestamp.",
            location: "timestamp",
          },
        ])
      );

      await expect(insertData(trackerWith(insert))).rejects.toThrow(
        "insert failed"
      );

      expect(insert).toHaveBeenCalledTimes(1);
    });
  });

  describe("transient failures", () => {
    it("retries once with options unchanged", async () => {
      const insert = jest
        .fn()
        .mockRejectedValueOnce(transportFailure())
        .mockResolvedValueOnce(undefined);

      await expect(insertData(trackerWith(insert))).resolves.toBeUndefined();

      expect(insert).toHaveBeenCalledTimes(2);
      expect(insert.mock.calls[1][1]).toMatchObject({
        ignoreUnknownValues: false,
      });
      expect(handleFailedTransactionsMock).not.toHaveBeenCalled();
    });

    it("backs up and throws when the retry also fails", async () => {
      const insert = jest.fn().mockRejectedValue(transportFailure());

      await expect(insertData(trackerWith(insert))).rejects.toThrow(
        "ECONNRESET"
      );

      expect(insert).toHaveBeenCalledTimes(2);
      expect(handleFailedTransactionsMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("backup collection", () => {
    it("is skipped when no backupTableId is configured", async () => {
      const insert = jest
        .fn()
        .mockRejectedValue(
          partialFailure([{ message: "no such field.", location: "user_age" }])
        );

      await expect(
        insertData(trackerWith(insert, { backupTableId: undefined }))
      ).rejects.toThrow("insert failed");

      expect(handleFailedTransactionsMock).not.toHaveBeenCalled();
    });

    it("is used for a terminal failure on the first attempt", async () => {
      const insert = jest
        .fn()
        .mockRejectedValue(
          partialFailure([{ message: "no such field.", location: "user_age" }])
        );

      await expect(insertData(trackerWith(insert))).rejects.toThrow(
        "insert failed"
      );

      // Regression guard: this failure never reaches a second attempt, so a
      // backup condition keyed on "this is the second attempt" would skip it.
      expect(insert).toHaveBeenCalledTimes(1);
      expect(handleFailedTransactionsMock).toHaveBeenCalledTimes(1);
      expect(handleFailedTransactionsMock).toHaveBeenCalledWith(
        ROWS,
        expect.objectContaining({ backupTableId: "backup" }),
        expect.any(Error)
      );
    });
  });
});
