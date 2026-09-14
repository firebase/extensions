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

import { Expression } from "firebase-functions/params";
import { afterEach, describe, expect, test } from "vitest";

import { envDeployOptions } from "../src/config";

const cel = (value: unknown): string =>
  value instanceof Expression ? value.toCEL() : String(value);

const originalDatabaseRegion = process.env.DATABASE_REGION;

function setDatabaseRegion(value?: string): void {
  if (value === undefined) {
    delete process.env.DATABASE_REGION;
  } else {
    process.env.DATABASE_REGION = value;
  }
}

afterEach(() => {
  setDatabaseRegion(originalDatabaseRegion);
});

describe("envDeployOptions", () => {
  test("emits CEL for document and database", () => {
    const options = envDeployOptions();

    expect(options.document).toBeInstanceOf(Expression);
    expect(options.database).toBeInstanceOf(Expression);

    expect(cel(options.document)).toBe(
      "{{ params.MAIL_COLLECTION }}/{documentId}"
    );
    expect(cel(options.database)).toBe("{{ params.DATABASE }}");
  });

  test.each([
    ["nam5", "us-central1"],
    ["nam7", "us-central1"],
    ["eur3", "europe-west1"],
  ])(
    "multi-region DATABASE_REGION %s maps the function region to %s",
    (databaseRegion, expectedRegion) => {
      setDatabaseRegion(databaseRegion);
      expect(envDeployOptions().region).toBe(expectedRegion);
    }
  );

  test("regional DATABASE_REGION passes through as the function region", () => {
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

  test("serialized deploy-time options do not contain undefined", () => {
    setDatabaseRegion(undefined);
    const serialized = JSON.stringify(
      Object.fromEntries(
        Object.entries(envDeployOptions()).map(([key, value]) => [
          key,
          cel(value),
        ])
      )
    );

    expect(serialized).not.toContain("undefined");
  });
});
