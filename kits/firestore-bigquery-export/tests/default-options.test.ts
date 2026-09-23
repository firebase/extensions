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

import { setGlobalOptions, type GlobalOptions } from "firebase-functions";
import * as v2Options from "firebase-functions/options";
import { afterEach, describe, expect, test, vi } from "vitest";

// Each entry load registers the lifecycle hooks again, which the SDK allows only once per process.
vi.mock("firebase-functions/v2/lifecycle", () => ({
  afterFirstDeploy: vi.fn(),
  afterRedeploy: vi.fn(),
}));

const FUNCTION_NAMES = [
  "fsexportbigquery",
  "syncBigQuery",
  "initBigQuerySync",
  "setupBigQuerySync",
] as const;

type FunctionName = (typeof FUNCTION_NAMES)[number];
type Endpoint = Record<string, unknown>;

/** `clearGlobalOptions` ships at runtime but is marked internal, so it is absent from the typings. */
const { clearGlobalOptions } = v2Options as unknown as {
  clearGlobalOptions: () => void;
};

afterEach(() => {
  clearGlobalOptions();
  vi.unstubAllEnvs();
});

/** Loads the entry after the wrapper's `setGlobalOptions` call and returns each function's deploy endpoint. */
async function loadEndpoints(
  globals?: GlobalOptions
): Promise<Record<FunctionName, Endpoint>> {
  vi.resetModules();
  vi.stubEnv("DATABASE_REGION", "");
  if (globals) {
    setGlobalOptions(globals);
  }
  const index: Record<string, unknown> = await import("../src/index");
  const endpoints = {} as Record<FunctionName, Endpoint>;
  for (const name of FUNCTION_NAMES) {
    const fn = index[name] as { __endpoint: Endpoint };
    expect(fn?.__endpoint, name).toBeDefined();
    endpoints[name] = fn.__endpoint;
  }
  return endpoints;
}

/** Asserts the endpoint leaves `key` to the platform default: absent, or the SDK's reset marker. */
function expectPlatformDefault(
  endpoint: Endpoint,
  key: string,
  label?: string
): void {
  const value = endpoint[key];
  if (value !== undefined) {
    expect(value, label).toBeInstanceOf(v2Options.RESET_VALUE.constructor);
  }
}

async function loadDefaultOptions() {
  vi.resetModules();
  const { defaultOptions } = await import("../src/default-options");
  return defaultOptions;
}

describe("defaultOptions", () => {
  test("holds the extension's runtime shape", async () => {
    expect(await loadDefaultOptions()).toEqual({
      cpu: "gcf_gen1",
      concurrency: 1,
      maxInstances: 100,
    });
  });

  test("imports without side effects when the entry would reject its params", async () => {
    vi.stubEnv("DATASET_ID", "");
    await expect(loadDefaultOptions()).resolves.toBeDefined();
    vi.resetModules();
    await expect(import("../src/index")).rejects.toThrow("DATASET_ID");
  });

  test("as the globals, gives every function 0.1666 vCPU and concurrency 1", async () => {
    const endpoints = await loadEndpoints(await loadDefaultOptions());
    for (const name of FUNCTION_NAMES) {
      expect(endpoints[name].cpu, name).toBe("gcf_gen1");
      expect(endpoints[name].concurrency, name).toBe(1);
    }
    expect(endpoints.fsexportbigquery.maxInstances).toBe(100);
    expect(endpoints.initBigQuerySync.maxInstances).toBe(100);
    expect(endpoints.setupBigQuerySync.maxInstances).toBe(100);
    expect(endpoints.syncBigQuery.maxInstances).toBe(500);
  });

  test("keys after the spread override the defaults, except syncBigQuery's instance cap", async () => {
    const endpoints = await loadEndpoints({
      ...(await loadDefaultOptions()),
      maxInstances: 5,
      cpu: 1,
    });
    expect(endpoints.fsexportbigquery.maxInstances).toBe(5);
    expect(endpoints.fsexportbigquery.cpu).toBe(1);
    expect(endpoints.syncBigQuery.maxInstances).toBe(500);
    expect(endpoints.syncBigQuery.cpu).toBe(1);
  });

  test("per-function ingress and timeout survive the globals", async () => {
    const endpoints = await loadEndpoints(await loadDefaultOptions());
    expect(endpoints.fsexportbigquery.ingressSettings).toBe(
      "ALLOW_INTERNAL_ONLY"
    );
    expectPlatformDefault(endpoints.fsexportbigquery, "timeoutSeconds");
    for (const name of FUNCTION_NAMES.slice(1)) {
      expectPlatformDefault(endpoints[name], "ingressSettings", name);
      expect(endpoints[name].timeoutSeconds, name).toBe(540);
    }
  });

  test("without the globals, every function falls back to the platform cpu and concurrency", async () => {
    const endpoints = await loadEndpoints();
    for (const name of FUNCTION_NAMES) {
      expectPlatformDefault(endpoints[name], "cpu", name);
      expectPlatformDefault(endpoints[name], "concurrency", name);
    }
    expectPlatformDefault(endpoints.fsexportbigquery, "maxInstances");
    expect(endpoints.syncBigQuery.maxInstances).toBe(500);
  });
});
