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
import { afterEach, describe, expect, test, vi } from "vitest";

import { envDeployOptions } from "../src/config";

const cel = (value: unknown): string =>
  value instanceof Expression ? value.toCEL() : String(value);

describe("envDeployOptions", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("preserves the node path param in the discovery manifest", () => {
    vi.stubEnv("FUNCTIONS_CONTROL_API", "true");
    vi.stubEnv("RTDB_NODE_PATH", "ignored-during-discovery");

    const options = envDeployOptions();

    expect(typeof options.ref).toBe("string");
    expect(options.ref).toBe("{{ params.RTDB_NODE_PATH }}/{nodeId}");
  });

  test("uses the resolved node path at runtime", () => {
    vi.stubEnv("FUNCTIONS_CONTROL_API", "false");
    vi.stubEnv("RTDB_NODE_PATH", "/rooms/messages/");

    expect(envDeployOptions().ref).toBe("rooms/messages/{nodeId}");
  });

  test("instance is a param expression", () => {
    vi.stubEnv("FUNCTIONS_CONTROL_API", "true");
    const options = envDeployOptions();

    expect(options.instance).toBeInstanceOf(Expression);
    expect(cel(options.instance)).toBe(
      "{{ params.SELECTED_DATABASE_INSTANCE }}"
    );
  });

  test("does not set a function region", () => {
    vi.stubEnv("FUNCTIONS_CONTROL_API", "true");
    const options = envDeployOptions();

    expect(options).not.toHaveProperty("region");
  });

  test("no deploy-time option is a frozen undefined/empty literal", () => {
    vi.stubEnv("FUNCTIONS_CONTROL_API", "true");
    const options = envDeployOptions();

    expect(options.ref).not.toBe("");
    expect(cel(options.instance)).not.toBe("");
    expect(cel(options.instance)).not.toContain("undefined");
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

  test("the database location places the function in that region", () => {
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

describe("rtdblimit deploy region", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function importRegion(
    databaseRegion: string | undefined
  ): Promise<string[] | undefined> {
    vi.resetModules();
    vi.stubEnv("DATABASE_REGION", databaseRegion);
    const { rtdblimit } = await import("../src/index");

    return (rtdblimit as unknown as { __endpoint: { region?: string[] } })
      .__endpoint.region;
  }

  test("the database location places the function in that region", async () => {
    expect(await importRegion("europe-west1")).toEqual(["europe-west1"]);
  });

  test("no database location leaves the function without a region", async () => {
    expect(await importRegion(undefined)).toBeUndefined();
  });
});
