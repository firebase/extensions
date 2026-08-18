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

import { describe, expect, test } from "vitest";

import {
  getDatabaseUrl,
  resolveDeleteUserDataConfig,
} from "../src/export-config";

describe("getDatabaseUrl", () => {
  test("returns the legacy domain for us-central1", () => {
    expect(getDatabaseUrl("server-name", "us-central1")).toBe(
      "https://server-name.firebaseio.com"
    );
  });

  test("returns the regional domain for europe-west1", () => {
    expect(getDatabaseUrl("server-name", "europe-west1")).toBe(
      "https://server-name.europe-west1.firebasedatabase.app"
    );
  });

  test("returns the regional domain for asia-southeast1", () => {
    expect(getDatabaseUrl("server-name", "asia-southeast1")).toBe(
      "https://server-name.asia-southeast1.firebasedatabase.app"
    );
  });

  test("returns null if the instance is undefined", () => {
    expect(getDatabaseUrl(undefined, "asia-southeast1")).toBeNull();
  });

  test("returns null if the location is undefined", () => {
    expect(getDatabaseUrl("server-name", undefined)).toBeNull();
  });
});

describe("resolveDeleteUserDataConfig", () => {
  test("applies the documented defaults", () => {
    const resolved = resolveDeleteUserDataConfig({ instanceId: "inst" });

    expect(resolved.firestoreDatabaseId).toBe("(default)");
    expect(resolved.firestoreDeleteMode).toBe("shallow");
    expect(resolved.enableAutoDiscovery).toBe(false);
    expect(resolved.searchDepth).toBe(3);
    expect(resolved.searchFields).toBe("id,uid,userId");
  });

  test("derives topic names from the instance id", () => {
    const resolved = resolveDeleteUserDataConfig({ instanceId: "inst" });

    expect(resolved.discoveryTopicName).toBe("kit-inst-discovery");
    expect(resolved.deletionTopicName).toBe("kit-inst-deletion");
  });

  test("keeps explicitly configured topic names", () => {
    const resolved = resolveDeleteUserDataConfig({
      instanceId: "inst",
      discoveryTopicName: "my-discovery",
      deletionTopicName: "my-deletion",
    });

    expect(resolved.discoveryTopicName).toBe("my-discovery");
    expect(resolved.deletionTopicName).toBe("my-deletion");
  });

  test("passes through the caller's search settings", () => {
    const resolved = resolveDeleteUserDataConfig({
      instanceId: "inst",
      enableAutoDiscovery: true,
      searchDepth: 5,
      searchFields: "owner",
      firestoreDeleteMode: "recursive",
    });

    expect(resolved.enableAutoDiscovery).toBe(true);
    expect(resolved.searchDepth).toBe(5);
    expect(resolved.searchFields).toBe("owner");
    expect(resolved.firestoreDeleteMode).toBe("recursive");
  });
});
