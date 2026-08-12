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
  // One instance per database id, as the real `getFirestore` returns.
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
