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

import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("firebase-functions/firestore", () => ({
  onDocumentWritten: vi.fn(() => ({})),
}));
vi.mock("firebase-functions/v2", () => ({
  requiresAPI: vi.fn(),
  requiresRole: vi.fn(),
}));

type FunctionOptions = Record<string, unknown>;

const originalDatabaseRegion = process.env.DATABASE_REGION;

afterEach(() => {
  if (originalDatabaseRegion === undefined) {
    delete process.env.DATABASE_REGION;
  } else {
    process.env.DATABASE_REGION = originalDatabaseRegion;
  }
});

async function loadTriggerOptions(
  databaseRegion?: string
): Promise<FunctionOptions> {
  vi.resetModules();
  if (databaseRegion === undefined) {
    delete process.env.DATABASE_REGION;
  } else {
    process.env.DATABASE_REGION = databaseRegion;
  }

  await import("../src/index");
  const { onDocumentWritten } = await import("firebase-functions/firestore");

  const calls = vi.mocked(onDocumentWritten).mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][0] as FunctionOptions;
}

describe("processQueue options", () => {
  test.each([
    ["nam5", "us-central1"],
    ["nam7", "us-central1"],
    ["eur3", "europe-west1"],
    ["NAM5", "us-central1"],
  ])(
    "multi-region DATABASE_REGION %s deploys the function to %s",
    async (databaseRegion, expectedRegion) => {
      const options = await loadTriggerOptions(databaseRegion);
      expect(options.region).toBe(expectedRegion);
    }
  );

  test("regional DATABASE_REGION passes through as the function region", async () => {
    const options = await loadTriggerOptions("europe-west1");
    expect(options.region).toBe("europe-west1");
  });

  test("unset DATABASE_REGION leaves the function without a region", async () => {
    const options = await loadTriggerOptions();
    expect(options).not.toHaveProperty("region");
  });

  test("empty DATABASE_REGION leaves the function without a region", async () => {
    const options = await loadTriggerOptions("");
    expect(options).not.toHaveProperty("region");
  });

  test("the trigger binds to the configured database and collection", async () => {
    const options = await loadTriggerOptions();
    expect(String(options.database)).toBe("params.DATABASE");
    const document = options.document as { toCEL(): string };
    expect(document.toCEL()).toContain("params.MAIL_COLLECTION");
  });
});
