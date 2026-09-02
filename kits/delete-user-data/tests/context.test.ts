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

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Stands in for a project with no Realtime Database URL available, which is what
// an empty SELECTED_DATABASE_INSTANCE leaves behind.
const NO_DATABASE_URL = "Can't determine Firebase Database URL.";

const FIRESTORE_DATABASE_ID = "user-data";
const PROJECT_ID = "test-project";

vi.mock("../src/logs");
vi.mock("../src/handlers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/handlers")>()),
  handleClear: vi.fn(),
}));
// The clients carry their construction arguments, which survive the beforeEach
// that clears the call history recorded when the context was memoized.
vi.mock("@google-cloud/pubsub", () => ({
  PubSub: class {
    constructor(public readonly options?: { projectId?: string }) {}
  },
}));
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn((databaseId?: string) => ({ databaseId })),
}));
vi.mock("firebase-admin", () => ({
  apps: [],
  credential: { applicationDefault: vi.fn() },
  initializeApp: vi.fn(),
  storage: vi.fn(() => ({})),
  database: vi.fn(() => {
    throw new Error(NO_DATABASE_URL);
  }),
}));

import * as admin from "firebase-admin";
import type { HandlerContext } from "../src/handlers";
import { handleClear } from "../src/handlers";
import { clearData } from "../src/index";

function deletionEvent(uid: string) {
  return {
    specversion: "1.0",
    id: "event-id",
    type: "google.firebase.auth.user.v2.deleted",
    source: "//identitytoolkit.googleapis.com/projects/test-project",
    time: "2026-01-01T00:00:00.000Z",
    data: { uid },
  } as any;
}

function contextFrom(uid: string): HandlerContext {
  clearData(deletionEvent(uid));

  const [, ctx] = vi.mocked(handleClear).mock.lastCall as [
    string,
    HandlerContext
  ];
  return ctx;
}

describe("handler context", () => {
  // Stubbed per test: the afterEach unstubAllEnvs would wipe beforeAll stubs
  // after the first test.
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("FIREBASE_KIT_INSTANCE_ID", "test-instance");
    vi.stubEnv("FIRESTORE_DATABASE_ID", FIRESTORE_DATABASE_ID);
    // The projectID param reads the project from FIREBASE_CONFIG.
    vi.stubEnv("FIREBASE_CONFIG", JSON.stringify({ projectId: PROJECT_ID }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("builds without resolving the RTDB client", () => {
    expect(() => clearData(deletionEvent("uid-1"))).not.toThrow();

    expect(handleClear).toHaveBeenCalledOnce();
    expect(admin.database).not.toHaveBeenCalled();
  });

  test("resolves the RTDB client when the deletion path reads it", () => {
    const ctx = contextFrom("uid-2");

    expect(() => ctx.database).toThrow(NO_DATABASE_URL);
    expect(admin.database).toHaveBeenCalled();
  });

  test("reuses one context across invocations", () => {
    expect(contextFrom("uid-3")).toBe(contextFrom("uid-4"));
  });

  test("builds the Firestore client for the configured database", () => {
    expect(contextFrom("uid-5").firestore).toEqual({
      databaseId: FIRESTORE_DATABASE_ID,
    });
  });

  test("builds the Pub/Sub client for the configured project", () => {
    expect(contextFrom("uid-6").pubsub).toEqual({
      options: { projectId: PROJECT_ID },
    });
  });
});
