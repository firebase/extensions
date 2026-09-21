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
  onDocumentWritten: vi.fn((options: unknown) => ({ deployOptions: options })),
}));
vi.mock("firebase-functions/tasks", () => ({
  onTaskDispatched: vi.fn((options: unknown) => ({ deployOptions: options })),
}));
vi.mock("firebase-functions/v2", () => ({
  requiresAPI: vi.fn(),
  requiresRole: vi.fn(),
}));
vi.mock("firebase-functions/v2/lifecycle", () => ({
  afterFirstDeploy: vi.fn(),
  afterRedeploy: vi.fn(),
}));

type FunctionOptions = Record<string, unknown>;

interface ExportedOptions {
  trigger: FunctionOptions;
  /** Options of syncBigQuery, initBigQuerySync, setupBigQuerySync, in order. */
  tasks: FunctionOptions[];
}

const TASK_FUNCTIONS = [
  "syncBigQuery",
  "initBigQuerySync",
  "setupBigQuerySync",
] as const;

/** Expected `ingressSettings` per deployed function; `undefined` means the declaration sets none. */
const INGRESS_BY_FUNCTION: ReadonlyArray<
  [name: string, ingress: "ALLOW_INTERNAL_ONLY" | undefined]
> = [
  ["fsexportbigquery", "ALLOW_INTERNAL_ONLY"],
  ["syncBigQuery", undefined],
  ["initBigQuerySync", undefined],
  ["setupBigQuerySync", undefined],
];

const originalDatabaseRegion = process.env.DATABASE_REGION;

afterEach(() => {
  if (originalDatabaseRegion === undefined) {
    delete process.env.DATABASE_REGION;
  } else {
    process.env.DATABASE_REGION = originalDatabaseRegion;
  }
});

function isDeployed(
  value: unknown
): value is { deployOptions: FunctionOptions } {
  return (
    typeof value === "object" && value !== null && "deployOptions" in value
  );
}

/** The entry's exported functions by name, each with the options it was declared with. */
async function loadDeployedOptions(
  databaseRegion?: string
): Promise<Record<string, FunctionOptions>> {
  vi.resetModules();
  if (databaseRegion === undefined) {
    delete process.env.DATABASE_REGION;
  } else {
    process.env.DATABASE_REGION = databaseRegion;
  }

  const index: Record<string, unknown> = await import("../src/index");
  const deployed: Record<string, FunctionOptions> = {};
  for (const [name, value] of Object.entries(index)) {
    if (isDeployed(value)) {
      deployed[name] = value.deployOptions;
    }
  }
  return deployed;
}

async function loadExportedOptions(
  databaseRegion?: string
): Promise<ExportedOptions> {
  const deployed = await loadDeployedOptions(databaseRegion);
  const tasks = TASK_FUNCTIONS.map((name) => deployed[name]);
  expect(tasks).toHaveLength(3);
  return { trigger: deployed.fsexportbigquery, tasks };
}

function allOptions({ trigger, tasks }: ExportedOptions): FunctionOptions[] {
  return [trigger, ...tasks];
}

describe("exported function options", () => {
  test.each([
    ["nam5", "us-central1"],
    ["nam7", "us-central1"],
    ["eur3", "europe-west1"],
  ])(
    "multi-region DATABASE_REGION %s deploys every function to %s",
    async (databaseRegion, expectedRegion) => {
      const options = await loadExportedOptions(databaseRegion);
      for (const opts of allOptions(options)) {
        expect(opts.region).toBe(expectedRegion);
      }
    }
  );

  test("regional DATABASE_REGION passes through to every function", async () => {
    const options = await loadExportedOptions("europe-west1");
    for (const opts of allOptions(options)) {
      expect(opts.region).toBe("europe-west1");
    }
  });

  test("unset DATABASE_REGION leaves every function without a region", async () => {
    const options = await loadExportedOptions();
    for (const opts of allOptions(options)) {
      expect(opts).not.toHaveProperty("region");
    }
  });

  test("empty DATABASE_REGION leaves every function without a region", async () => {
    const options = await loadExportedOptions("");
    for (const opts of allOptions(options)) {
      expect(opts).not.toHaveProperty("region");
    }
  });

  test("the trigger binds to the configured database instance", async () => {
    const { trigger } = await loadExportedOptions();
    expect(String(trigger.database)).toBe("params.DATABASE");
  });

  test("the trigger watches the configured collection path", async () => {
    const { trigger } = await loadExportedOptions();
    const document = trigger.document as { toCEL(): string };
    expect(document.toCEL()).toContain("params.COLLECTION_PATH");
  });

  test("the trigger declares no retry policy, matching the extension", async () => {
    const { trigger } = await loadExportedOptions();
    expect(trigger.retry).toBeUndefined();
  });

  test("syncBigQuery pins the extension's queue shape", async () => {
    const { tasks } = await loadExportedOptions();
    const [syncTask] = tasks;

    expect(syncTask.retryConfig).toEqual({
      maxAttempts: 5,
      minBackoffSeconds: 60,
    });

    const rateLimits = syncTask.rateLimits as Record<string, unknown>;
    expect(rateLimits.maxConcurrentDispatches).toBe(500);
    expect(syncTask.maxInstances).toBe(500);
    // A blank .env value is 0 at deploy; the ternary restores the default.
    expect(String(rateLimits.maxDispatchesPerSecond)).toBe(
      "params.MAX_DISPATCHES_PER_SECOND < 1 ? 100 : params.MAX_DISPATCHES_PER_SECOND"
    );
  });

  test("the lifecycle tasks keep their own retry config", async () => {
    const { tasks } = await loadExportedOptions();
    for (const opts of tasks.slice(1)) {
      expect(opts.retryConfig).toEqual({
        maxAttempts: 15,
        minBackoffSeconds: 60,
      });
      expect(opts).not.toHaveProperty("rateLimits");
    }
  });

  test.each(INGRESS_BY_FUNCTION)(
    "%s handles one request per instance with ingress %s",
    async (name, ingress) => {
      const deployed = await loadDeployedOptions();
      const opts = deployed[name];
      expect(opts.concurrency).toBe(1);
      if (ingress === undefined) {
        expect(opts).not.toHaveProperty("ingressSettings");
      } else {
        expect(opts.ingressSettings).toBe(ingress);
      }
    }
  );

  test("the ingress table names every exported function", async () => {
    const deployed = await loadDeployedOptions();
    expect(Object.keys(deployed).sort()).toEqual(
      INGRESS_BY_FUNCTION.map(([name]) => name).sort()
    );
  });
});
