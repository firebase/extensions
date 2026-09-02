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
vi.mock("firebase-functions/tasks", () => ({
  onTaskDispatched: vi.fn(() => ({})),
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
  tasks: FunctionOptions[];
}

const originalDatabaseRegion = process.env.DATABASE_REGION;

afterEach(() => {
  if (originalDatabaseRegion === undefined) {
    delete process.env.DATABASE_REGION;
  } else {
    process.env.DATABASE_REGION = originalDatabaseRegion;
  }
});

async function loadExportedOptions(
  databaseRegion?: string
): Promise<ExportedOptions> {
  vi.resetModules();
  if (databaseRegion === undefined) {
    delete process.env.DATABASE_REGION;
  } else {
    process.env.DATABASE_REGION = databaseRegion;
  }

  await import("../src/index");
  const { onDocumentWritten } = await import("firebase-functions/firestore");
  const { onTaskDispatched } = await import("firebase-functions/tasks");

  const triggerCalls = vi.mocked(onDocumentWritten).mock.calls;
  const taskCalls = vi.mocked(onTaskDispatched).mock.calls;
  const trigger = triggerCalls[triggerCalls.length - 1][0] as FunctionOptions;
  const tasks = taskCalls
    .slice(-2)
    .map((call) => call[0] as unknown as FunctionOptions);

  expect(tasks).toHaveLength(2);
  return { trigger, tasks };
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
});
