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

  // Concurrency 80 let a burst of mail with attachments land on one 256MiB
  // instance, which ran out of memory and dropped it.
  test("the function runs one event per gen1 CPU instance with internal-only ingress", async () => {
    const options = await loadTriggerOptions();
    expect(options.concurrency).toBe(1);
    expect(options.cpu).toBe("gcf_gen1");
    expect(options.ingressSettings).toBe("ALLOW_INTERNAL_ONLY");
  });
});

describe("module load", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Deploy-time discovery imports the kit, so this is what fails the deploy.
  test("throws when a param value is invalid", async () => {
    vi.resetModules();
    vi.stubEnv("TTL_EXPIRE_TYPE", "days");

    await expect(import("../src/index")).rejects.toThrow(
      'TTL_EXPIRE_TYPE="days"'
    );
  });

  // The extension's select is case sensitive, so a DATABASE_REGION it rejected
  // no longer reaches the case-insensitive region lookup.
  test("throws on a DATABASE_REGION in the wrong case", async () => {
    vi.resetModules();
    vi.stubEnv("DATABASE_REGION", "NAM5");

    await expect(import("../src/index")).rejects.toThrow(
      'DATABASE_REGION="NAM5"'
    );
  });

  test("reports blank required and invalid params in one error", async () => {
    vi.resetModules();
    vi.stubEnv("DEFAULT_FROM", "");
    vi.stubEnv("TTL_EXPIRE_VALUE", "0");

    const load = import("../src/index");

    await expect(load).rejects.toThrow("DEFAULT_FROM");
    await expect(load).rejects.toThrow('TTL_EXPIRE_VALUE="0"');
  });
});
