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

// Parity: delete-user-data/functions/__tests__/helpers.test.ts
// ("Test Realtime Database URL helper function"). The helper moved from
// `helpers.ts` to `export-config.ts` in the kit; the cases are unchanged.
describe("getDatabaseUrl", () => {
  test("returns the correct url for us-central1", () => {
    expect(getDatabaseUrl("server-name", "us-central1")).toBe(
      "https://server-name.firebaseio.com"
    );
  });

  test("returns the correct url for europe-west1", () => {
    expect(getDatabaseUrl("server-name", "europe-west1")).toBe(
      "https://server-name.europe-west1.firebasedatabase.app"
    );
  });

  test("returns the correct url for asia-southeast1", () => {
    expect(getDatabaseUrl("server-name", "asia-southeast1")).toBe(
      "https://server-name.asia-southeast1.firebasedatabase.app"
    );
  });

  test("returns null if the instance is undefined", () => {
    expect(getDatabaseUrl(undefined, "asia-southeast1")).toBe(null);
  });

  test("returns null if the location is undefined", () => {
    expect(getDatabaseUrl("server-name", undefined)).toBe(null);
  });
});

describe("resolveDeleteUserDataConfig", () => {
  test("applies the extension.yaml defaults", () => {
    const config = resolveDeleteUserDataConfig({ instanceId: "my-instance" });

    expect(config.firestoreDatabaseId).toBe("(default)");
    expect(config.firestoreDeleteMode).toBe("shallow");
    expect(config.enableAutoDiscovery).toBe(false);
    expect(config.searchDepth).toBe(3);
    expect(config.searchFields).toBe("id,uid,userId");
  });

  test("derives topic names from the instance id", () => {
    const config = resolveDeleteUserDataConfig({ instanceId: "my-instance" });

    expect(config.discoveryTopicName).toBe("kit-my-instance-discovery");
    expect(config.deletionTopicName).toBe("kit-my-instance-deletion");
  });

  test("honours explicit topic names", () => {
    const config = resolveDeleteUserDataConfig({
      instanceId: "my-instance",
      discoveryTopicName: "custom-discovery",
      deletionTopicName: "custom-deletion",
    });

    expect(config.discoveryTopicName).toBe("custom-discovery");
    expect(config.deletionTopicName).toBe("custom-deletion");
  });

  test("passes through the supplied values", () => {
    const config = resolveDeleteUserDataConfig({
      instanceId: "my-instance",
      firestorePaths: "users/{UID}",
      firestoreDatabaseId: "secondary",
      firestoreDeleteMode: "recursive",
      rtdbInstance: "server-name",
      rtdbLocation: "europe-west1",
      rtdbPaths: "users/{UID}",
      storageBucket: "my-bucket",
      storagePaths: "{DEFAULT}/{UID}",
      enableAutoDiscovery: true,
      searchDepth: 5,
      searchFields: "uid",
      searchFunction: "https://example.com/search",
      projectId: "demo-test",
    });

    expect(config).toMatchObject({
      firestorePaths: "users/{UID}",
      firestoreDatabaseId: "secondary",
      firestoreDeleteMode: "recursive",
      rtdbInstance: "server-name",
      rtdbLocation: "europe-west1",
      rtdbPaths: "users/{UID}",
      storageBucket: "my-bucket",
      storagePaths: "{DEFAULT}/{UID}",
      enableAutoDiscovery: true,
      searchDepth: 5,
      searchFields: "uid",
      searchFunction: "https://example.com/search",
      projectId: "demo-test",
    });
  });
});
