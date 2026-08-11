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

import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  type CaptureConfig,
  resolveCaptureConfig,
} from "../src/capture-config";

vi.mock("../src/logs", () => ({
  setLogLevel: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

const set = vi.fn().mockResolvedValue(undefined);
const doc = vi.fn(() => ({ set }));
const collection = vi.fn(() => ({ doc }));
const getFirestore = vi.fn(() => ({ collection }));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: (...args: unknown[]) => getFirestore(...(args as [])),
}));

// Stubbed so constructing the launcher does not load gRPC protos.
vi.mock("@google-cloud/dataflow", () => ({
  FlexTemplatesServiceClient: class {},
}));

const { RestorationLauncher } = await import("../src/dataflow");

function config(overrides: Partial<CaptureConfig> = {}) {
  return resolveCaptureConfig({
    projectId: "test-project",
    syncCollectionPath: "users",
    backupInstanceId: "backup-db",
    datasetId: "ds",
    tableId: "tbl",
    instanceId: "default",
    bucketName: "test-project.firebasestorage.app",
    ...overrides,
  });
}

/**
 * Fake flex templates client capturing the launch request. Pass a response of
 * `{}` to simulate Dataflow not reporting a job name.
 */
function fakeClient(response: object = { job: { name: "job-1" } }) {
  return {
    launchFlexTemplate: vi.fn().mockResolvedValue([response]),
  };
}

describe("RestorationLauncher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("launches from the same template path the setup script stages to", async () => {
    const client = fakeClient();
    const cfg = config();

    await new RestorationLauncher(cfg, client as never).launch({
      timestamp: 1700000000,
    });

    const [request] = client.launchFlexTemplate.mock.calls[0];
    expect(request.launchParameter.containerSpecGcsPath).toBe(
      "gs://test-project.firebasestorage.app/default-dataflow-restore"
    );
    expect(request.launchParameter.containerSpecGcsPath).toBe(
      cfg.flexTemplatePath
    );
  });

  test("passes the five parameters the pipeline declares", async () => {
    const client = fakeClient();

    await new RestorationLauncher(config(), client as never).launch({
      timestamp: 1700000000,
    });

    const [request] = client.launchFlexTemplate.mock.calls[0];
    expect(request.projectId).toBe("test-project");
    expect(request.launchParameter.parameters).toEqual({
      timestamp: "1700000000",
      firestoreCollectionId: "users",
      firestoreDb: "backup-db",
      bigQueryDataset: "ds",
      bigQueryTable: "tbl",
    });
  });

  test("launches in the Dataflow region, not the functions region", async () => {
    const client = fakeClient();

    await new RestorationLauncher(
      config({ location: "us-central1", dataflowRegion: "europe-west1" }),
      client as never
    ).launch({ timestamp: 1700000000 });

    expect(client.launchFlexTemplate.mock.calls[0][0].location).toBe(
      "europe-west1"
    );
  });

  test("maps the capture-everything wildcard for the pipeline", async () => {
    const client = fakeClient();

    await new RestorationLauncher(
      config({ syncCollectionPath: "{document=**}" }),
      client as never
    ).launch({ timestamp: 1700000000 });

    expect(
      client.launchFlexTemplate.mock.calls[0][0].launchParameter.parameters
        .firestoreCollectionId
    ).toBe("*");
  });

  test("derives a run id that is stable across retries of the same request", async () => {
    // Dataflow rejects a duplicate active job name, which is what stops a retry
    // after a partial failure from starting a second concurrent restoration.
    const first = fakeClient();
    const second = fakeClient();

    const a = await new RestorationLauncher(config(), first as never).launch({
      timestamp: 1700000000,
    });
    const b = await new RestorationLauncher(config(), second as never).launch({
      timestamp: 1700000000,
    });

    expect(a.runId).toBe("default-restore-1700000000");
    expect(b.runId).toBe(a.runId);
    expect(
      first.launchFlexTemplate.mock.calls[0][0].launchParameter.jobName
    ).toBe(a.runId);
  });

  test("gives a different run id to a different target timestamp", async () => {
    const client = fakeClient();
    const launcher = new RestorationLauncher(config(), client as never);

    const a = await launcher.launch({ timestamp: 1700000000 });
    const b = await launcher.launch({ timestamp: 1700000001 });

    expect(a.runId).not.toBe(b.runId);
  });

  test("records the run against the captured database", async () => {
    const client = fakeClient();
    const cfg = config();

    await new RestorationLauncher(cfg, client as never).launch({
      timestamp: 1700000000,
    });

    expect(getFirestore).toHaveBeenCalledWith("(default)");
    expect(collection).toHaveBeenCalledWith(cfg.restoreCollection);
    expect(doc).toHaveBeenCalledWith("default-restore-1700000000");
    expect(set).toHaveBeenCalledWith({
      runId: "default-restore-1700000000",
      jobName: "job-1",
      timestamp: 1700000000,
      status: "launched",
    });
  });

  test("fails with an actionable error when no bucket is configured", async () => {
    const client = fakeClient();

    await expect(
      new RestorationLauncher(
        config({ bucketName: "" }),
        client as never
      ).launch({ timestamp: 1700000000 })
    ).rejects.toThrow(/no Cloud Storage bucket is configured/);

    expect(client.launchFlexTemplate).not.toHaveBeenCalled();
  });

  test("records a null job name when Dataflow reports none", async () => {
    const client = fakeClient({});

    const job = await new RestorationLauncher(config(), client as never).launch(
      {
        timestamp: 1700000000,
      }
    );

    expect(job.jobName).toBeUndefined();
    expect(set.mock.calls[0][0].jobName).toBeNull();
  });
});
