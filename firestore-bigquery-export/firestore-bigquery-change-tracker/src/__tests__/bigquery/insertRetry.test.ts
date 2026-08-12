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
import { logger } from "../../logger";

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
  fieldErrors: Array<{ message: string; location?: string; reason?: string }>
) {
  // BigQuery always sets a reason on these entries, so default it rather than
  // leaving it undefined: classification reads it.
  const entries = fieldErrors.map((fieldError) => ({
    reason: "invalid",
    ...fieldError,
  }));

  const e: any = new Error("insert failed");
  e.name = "PartialFailureError";
  e.errors = [
    {
      row: {},
      errors: entries.map(({ message, reason }) => ({ message, reason })),
    },
  ];
  e.response = {
    kind: "bigquery#tableDataInsertAllResponse",
    insertErrors: [{ index: 0, errors: entries }],
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

      await expect(
        insertData(trackerWith(insert, { wildcardIds: true }))
      ).resolves.toBeUndefined();

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
      const tracker = trackerWith(insert, { wildcardIds: true });

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

    // `path_params` needs its own config: `initializeRawChangeLogTable` only
    // adds that column, and `record` only emits the key, when wildcard ids are
    // enabled.
    const addedColumns: Array<[string, Partial<ChangeTrackerConfig>]> = [
      ["document_id", {}],
      ["old_data", {}],
      ["path_params", { wildcardIds: true }],
    ];

    it.each(addedColumns)(
      "covers %s, every column added to an existing table",
      async (column, overrides) => {
        // Dropping any of these from the allowlist would turn a row that lands
        // today, with that column null, into an event lost once the caller
        // exhausts its retries.
        const insert = jest
          .fn()
          .mockRejectedValueOnce(
            partialFailure([{ message: "no such field.", location: column }])
          )
          .mockResolvedValueOnce(undefined);

        await expect(
          insertData(trackerWith(insert, overrides))
        ).resolves.toBeUndefined();

        expect(insert).toHaveBeenCalledTimes(2);
        expect(insert.mock.calls[1][1]).toMatchObject({
          ignoreUnknownValues: true,
        });
      }
    );

    it("does not allowlist path_params when wildcard ids are disabled", async () => {
      // Without wildcard ids the column is never created, so a rejected
      // `path_params` is not our schema lag. `transformRows` hands the response
      // of a user-supplied endpoint straight to the insert, so a transform can
      // inject the key: allowlisting it there would discard whatever the
      // transform put in it on every insert, forever, while still logging
      // success.
      const insert = jest
        .fn()
        .mockRejectedValue(
          partialFailure([
            { message: "no such field.", location: "path_params" },
          ])
        );

      await expect(insertData(trackerWith(insert))).rejects.toThrow(
        "insert failed"
      );

      expect(insert).toHaveBeenCalledTimes(1);
      expect(handleFailedTransactionsMock).toHaveBeenCalledTimes(1);
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

  describe("the user-configured partition column", () => {
    // addPartitioningToSchema adds this column to an existing table too, so it
    // has the same exposure as the base columns above.
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

    it("is not allowlisted under the Firestore timestamp strategy", async () => {
      // That strategy partitions by the base `timestamp` column. On a table
      // that lacks it the column really is added, so this is a deliberate
      // choice rather than dead code: `timestamp` orders the latest view and
      // keys the partition, so allowlisting it would silently misfile every
      // affected row for good, where failing writes a backup row and throws.
      const insert = jest
        .fn()
        .mockRejectedValue(
          partialFailure([{ message: "no such field.", location: "timestamp" }])
        );

      await expect(
        insertData(
          trackerWith(insert, {
            partitioning: {
              granularity: "DAY",
              bigqueryColumnName: "timestamp",
            },
          } as Partial<ChangeTrackerConfig>)
        )
      ).rejects.toThrow("insert failed");

      expect(insert).toHaveBeenCalledTimes(1);
      expect(handleFailedTransactionsMock).toHaveBeenCalledTimes(1);
    });

    it("is not allowlisted when field partitioning names a base column", async () => {
      // The exclusion is keyed on the collision, not on `timestamp`, so any
      // configured name that matches a base column reaches it.
      const insert = jest
        .fn()
        .mockRejectedValue(
          partialFailure([{ message: "no such field.", location: "data" }])
        );

      await expect(
        insertData(
          trackerWith(insert, {
            partitioning: {
              granularity: "DAY",
              bigqueryColumnName: "data",
              bigqueryColumnType: "TIMESTAMP",
              firestoreFieldName: "someField",
            },
          } as Partial<ChangeTrackerConfig>)
        )
      ).rejects.toThrow("insert failed");

      expect(insert).toHaveBeenCalledTimes(1);
      expect(handleFailedTransactionsMock).toHaveBeenCalledTimes(1);
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

  describe("a schema lag followed by a transient blip", () => {
    it("can still retry the blip, and keeps ignoring unknown values", async () => {
      // The schema-lag retry must hand the transient retry on rather than
      // spend it, and it must hand `ignoreUnknownValues` on with it. Losing
      // either turns the blip into a lost row or a repeat of the same
      // rejection.
      const insert = jest
        .fn()
        .mockRejectedValueOnce(
          partialFailure([
            { message: "no such field.", location: "document_id" },
          ])
        )
        .mockRejectedValueOnce(transportFailure())
        .mockResolvedValueOnce(undefined);

      await expect(insertData(trackerWith(insert))).resolves.toBeUndefined();

      expect(insert).toHaveBeenCalledTimes(3);
      expect(insert.mock.calls[0][1]).toMatchObject({
        ignoreUnknownValues: false,
      });
      expect(insert.mock.calls[1][1]).toMatchObject({
        ignoreUnknownValues: true,
      });
      expect(insert.mock.calls[2][1]).toMatchObject({
        ignoreUnknownValues: true,
      });
      expect(handleFailedTransactionsMock).not.toHaveBeenCalled();
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
    it("retries a partial failure whose reasons are all retryable", async () => {
      // A rate limit or backend error arrives as a partial failure, not as a
      // bare transport error. Classifying it as terminal would send a batch
      // BigQuery asked us to resend straight to the backup collection.
      const insert = jest
        .fn()
        .mockRejectedValueOnce(
          partialFailure([
            { message: "Backend error.", reason: "backendError" },
            { message: "Row skipped.", reason: "stopped" },
          ])
        )
        .mockResolvedValueOnce(undefined);

      await expect(insertData(trackerWith(insert))).resolves.toBeUndefined();

      expect(insert).toHaveBeenCalledTimes(2);
      // Never with ignoreUnknownValues: nothing here says a column is unknown.
      expect(insert.mock.calls[1][1]).toMatchObject({
        ignoreUnknownValues: false,
      });
      expect(handleFailedTransactionsMock).not.toHaveBeenCalled();
    });

    it("does not retry when any reason is not retryable", async () => {
      const insert = jest.fn().mockRejectedValue(
        partialFailure([
          { message: "Backend error.", reason: "backendError" },
          { message: "Cannot convert value.", reason: "invalid" },
        ])
      );

      await expect(insertData(trackerWith(insert))).rejects.toThrow(
        "insert failed"
      );

      expect(insert).toHaveBeenCalledTimes(1);
      expect(handleFailedTransactionsMock).toHaveBeenCalledTimes(1);
    });

    it("does not retry a partial failure with no reason to judge", async () => {
      // Fail closed: an entry we cannot classify is not evidence of a blip.
      const insert = jest
        .fn()
        .mockRejectedValue(
          partialFailure([{ message: "", reason: undefined }])
        );

      await expect(insertData(trackerWith(insert))).rejects.toThrow(
        "insert failed"
      );

      expect(insert).toHaveBeenCalledTimes(1);
    });

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

  describe("retry logging", () => {
    let debug: jest.SpyInstance;
    let warn: jest.SpyInstance;

    beforeEach(() => {
      debug = jest.spyOn(logger, "debug").mockImplementation(() => undefined);
      warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined);
    });

    afterEach(() => {
      debug.mockRestore();
      warn.mockRestore();
    });

    it("warns rather than debugs when a retry drops columns", async () => {
      // Debug is suppressed at the default log level, so an operator would
      // have to already suspect the loss to see the only record of it.
      const insert = jest
        .fn()
        .mockRejectedValueOnce(
          partialFailure([
            { message: "no such field.", location: "document_id" },
          ])
        )
        .mockResolvedValueOnce(undefined);

      await expect(insertData(trackerWith(insert))).resolves.toBeUndefined();

      expect(
        warn.mock.calls.filter(([message]) =>
          String(message).includes("ignoring unknown columns")
        )
      ).toHaveLength(1);
      expect(
        debug.mock.calls.filter(([message]) =>
          String(message).includes("ignoring unknown columns")
        )
      ).toHaveLength(0);
    });

    it("distinguishes the retry that drops columns from the one that does not", async () => {
      // Only the schema-lag retry discards unknown columns. An operator
      // investigating suspected column loss has nothing else to tell the two
      // retries apart, so one message must not stand for both.
      const insert = jest
        .fn()
        .mockRejectedValueOnce(
          partialFailure([
            { message: "no such field.", location: "document_id" },
          ])
        )
        .mockRejectedValueOnce(transportFailure())
        .mockResolvedValueOnce(undefined);

      await expect(insertData(trackerWith(insert))).resolves.toBeUndefined();

      const messages = [...debug.mock.calls, ...warn.mock.calls].map(
        ([message]) => String(message)
      );
      const dropped = messages.filter((message) =>
        message.includes("ignoring unknown columns")
      );

      expect(dropped).toHaveLength(1);
      expect(dropped[0]).toContain(`${ROWS.length} row(s)`);
      expect(
        messages.filter((message) => message.includes("transient"))
      ).toHaveLength(1);
    });
  });
});
