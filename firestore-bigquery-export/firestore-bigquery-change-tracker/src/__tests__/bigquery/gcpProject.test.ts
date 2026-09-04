/*
 * Copyright 2019 Google LLC
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

import { resolveGcpProjectIdForBigQuery } from "../../bigquery/gcpProject";

const ENV_VARS = ["PROJECT_ID", "GOOGLE_CLOUD_PROJECT"];

function clearEnv() {
  for (const v of ENV_VARS) delete process.env[v];
}

beforeEach(clearEnv);
afterEach(clearEnv);

describe("resolveGcpProjectIdForBigQuery", () => {
  it("returns the explicit preferred value first", () => {
    process.env.GOOGLE_CLOUD_PROJECT = "env-project";
    expect(resolveGcpProjectIdForBigQuery("explicit-project")).toBe(
      "explicit-project"
    );
  });

  it("prefers GOOGLE_CLOUD_PROJECT over PROJECT_ID (Gen2 / Cloud Run)", () => {
    process.env.GOOGLE_CLOUD_PROJECT = "gen2-project";
    process.env.PROJECT_ID = "gen1-project";
    expect(resolveGcpProjectIdForBigQuery(undefined)).toBe("gen2-project");
  });

  it("falls back to PROJECT_ID when GOOGLE_CLOUD_PROJECT is absent", () => {
    process.env.PROJECT_ID = "gen1-project";
    expect(resolveGcpProjectIdForBigQuery(undefined)).toBe("gen1-project");
  });

  it("returns undefined when no source is available", () => {
    expect(resolveGcpProjectIdForBigQuery(undefined)).toBeUndefined();
  });
});
