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

import { describe, expect, test } from "vitest";
import { parseTransferConfigName, parseTransferRunName } from "../src/dts";

describe("parseTransferRunName", () => {
  test("parses a valid transfer run name", () => {
    expect(
      parseTransferRunName(
        "projects/p1/locations/us/transferConfigs/c1/runs/r1"
      )
    ).toEqual({
      projectId: "p1",
      location: "us",
      transferConfigId: "c1",
      runId: "r1",
    });
  });

  test("parses ids containing dashes and dots", () => {
    const parsed = parseTransferRunName(
      "projects/409146382768/locations/europe-west2/transferConfigs/642f3a36-0000/runs/65a9b1e0-0000"
    );
    expect(parsed.location).toBe("europe-west2");
    expect(parsed.transferConfigId).toBe("642f3a36-0000");
    expect(parsed.runId).toBe("65a9b1e0-0000");
  });

  test("throws for too few segments", () => {
    expect(() =>
      parseTransferRunName("projects/p1/locations/us/transferConfigs/c1")
    ).toThrow("Invalid transfer run name format");
  });

  test("throws for a missing runs segment", () => {
    expect(() =>
      parseTransferRunName(
        "projects/p1/locations/us/transferConfigs/c1/other/r1"
      )
    ).toThrow("Invalid transfer run name format");
  });

  test("throws for empty string", () => {
    expect(() => parseTransferRunName("")).toThrow(
      "Invalid transfer run name format"
    );
  });
});

describe("parseTransferConfigName", () => {
  test("parses a valid transfer config name", () => {
    expect(
      parseTransferConfigName("projects/p1/locations/us/transferConfigs/c1")
    ).toEqual({ projectId: "p1", location: "us", transferConfigId: "c1" });
  });

  test("throws for a run name (too many segments)", () => {
    expect(() =>
      parseTransferConfigName(
        "projects/p1/locations/us/transferConfigs/c1/runs/r1"
      )
    ).toThrow("Invalid transfer config name format");
  });

  test("throws for empty string", () => {
    expect(() => parseTransferConfigName("")).toThrow(
      "Invalid transfer config name format"
    );
  });
});
