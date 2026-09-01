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

vi.mock("../src/logs");
vi.mock("../src/handlers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/handlers")>()),
  handleClear: vi.fn(),
}));

import { handleClear } from "../src/handlers";
import { clearData } from "../src/index";
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
