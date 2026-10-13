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

import { FirestoreBigQueryEventHistoryTracker } from "../../bigquery";
import { resolveProjectId } from "../../bigquery/projectId";
import { ChangeTrackerConfig } from "../../bigquery/types";

const ENV_VARS = ["PROJECT_ID", "GCLOUD_PROJECT", "GOOGLE_CLOUD_PROJECT"];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const name of ENV_VARS) {
    saved[name] = process.env[name];
    delete process.env[name];
  }
});

afterEach(() => {
  for (const name of ENV_VARS) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
});

describe("resolveProjectId", () => {
  test("uses the explicit project over any environment variable", () => {
    process.env.PROJECT_ID = "env-project";
    expect(resolveProjectId("explicit-project")).toBe("explicit-project");
  });

  test("uses PROJECT_ID before the other environment variables", () => {
    process.env.PROJECT_ID = "project-id";
    process.env.GCLOUD_PROJECT = "gcloud-project";
    process.env.GOOGLE_CLOUD_PROJECT = "google-cloud-project";
    expect(resolveProjectId(undefined)).toBe("project-id");
  });

  test("falls back to GCLOUD_PROJECT when PROJECT_ID is not set", () => {
    process.env.GCLOUD_PROJECT = "gcloud-project";
    process.env.GOOGLE_CLOUD_PROJECT = "google-cloud-project";
    expect(resolveProjectId(null)).toBe("gcloud-project");
  });

  test("falls back to GOOGLE_CLOUD_PROJECT when nothing else is set", () => {
    process.env.GOOGLE_CLOUD_PROJECT = "google-cloud-project";
    expect(resolveProjectId("")).toBe("google-cloud-project");
  });

  test("returns undefined when no project is available", () => {
    expect(resolveProjectId(undefined)).toBeUndefined();
  });
});

const trackerConfig = (
  overrides: Partial<ChangeTrackerConfig> = {}
): ChangeTrackerConfig =>
  ({
    datasetId: "dataset",
    tableId: "table",
    ...overrides,
  } as ChangeTrackerConfig);

describe("FirestoreBigQueryEventHistoryTracker project ID", () => {
  test("uses bqProjectId for the BigQuery client", () => {
    process.env.PROJECT_ID = "env-project";
    const tracker = new FirestoreBigQueryEventHistoryTracker(
      trackerConfig({ bqProjectId: "explicit-project" })
    );
    expect(tracker.bq.projectId).toBe("explicit-project");
  });

  test("uses GCLOUD_PROJECT for the BigQuery client when nothing else is set", () => {
    process.env.GCLOUD_PROJECT = "gcloud-project";
    const tracker = new FirestoreBigQueryEventHistoryTracker(trackerConfig());
    expect(tracker.bq.projectId).toBe("gcloud-project");
  });

  test("leaves the client's project for auto-detection when no project is available", () => {
    const tracker = new FirestoreBigQueryEventHistoryTracker(trackerConfig());
    expect(tracker.bq.projectId).toBe("{{projectId}}");
  });

  test("detects the project before building BigQuery resources", async () => {
    const tracker = new FirestoreBigQueryEventHistoryTracker(trackerConfig());
    const projectIdAtStep: Record<string, string> = {};
    const record = (step: string) => async () => {
      projectIdAtStep[step] = tracker.bq.projectId;
    };

    jest.spyOn(tracker.bq, "getProjectId").mockImplementation(async () => {
      tracker.bq.projectId = "detected-project";
      return "detected-project";
    });
    const t = tracker as any;
    jest.spyOn(t, "initializeDataset").mockImplementation(record("dataset"));
    jest
      .spyOn(t, "initializeRawChangeLogTable")
      .mockImplementation(record("table"));
    jest.spyOn(t, "_initializeLatestView").mockImplementation(record("view"));
    jest.spyOn(t, "_waitForInitialization").mockResolvedValue(undefined);

    await tracker.initialize();

    expect(projectIdAtStep).toEqual({
      dataset: "detected-project",
      table: "detected-project",
      view: "detected-project",
    });
  });
});
