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

import { resolveProjectId } from "../../bigquery/projectId";

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
