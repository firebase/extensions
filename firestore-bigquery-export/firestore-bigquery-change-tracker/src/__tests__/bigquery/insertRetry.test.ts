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
 * The error shape `@google-cloud/bigquery` actually throws: `response` is the raw
 * `insertAll` body, where `insertErrors` is an array, and the error's own
 * `errors` is the remapped copy that drops `location`.
 */
function partialFailure(
  fieldErrors: Array<{ message: string; location?: string; reason?: string }>
) {
  // BigQuery always sets a reason on these entries, and classification reads it.
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

/**
 * Carries every column the allowlist can name, so that asserting one was removed
 * cannot pass because the key was never there.
 */
const ROWS = [
  {
    insertId: "e1",
    json: {
      event_id: "e1",
      data: "{}",
      document_id: "d1",
      old_data: null,
      path_params: "{}",
      created_at: "2026-01-01 00:00:00",
    },
  },
];

/** The payload of the row passed to the nth `insert` call, 0-indexed. */
const payloadOf = (insert: jest.Mock, call: number) =>
  insert.mock.calls[call][0][0].json;

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
    it("retries once without the rejected column, and succeeds", async () => {
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
      expect(payloadOf(insert, 0)).toHaveProperty("document_id");
      expect(payloadOf(insert, 1)).not.toHaveProperty("document_id");
      expect(payloadOf(insert, 1)).toMatchObject({
        event_id: "e1",
        data: "{}",
      });
      expect(insert.mock.calls[1][1]).toMatchObject({
        ignoreUnknownValues: false,
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
      expect(payloadOf(insert, 1)).not.toHaveProperty("path_params");
    });

    it("does not ignore an unknown field BigQuery did not name", async () => {
      // BigQuery names one unknown field per row, so a stray key alongside a
      // lagging column only surfaces on the retry.
      const insert = jest
        .fn()
        .mockRejectedValueOnce(
          partialFailure([
            { message: "no such field.", location: "document_id" },
          ])
        )
        .mockRejectedValueOnce(
          partialFailure([{ message: "no such field.", location: "injected" }])
        );

      await expect(insertData(trackerWith(insert))).rejects.toThrow(
        "insert failed"
      );

      expect(insert).toHaveBeenCalledTimes(2);
      expect(payloadOf(insert, 1)).not.toHaveProperty("document_id");
      expect(handleFailedTransactionsMock).toHaveBeenCalledTimes(1);
    });

    it("strips one column per retry when BigQuery names them one at a time", async () => {
      const insert = jest
        .fn()
        .mockRejectedValueOnce(
          partialFailure([{ message: "no such field.", location: "old_data" }])
        )
        .mockRejectedValueOnce(
          partialFailure([
            { message: "no such field.", location: "document_id" },
          ])
        )
        .mockResolvedValueOnce(undefined);

      await expect(insertData(trackerWith(insert))).resolves.toBeUndefined();

      expect(insert).toHaveBeenCalledTimes(3);
      expect(payloadOf(insert, 1)).not.toHaveProperty("old_data");
      expect(payloadOf(insert, 2)).not.toHaveProperty("old_data");
      expect(payloadOf(insert, 2)).not.toHaveProperty("document_id");
      expect(handleFailedTransactionsMock).not.toHaveBeenCalled();
    });

    it("ignores stopped rows when recognising the lag", async () => {
      // With `skipInvalidRows` false BigQuery marks the rows it did not attempt
      // as `stopped`, with the empty message and location a live instance sends,
      // so `reason` is the only thing identifying the entry.
      const insert = jest
        .fn()
        .mockRejectedValueOnce(
          partialFailure([
            { message: "", location: "", reason: "stopped" },
            { message: "no such field.", location: "document_id" },
          ])
        )
        .mockResolvedValueOnce(undefined);

      await expect(insertData(trackerWith(insert))).resolves.toBeUndefined();

      expect(insert).toHaveBeenCalledTimes(2);
      expect(payloadOf(insert, 1)).not.toHaveProperty("document_id");
      expect(handleFailedTransactionsMock).not.toHaveBeenCalled();
    });

    it("names a column once however many rows rejected it", async () => {
      const insert = jest
        .fn()
        .mockRejectedValueOnce(
          partialFailure([
            { message: "no such field.", location: "document_id" },
            { message: "no such field.", location: "document_id" },
          ])
        )
        .mockResolvedValueOnce(undefined);

      const warn = jest
        .spyOn(logger, "warn")
        .mockImplementation(() => undefined);

      await expect(insertData(trackerWith(insert))).resolves.toBeUndefined();

      const messages = warn.mock.calls.map(([message]) => String(message));
      warn.mockRestore();

      expect(
        messages.some((m) => m.includes("without document_id, document_id"))
      ).toBe(false);
      expect(messages.some((m) => m.includes("without document_id"))).toBe(
        true
      );
    });

    it("gives up when a retry makes no progress", async () => {
      // Bounds the recursion: the same column rejected twice means removing it
      // did not help.
      const insert = jest
        .fn()
        .mockRejectedValue(
          partialFailure([
            { message: "no such field.", location: "document_id" },
          ])
        );

      await expect(insertData(trackerWith(insert))).rejects.toThrow(
        "insert failed"
      );

      expect(insert).toHaveBeenCalledTimes(2);
      expect(handleFailedTransactionsMock).toHaveBeenCalledTimes(1);
    });

    it("backs up and throws when the retry also fails", async () => {
      const error = partialFailure([
        { message: "no such field.", location: "path_params" },
      ]);
      const insert = jest.fn().mockRejectedValue(error);
      const tracker = trackerWith(insert, { wildcardIds: true });

      // Must start true, or asserting false below passes against an
      // implementation that never clears the flag.
      tracker._initialized = true;

      await expect(insertData(tracker)).rejects.toThrow("insert failed");

      expect(insert).toHaveBeenCalledTimes(2);
      expect(handleFailedTransactionsMock).toHaveBeenCalledTimes(1);
      expect(tracker._initialized).toBe(false);
    });

    it("backs up the row the caller gave us, not the one the retry reduced", async () => {
      // A strip followed by a terminal rejection for a different column is the
      // ordinary case, and the backup is the only record of the row.
      const insert = jest
        .fn()
        .mockRejectedValueOnce(
          partialFailure([{ message: "no such field: document_id." }])
        )
        .mockRejectedValueOnce(
          partialFailure([{ message: "no such field: injected_col." }])
        );

      await expect(insertData(trackerWith(insert))).rejects.toThrow(
        "insert failed"
      );

      // Without this the assertion below could pass against an implementation
      // that never stripped anything.
      expect(payloadOf(insert, 1)).not.toHaveProperty("document_id");
      expect(handleFailedTransactionsMock).toHaveBeenCalledWith(
        ROWS,
        expect.anything(),
        expect.anything()
      );
    });

    it("clears initialization so a column that is really gone comes back", async () => {
      // Nothing here can tell a lagging column from one that was actually
      // dropped, so a warm instance must not strip it for its whole life.
      const insert = jest
        .fn()
        .mockRejectedValueOnce(
          partialFailure([{ message: "no such field: old_data." }])
        )
        .mockResolvedValueOnce(undefined);

      const tracker = trackerWith(insert);
      tracker._initialized = true;

      await expect(insertData(tracker)).resolves.toBeUndefined();

      expect(insert).toHaveBeenCalledTimes(2);
      expect(tracker._initialized).toBe(false);
    });

    it("does not match a column that merely contains an allowlisted name", async () => {
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

    // `path_params` needs its own config: the column is only added, and the key
    // only emitted, when wildcard ids are enabled.
    const addedColumns: Array<[string, Partial<ChangeTrackerConfig>]> = [
      ["document_id", {}],
      ["old_data", {}],
      ["path_params", { wildcardIds: true }],
    ];

    it.each(addedColumns)(
      "covers %s, every column added to an existing table",
      async (column, overrides) => {
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
        expect(payloadOf(insert, 1)).not.toHaveProperty(column);
      }
    );

    it("does not allowlist path_params when wildcard ids are disabled", async () => {
      // The column is never created here, but a transform function can still
      // inject the key, since `transformRows` uses its response verbatim.
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
    const partitioned = {
      partitioning: {
        granularity: "HOUR",
        bigqueryColumnName: "created_at",
        bigqueryColumnType: "TIMESTAMP",
        firestoreFieldName: "createdAt",
      },
    } as Partial<ChangeTrackerConfig>;

    it("is not allowlisted, even under the strategy that adds it", async () => {
      // `tableRequiresUpdate` is false for a table that is already
      // time-partitioned, so on exactly that table the column is never added.
      const insert = jest
        .fn()
        .mockRejectedValue(
          partialFailure([
            { message: "no such field.", location: "created_at" },
          ])
        );

      await expect(
        insertData(trackerWith(insert, partitioned))
      ).rejects.toThrow("insert failed");

      expect(insert).toHaveBeenCalledTimes(1);
      expect(handleFailedTransactionsMock).toHaveBeenCalledTimes(1);
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
      // Excluded deliberately rather than for want of a code path: `timestamp`
      // keys the partition and orders the latest view, so a null misfiles the
      // row instead of costing an event the caller can retry.
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
      expect(payloadOf(insert, 1)).toHaveProperty("document_id");
      expect(payloadOf(insert, 2)).not.toHaveProperty("document_id");
      expect(handleFailedTransactionsMock).not.toHaveBeenCalled();
    });

    it("spends the transient retry at most once", async () => {
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
    it("can still retry the blip, and keeps the column stripped", async () => {
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
      expect(payloadOf(insert, 0)).toHaveProperty("document_id");
      expect(payloadOf(insert, 1)).not.toHaveProperty("document_id");
      expect(payloadOf(insert, 2)).not.toHaveProperty("document_id");
      expect(handleFailedTransactionsMock).not.toHaveBeenCalled();
    });
  });

  describe("malformed failures", () => {
    it("survives a null entry in the errors array", async () => {
      // Not producible by the current library, but classifying runs inside the
      // catch block, where a throw loses the real error and skips the backup.
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

      // Only shows the backup was reached, since the module is mocked here. That
      // it writes a row for a non-Error is pinned in backupSettings.test.ts.
      expect(handleFailedTransactionsMock).toHaveBeenCalledTimes(1);
    });

    it("still reports the insert error when error logging hits a bad entry", async () => {
      // `e.errors` is the remapped copy logged on the terminal path.
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
      // A rate limit or backend error arrives as a partial failure rather than a
      // bare transport error.
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
      // Fails closed: an entry we cannot classify is not evidence of a blip.
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

      // This failure never reaches a second attempt, so a backup condition keyed
      // on "this is the second attempt" would skip it.
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
      // Debug is suppressed at the default log level.
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
          String(message).includes("without document_id")
        )
      ).toHaveLength(1);
      expect(
        debug.mock.calls.filter(([message]) =>
          String(message).includes("without document_id")
        )
      ).toHaveLength(0);
    });

    it("names the columns it dropped", async () => {
      const insert = jest
        .fn()
        .mockRejectedValueOnce(
          partialFailure([{ message: "no such field.", location: "old_data" }])
        )
        .mockResolvedValueOnce(undefined);

      await expect(insertData(trackerWith(insert))).resolves.toBeUndefined();

      const messages = warn.mock.calls.map(([message]) => String(message));

      expect(messages.some((m) => m.includes("without old_data"))).toBe(true);
    });

    it("distinguishes the retry that drops columns from the one that does not", async () => {
      // Only one of the two retries drops columns, and the logs are the only
      // thing telling an operator which one ran.
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
        message.includes("without document_id")
      );

      expect(dropped).toHaveLength(1);
      expect(dropped[0]).toContain(`${ROWS.length} row(s)`);
      expect(
        messages.filter((message) => message.includes("transient"))
      ).toHaveLength(1);
    });
  });
});
