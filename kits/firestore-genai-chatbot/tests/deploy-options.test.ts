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

import { Expression } from "firebase-functions/params";
import { afterEach, describe, expect, test, vi } from "vitest";

import { envDeployOptions } from "../src/config";

const TEST_PROJECT_ID = "test-project";

/**
 * These assert the CEL the params path emits into the deploy manifest. The bug
 * this guards against is resolving params with `.value()` at the module scope,
 * which freezes deploy-time defaults (e.g. the default `COLLECTION_NAME`) into
 * the manifest instead of leaving a `{{ params.X }}` expression the Firebase CLI
 * resolves after loading `.env` / prompting.
 */
const cel = (value: unknown): string =>
  value instanceof Expression ? value.toCEL() : String(value);

describe("envDeployOptions", () => {
  process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: TEST_PROJECT_ID });
  const options = envDeployOptions();

  test("document defers the collection path and keeps the message wildcard", () => {
    expect(cel(options.document)).toBe(
      "{{ params.COLLECTION_NAME }}/{messageId}"
    );
  });

  test("declares the extension's 540s timeout", () => {
    expect(options.timeoutSeconds).toBe(540);
  });

  test("document expression is not a frozen undefined/empty literal", () => {
    expect(options.document).toBeInstanceOf(Expression);
    expect(cel(options.document)).not.toContain("undefined");
  });
});

describe("envDeployOptions function region", () => {
  const original = process.env.DATABASE_REGION;

  function setDatabaseRegion(value?: string): void {
    if (value === undefined) {
      delete process.env.DATABASE_REGION;
    } else {
      process.env.DATABASE_REGION = value;
    }
  }

  afterEach(() => {
    setDatabaseRegion(original);
  });

  test.each([
    ["nam5", "us-central1"],
    ["nam7", "us-central1"],
    ["eur3", "europe-west1"],
  ])(
    "multi-region DATABASE_REGION %s places the function in %s",
    (databaseRegion, expectedRegion) => {
      setDatabaseRegion(databaseRegion);
      expect(envDeployOptions().region).toBe(expectedRegion);
    }
  );

  test("regional DATABASE_REGION places the function in that region", () => {
    setDatabaseRegion("europe-west1");
    expect(envDeployOptions().region).toBe("europe-west1");
  });

  test("unset DATABASE_REGION omits the region option", () => {
    setDatabaseRegion(undefined);
    expect(envDeployOptions()).not.toHaveProperty("region");
  });

  test("empty DATABASE_REGION omits the region option", () => {
    setDatabaseRegion("");
    expect(envDeployOptions()).not.toHaveProperty("region");
  });
});

describe("generateMessage deploy region", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function importRegion(
    databaseRegion: string | undefined
  ): Promise<string[] | undefined> {
    vi.resetModules();
    vi.stubEnv("DATABASE_REGION", databaseRegion);
    const { generateMessage } = await import("../src/index");

    return (generateMessage as unknown as { __endpoint: { region?: string[] } })
      .__endpoint.region;
  }

  test("a multi-region database location places the function in a Cloud Run region", async () => {
    expect(await importRegion("nam5")).toEqual(["us-central1"]);
  });

  test("a regional database location places the function in that region", async () => {
    expect(await importRegion("europe-west2")).toEqual(["europe-west2"]);
  });

  test("no database location leaves the function without a region", async () => {
    expect(await importRegion(undefined)).toBeUndefined();
  });
});
