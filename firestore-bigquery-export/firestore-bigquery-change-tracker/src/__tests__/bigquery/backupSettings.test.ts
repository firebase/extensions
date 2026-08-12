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

import { ChangeTrackerConfig } from "../../bigquery/types";

const commit = jest.fn();
const set = jest.fn();
const settings = jest.fn();

const batch = jest.fn(() => ({ set, commit }));
const collection = jest.fn(() => ({ doc: (id: string) => ({ id }) }));

jest.mock("firebase-admin", () => ({ apps: [{}] }));
jest.mock("firebase-admin/app", () => ({ initializeApp: jest.fn() }));
jest.mock("firebase-admin/firestore", () => ({
  // A fresh object per call, deliberately: the guard must key on the database
  // id rather than on instance identity, so this would catch a guard that
  // relied on getting the same object back.
  getFirestore: jest.fn(() => ({ settings, batch, collection })),
}));

const config = {
  backupTableId: "bq_failures",
  firestoreInstanceId: "(default)",
} as ChangeTrackerConfig;

const ROWS = [{ insertId: "e1", json: { event_id: "e1" } }];

/** Fresh module, so the module-level "already configured" set starts empty. */
const loadHandler = () => {
  let handler: any;
  jest.isolateModules(() => {
    handler = require("../../bigquery/handleFailedTransactions").default;
  });
  return handler;
};

describe("handleFailedTransactions Firestore settings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    commit.mockResolvedValue(undefined);
    settings.mockImplementation(() => undefined);
  });

  it("applies settings once across repeated failures", async () => {
    // `settings()` may only be called once per instance, and only before the
    // instance is used. Calling it on every batch threw on every call after the
    // first, so only one failure per function instance was ever backed up.
    const handler = loadHandler();

    await handler(ROWS, config, new Error("insert failed"));
    await handler(ROWS, config, new Error("insert failed"));

    expect(settings).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledTimes(2);
  });

  it("still writes the backup when settings cannot be applied", async () => {
    // Another part of the process may have reached the instance first. That
    // costs `ignoreUndefinedProperties`, not the backup itself.
    settings.mockImplementation(() => {
      throw new Error("Firestore has already been initialized");
    });

    const handler = loadHandler();

    await expect(
      handler(ROWS, config, new Error("insert failed"))
    ).resolves.toBeUndefined();

    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("still writes the backup when the thrown value is not an Error", async () => {
    // `insertData` reports whatever it caught, so this reaches the handler.
    // Reading `.message` off it threw a TypeError, which the caller reported as
    // a failed backup, so nothing was written for the very failures where the
    // row is least recoverable from elsewhere. The retry suite could not catch
    // this: it mocks this module, so it only proves the call site was reached.
    const handler = loadHandler();

    await expect(
      handler(ROWS, config, undefined as any)
    ).resolves.toBeUndefined();

    expect(commit).toHaveBeenCalledTimes(1);
    expect(typeof set.mock.calls[0][1].error_details).toBe("string");
  });

  it("writes one document per row, keyed by insertId", async () => {
    const handler = loadHandler();

    await handler(
      [{ insertId: "a" }, { insertId: "b" }],
      config,
      new Error("boom")
    );

    expect(collection).toHaveBeenCalledWith("bq_failures");
    expect(set).toHaveBeenCalledTimes(2);
    expect(set.mock.calls[0][0]).toMatchObject({ id: "a" });
    expect(set.mock.calls[0][1]).toMatchObject({ error_details: "boom" });
  });
});

/**
 * A stand-in for `@google-cloud/bigquery`'s `PartialFailureError`, built the
 * same way: one entry per failed row, each nesting the per-field errors, and a
 * top-level `message` that `@google-cloud/common` leaves empty because those
 * entries carry no `message` of their own.
 */
const partialFailure = (groups: any[]) =>
  Object.assign(new Error(""), { name: "PartialFailureError", errors: groups });

describe("handleFailedTransactions error details", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    commit.mockResolvedValue(undefined);
    settings.mockImplementation(() => undefined);
  });

  const detailsFor = async (e: any) => {
    // Cleared per call, so a test may describe more than one failure shape.
    set.mockClear();

    await loadHandler()(ROWS, config, e);

    return set.mock.calls[0][1].error_details;
  };

  it("records the nested per-field messages when the top-level message is empty", async () => {
    // The observed failure. `PartialFailureError.message` is "", and `??` only
    // falls back on null and undefined, so every backup document written for a
    // real rejected insert recorded an empty string and told the operator
    // nothing about why the row failed.
    const details = await detailsFor(
      partialFailure([
        {
          errors: [
            { message: "no such field: document_id.", reason: "invalid" },
          ],
          row: { insertId: "e1" },
        },
      ])
    );

    expect(details).toBe("no such field: document_id.");
  });

  it("deduplicates messages shared across failed rows", async () => {
    // A batch normally fails the same way for every row, so repeating one
    // message 500 times would push out the detail that differs.
    const details = await detailsFor(
      partialFailure([
        { errors: [{ message: "no such field: document_id." }] },
        { errors: [{ message: "no such field: document_id." }] },
        { errors: [{ message: "no such field: old_data." }] },
      ])
    );

    expect(details).toBe(
      "no such field: document_id.; no such field: old_data."
    );
  });

  it("caps the number of messages and the total length", async () => {
    // `error_details` is a Firestore field, so it must not grow with the
    // number of distinct failures in the batch.
    const details = await detailsFor(
      partialFailure(
        Array.from({ length: 9 }, (_, i) => ({
          errors: [{ message: `${"x".repeat(400)} ${i}` }],
        }))
      )
    );

    expect(details).toHaveLength(1000);
    expect(details.endsWith("...")).toBe(true);

    const short = await detailsFor(
      partialFailure(
        Array.from({ length: 8 }, (_, i) => ({
          errors: [{ message: `field ${i}` }],
        }))
      )
    );

    expect(short).toBe("field 0; field 1; field 2; field 3; field 4 (+3 more)");
  });

  it("prefers a populated top-level message over the nested ones", async () => {
    const details = await detailsFor(
      Object.assign(new Error("quota exceeded"), {
        errors: [{ errors: [{ message: "no such field: document_id." }] }],
      })
    );

    expect(details).toBe("quota exceeded");
  });

  it("still writes a string for every malformed shape of `errors`", async () => {
    // This runs inside the caller's catch block: anything thrown here is
    // reported as a failed backup and the row is lost, so no shape of the
    // caught value may throw.
    const shapes: any[] = [
      partialFailure([]),
      Object.assign(new Error(""), { errors: "not an array" }),
      Object.assign(new Error(""), { errors: [null, undefined] }),
      Object.assign(new Error(""), { errors: [{ errors: null }] }),
      Object.assign(new Error(""), { errors: [{ errors: [null] }] }),
      Object.assign(new Error(""), { errors: [{ errors: [{}] }] }),
      Object.assign(new Error(""), { errors: [{ errors: [{ message: 42 }] }] }),
      "a plain string",
      42,
      null,
      Object.create(null),
    ];

    for (const shape of shapes) {
      jest.clearAllMocks();

      await expect(loadHandler()(ROWS, config, shape)).resolves.toBeUndefined();

      expect(typeof set.mock.calls[0][1].error_details).toBe("string");
    }
  });
});
