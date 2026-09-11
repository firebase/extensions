/*
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

import { beforeAll, expect, test, vi } from "vitest";

// Only `requiresAPI` is stubbed; the rest of the barrel stays real so importing
// the entry point still registers the functions the way a deploy would.
const { requiresAPI } = vi.hoisted(() => ({ requiresAPI: vi.fn() }));

vi.mock("firebase-functions/v2", async (importOriginal) => ({
  ...(await importOriginal<typeof import("firebase-functions/v2")>()),
  requiresAPI,
}));

beforeAll(async () => {
  await import("../src/index");
});

test.each([
  [
    "firestore.googleapis.com",
    "Receives document change events and writes restoration run status to Cloud Firestore.",
  ],
  [
    "bigquery.googleapis.com",
    "Stores the changelog of captured Firestore document changes in BigQuery.",
  ],
  [
    "dataflow.googleapis.com",
    "Runs the restoration flex template that replays the changelog into the target database.",
  ],
])("declares %s", (api, reason) => {
  expect(requiresAPI).toHaveBeenCalledWith(api, reason);
});
