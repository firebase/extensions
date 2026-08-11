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
        { message: "no such field.", location: "path_params" },
      ]);
      const insert = jest.fn().mockRejectedValue(error);
      const tracker = trackerWith(insert);

      // Must start true, or asserting false below passes against an
      // implementation that never clears the flag at all.
      tracker._initialized = true;

      await expect(insertData(tracker)).rejects.toThrow("insert failed");

      expect(insert).toHaveBeenCalledTimes(2);
      expect(handleFailedTransactionsMock).toHaveBeenCalledTimes(1);
      expect(tracker._initialized).toBe(false);
    });

    it("does not match a column that merely contains an allowlisted name", async () => {
      // A user column named document_id_v2 must not be mistaken for
      // document_id, or its contents would be silently dropped.
      const insert = jest
        .fn()
        .mockRejectedValue(
          partialFailure([{ message: "no such field: document_id_v2." }])
        );

      await expect(insertData(trackerWith(insert))).rejects.toThrow(
        "insert failed"
      );

      expect(insert).toHaveBeenCalledTimes(1);
    });

    it.each(["document_id", "path_params", "old_data"])(
      "covers %s, every column added to an existing table",
      async (column) => {
        // Dropping any of these from the allowlist would turn a row that lands
        // today, with that column null, into an event lost once the caller
        // exhausts its retries.
        const insert = jest
          .fn()
          .mockRejectedValueOnce(
            partialFailure([{ message: "no such field.", location: column }])
          )
          .mockResolvedValueOnce(undefined);

        await expect(insertData(trackerWith(insert))).resolves.toBeUndefined();

        expect(insert).toHaveBeenCalledTimes(2);
        expect(insert.mock.calls[1][1]).toMatchObject({
          ignoreUnknownValues: true,
        });
      }
    );
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

  describe("the user-configured partition column", () => {
    // addPartitioningToSchema adds this column to an existing table too, so it
    // has the same exposure as the other three.
    const partitioned = {
      partitioning: {
        granularity: "HOUR",
        bigqueryColumnName: "created_at",
        bigqueryColumnType: "TIMESTAMP",
        firestoreFieldName: "createdAt",
      },
    } as Partial<ChangeTrackerConfig>;

    it("is treated as schema lag when field partitioning is configured", async () => {
      const insert = jest
        .fn()
        .mockRejectedValueOnce(
          partialFailure([
            { message: "no such field.", location: "created_at" },
          ])
        )
        .mockResolvedValueOnce(undefined);

      await expect(
        insertData(trackerWith(insert, partitioned))
      ).resolves.toBeUndefined();

      expect(insert).toHaveBeenCalledTimes(2);
      expect(insert.mock.calls[1][1]).toMatchObject({
        ignoreUnknownValues: true,
      });
    });

    it("is not allowlisted when no partitioning is configured", async () => {
      const insert = jest
        .fn()
        .mockRejectedValue(
          partialFailure([
            { message: "no such field.", location: "created_at" },
          ])
        );

      await expect(insertData(trackerWith(insert))).rejects.toThrow(
        "insert failed"
      );

      expect(insert).toHaveBeenCalledTimes(1);
    });
  });

  describe("a transient blip followed by a schema lag", () => {
    it("can still retry the schema lag", async () => {
      // The two retries are tracked separately, so the blip must not consume
      // the one the lag needs. Without that, the row is lost.
      const insert = jest
        .fn()
        .mockRejectedValueOnce(transportFailure())
        .mockRejectedValueOnce(
          partialFailure([
            { message: "no such field.", location: "document_id" },
          ])
        )
        .mockResolvedValueOnce(undefined);

      await expect(insertData(trackerWith(insert))).resolves.toBeUndefined();

      expect(insert).toHaveBeenCalledTimes(3);
      expect(insert.mock.calls[1][1]).toMatchObject({
        ignoreUnknownValues: false,
      });
      expect(insert.mock.calls[2][1]).toMatchObject({
        ignoreUnknownValues: true,
      });
      expect(handleFailedTransactionsMock).not.toHaveBeenCalled();
    });

    it("spends each retry at most once, bounding attempts at three", async () => {
      const insert = jest
        .fn()
        .mockRejectedValueOnce(transportFailure())
        .mockRejectedValueOnce(
          partialFailure([
            { message: "no such field.", location: "document_id" },
          ])
        )
        .mockRejectedValue(transportFailure());

      await expect(insertData(trackerWith(insert))).rejects.toThrow(
        "ECONNRESET"
      );

      expect(insert).toHaveBeenCalledTimes(3);
      expect(handleFailedTransactionsMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("malformed failures", () => {
    it("survives a null entry in the errors array", async () => {
      // Not producible by the current library, but classifying must never throw
      // from inside the catch block: that would lose the real error and skip
      // the backup entirely.
      const insert = jest.fn().mockRejectedValue({
        message: "insert failed",
        response: { insertErrors: [{ index: 0, errors: [null] }] },
      });

      await expect(insertData(trackerWith(insert))).rejects.toMatchObject({
        message: "insert failed",
      });

      expect(insert).toHaveBeenCalledTimes(1);
      expect(handleFailedTransactionsMock).toHaveBeenCalledTimes(1);
    });

    it("survives a non-object thrown value", async () => {
      const insert = jest.fn().mockRejectedValue(undefined);

      await expect(insertData(trackerWith(insert))).rejects.toBeUndefined();

      expect(handleFailedTransactionsMock).toHaveBeenCalledTimes(1);
    });

    it("still reports the insert error when error logging hits a bad entry", async () => {
      // `e.errors` is the library's remapped copy and is logged on the terminal
      // path. A bad entry there must not replace the error the caller sees.
      const error: any = new Error("insert failed");
      error.errors = [null];
      error.response = {
        insertErrors: [
          { index: 0, errors: [{ message: "no such field.", location: "x" }] },
        ],
      };

      const insert = jest.fn().mockRejectedValue(error);

      await expect(insertData(trackerWith(insert))).rejects.toThrow(
        "insert failed"
      );

      expect(handleFailedTransactionsMock).toHaveBeenCalledTimes(1);
    });

    it("still reports the insert error when errors is not an array", async () => {
      const error: any = new Error("insert failed");
      error.errors = { nested: "not an array" };

      const insert = jest.fn().mockRejectedValue(error);

      await expect(insertData(trackerWith(insert))).rejects.toThrow(
        "insert failed"
      );
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

    it("does not let its own failure mask the insert error", async () => {
      handleFailedTransactionsMock.mockRejectedValueOnce(
        new Error("firestore batch failed")
      );

      const insert = jest
        .fn()
        .mockRejectedValue(
          partialFailure([{ message: "no such field.", location: "user_age" }])
        );

      // The caller needs the real cause to decide whether to retry, so the
      // backup error must not replace it.
      await expect(insertData(trackerWith(insert))).rejects.toThrow(
        "insert failed"
      );

      expect(handleFailedTransactionsMock).toHaveBeenCalledTimes(1);
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
