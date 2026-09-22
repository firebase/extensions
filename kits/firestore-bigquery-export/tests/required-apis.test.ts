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

const { requiresAPI, requiresRole } = vi.hoisted(() => ({
  requiresAPI: vi.fn(),
  requiresRole: vi.fn(),
}));

vi.mock("firebase-functions/firestore", () => ({
  onDocumentWritten: vi.fn(() => ({})),
}));
vi.mock("firebase-functions/tasks", () => ({
  onTaskDispatched: vi.fn(() => ({})),
}));
vi.mock("firebase-functions/v2", () => ({
  requiresAPI,
  requiresRole,
}));
vi.mock("firebase-functions/v2/lifecycle", () => ({
  afterFirstDeploy: vi.fn(),
  afterRedeploy: vi.fn(),
}));

const EVENTARC_API = "eventarcpublishing.googleapis.com";
const EVENTARC_PUBLISHER = "roles/eventarc.publisher";

const UNCONDITIONAL_APIS: ReadonlyArray<[api: string, reason: string]> = [
  [
    "firestore.googleapis.com",
    "Receives document change events from Cloud Firestore.",
  ],
  [
    "bigquery.googleapis.com",
    "Mirrors data from your Cloud Firestore collection in BigQuery.",
  ],
];

const UNCONDITIONAL_ROLES = [
  "roles/bigquery.dataEditor",
  "roles/datastore.user",
  "roles/bigquery.user",
  "roles/eventarc.eventReceiver",
  "roles/run.invoker",
  "roles/cloudtasks.enqueuer",
];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

/** Loads the entry afresh with `EVENTARC_CHANNEL` set to `channel`, or unset when omitted. */
async function loadWithChannel(channel?: string): Promise<void> {
  vi.resetModules();
  if (channel === undefined) {
    vi.stubEnv("EVENTARC_CHANNEL", undefined);
  } else {
    vi.stubEnv("EVENTARC_CHANNEL", channel);
  }
  await import("../src/index");
}

function declaredApis(): string[] {
  return requiresAPI.mock.calls.map(([api]) => api);
}

function declaredRoles(): string[] {
  return requiresRole.mock.calls.map(([role]) => role);
}

describe("without an Eventarc channel", () => {
  test.each(UNCONDITIONAL_APIS)("declares %s", async (api, reason) => {
    await loadWithChannel();
    expect(requiresAPI).toHaveBeenCalledWith(api, reason);
  });

  test("declares exactly the 2 APIs the export path needs", async () => {
    await loadWithChannel();
    expect(declaredApis()).toEqual(UNCONDITIONAL_APIS.map(([api]) => api));
  });

  test("declares the roles the export path needs and no publisher role", async () => {
    await loadWithChannel();
    expect(declaredRoles()).toEqual(UNCONDITIONAL_ROLES);
  });

  // The extension declared one API and gained Eventarc publishing only when the
  // user opted into events, so a default install must not gate the deploy on it.
  test.each([
    ["unset", undefined],
    ["empty", ""],
    ["whitespace-only", "   "],
  ])(
    "leaves the Eventarc publishing API and role undeclared when EVENTARC_CHANNEL is %s",
    async (_label, channel) => {
      await loadWithChannel(channel);
      expect(declaredApis()).not.toContain(EVENTARC_API);
      expect(declaredRoles()).not.toContain(EVENTARC_PUBLISHER);
    }
  );
});

describe("with an Eventarc channel", () => {
  const CHANNEL = "projects/p/locations/l/channels/firebase";

  test("declares the Eventarc publishing API", async () => {
    await loadWithChannel(CHANNEL);
    expect(requiresAPI).toHaveBeenCalledWith(
      EVENTARC_API,
      "Publishes the extension's custom events to its Eventarc channel."
    );
    expect(declaredApis()).toEqual([
      ...UNCONDITIONAL_APIS.map(([api]) => api),
      EVENTARC_API,
    ]);
  });

  test("declares the publisher role alongside the unconditional roles", async () => {
    await loadWithChannel(CHANNEL);
    expect(declaredRoles()).toEqual([
      ...UNCONDITIONAL_ROLES,
      EVENTARC_PUBLISHER,
    ]);
  });

  test("a padded channel name still counts as configured", async () => {
    await loadWithChannel(`  ${CHANNEL}  `);
    expect(declaredApis()).toContain(EVENTARC_API);
    expect(declaredRoles()).toContain(EVENTARC_PUBLISHER);
  });
});
