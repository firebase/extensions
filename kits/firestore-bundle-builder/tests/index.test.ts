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

import { beforeEach, describe, expect, test, vi } from "vitest";
import type { BundleBuilderConfig } from "../src/export-config";

// `firebase-functions` and `firebase-functions/v2` resolve to the same module,
// so the logger and the deploy-time declarations share one mock. The spies are
// hoisted because this suite calls `vi.resetModules()` between imports of
// `../src/index`.
const { logger, requiresAPI, requiresRole } = vi.hoisted(() => ({
  logger: { debug: vi.fn(), error: vi.fn() },
  requiresAPI: vi.fn(),
  requiresRole: vi.fn(),
}));

vi.mock("firebase-functions", () => ({ logger, requiresAPI, requiresRole }));

const onRequest = vi.fn((options: unknown, handler: unknown) => ({
  options,
  handler,
}));

vi.mock("firebase-functions/https", () => ({ onRequest }));

const initializeApp = vi.fn();

vi.mock("firebase-admin", () => ({
  apps: [],
  initializeApp,
  firestore: vi.fn(() => ({ collection: vi.fn() })),
}));

vi.mock("@google-cloud/storage", () => ({
  Storage: vi.fn(() => ({ bucket: vi.fn() })),
}));

const configFromEnv = vi.fn<() => BundleBuilderConfig>(() => ({
  bundleSpecCollection: "bundles",
  bundleStorageBucket: "",
  storagePrefix: "bundles",
}));

vi.mock("../src/config", () => ({ configFromEnv }));

async function importIndex() {
  vi.resetModules();
  return import("../src/index");
}

describe("index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // The kit reaches Firestore from an HTTPS function with no Firestore trigger,
  // so nothing at deploy time infers the dependency: without this declaration
  // `serve` fails at runtime on a project where the API is disabled.
  test("declares the Cloud Firestore API requirement", async () => {
    await importIndex();

    expect(requiresAPI).toHaveBeenCalledWith(
      "firestore.googleapis.com",
      "Reads bundle specifications and document data from Cloud Firestore."
    );
  });

  test("registers the HTTPS serve function", async () => {
    const { serve } = await importIndex();

    expect(onRequest).toHaveBeenCalledWith(
      { region: "us-central1" },
      expect.any(Function)
    );
    expect(serve).toBeDefined();
  });
});
