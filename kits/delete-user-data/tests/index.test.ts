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

import { setGlobalOptions } from "firebase-functions/v2";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../src/logs");
vi.mock("../src/handlers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/handlers")>()),
  handleClear: vi.fn(),
}));

import { handleClear } from "../src/handlers";
import { clearData, handleDeletion, handleSearch } from "../src/index";
import * as logs from "../src/logs";

function deletionEvent(data: unknown) {
  return {
    specversion: "1.0",
    id: "event-id",
    type: "google.firebase.auth.user.v2.deleted",
    source: "//identitytoolkit.googleapis.com/projects/test-project",
    time: "2026-01-01T00:00:00.000Z",
    data,
  } as any;
}

describe("clearData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Kits reject gen1 endpoints, so the deploy fails if this regresses.
  test("registers a gen2 Firebase Auth deletion trigger", () => {
    const endpoint = (clearData as any).__endpoint;

    expect(endpoint.platform).toBe("gcfv2");
    expect(endpoint.eventTrigger.eventType).toBe(
      "google.firebase.auth.user.v2.deleted"
    );
  });

  test("logs and skips deletion when the event carries no user record", () => {
    expect(() => clearData(deletionEvent(undefined))).not.toThrow();

    expect(handleClear).not.toHaveBeenCalled();
    expect(logs.deletionEventMissingUid).toHaveBeenCalledWith("event-id");
  });

  test("logs and skips deletion when the user record has no uid", () => {
    expect(() =>
      clearData(deletionEvent({ email: "user@example.com" }))
    ).not.toThrow();

    expect(handleClear).not.toHaveBeenCalled();
    expect(logs.deletionEventMissingUid).toHaveBeenCalledWith("event-id");
  });
});

describe("module load", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Deploy-time discovery imports the kit, so this is what fails the deploy.
  test("throws when a param value is invalid", async () => {
    vi.resetModules();
    vi.stubEnv("FIRESTORE_DELETE_MODE", "RECURSIVE");

    await expect(import("../src/index")).rejects.toThrow(
      'FIRESTORE_DELETE_MODE="RECURSIVE"'
    );
  });

  test("reports blank required and invalid params in one error", async () => {
    vi.resetModules();
    vi.stubEnv("CLOUD_STORAGE_BUCKET", "");
    vi.stubEnv("FIRESTORE_DELETE_MODE", "RECURSIVE");

    const load = import("../src/index");

    await expect(load).rejects.toThrow("CLOUD_STORAGE_BUCKET");
    await expect(load).rejects.toThrow('FIRESTORE_DELETE_MODE="RECURSIVE"');
  });
});

describe("runtime options", () => {
  // Concurrency 80 let auto-discovery fan many searches onto one 256MiB
  // instance, which ran out of memory and dropped them.
  test.each([
    ["clearData", clearData],
    ["handleSearch", handleSearch],
    ["handleDeletion", handleDeletion],
  ])(
    "%s runs one event per gen1 CPU instance with internal-only ingress",
    (_name, fn) => {
      const endpoint = (fn as any).__endpoint;

      expect(endpoint.concurrency).toBe(1);
      expect(endpoint.cpu).toBe("gcf_gen1");
      expect(endpoint.ingressSettings).toBe("ALLOW_INTERNAL_ONLY");
    }
  );

  describe("with global options set", () => {
    afterEach(() => {
      delete (globalThis as any)[
        Symbol.for("firebase-functions:v2:globalOptions")
      ].value;
    });

    // The README tells users to raise maxInstances and set the region with
    // setGlobalOptions, so the kit's function-level options must not override
    // them. Ingress stays internal-only, like the extension's.
    test("keeps the global options and the extension's runtime", async () => {
      setGlobalOptions({
        ingressSettings: "ALLOW_ALL",
        maxInstances: 3000,
        region: "europe-west1",
      });
      vi.resetModules();
      const kit = await import("../src/index");

      for (const fn of [kit.clearData, kit.handleSearch, kit.handleDeletion]) {
        const endpoint = (fn as any).__endpoint;

        expect(endpoint.ingressSettings).toBe("ALLOW_INTERNAL_ONLY");
        expect(endpoint.maxInstances).toBe(3000);
        expect(endpoint.region).toEqual(["europe-west1"]);
        expect(endpoint.concurrency).toBe(1);
        expect(endpoint.cpu).toBe("gcf_gen1");
      }
    });
  });
});
