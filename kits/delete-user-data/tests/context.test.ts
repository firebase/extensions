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

import { describe, expect, test, vi } from "vitest";

// Stands in for a project with no Realtime Database URL available, which is what
// an empty SELECTED_DATABASE_INSTANCE leaves behind.
const NO_DATABASE_URL = "Can't determine Firebase Database URL.";

vi.mock("../src/logs");
vi.mock("../src/handlers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/handlers")>()),
  handleClear: vi.fn(),
}));
vi.mock("@google-cloud/pubsub", () => ({ PubSub: vi.fn() }));
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
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

describe("handler context", () => {
  test("builds without resolving the RTDB client", () => {
    expect(() => clearData(deletionEvent("uid-1"))).not.toThrow();

    expect(handleClear).toHaveBeenCalledOnce();
    expect(admin.database).not.toHaveBeenCalled();
  });

  test("resolves the RTDB client when the deletion path reads it", () => {
    const [, ctx] = vi.mocked(handleClear).mock.calls[0] as [
      string,
      HandlerContext
    ];

    expect(() => ctx.database).toThrow(NO_DATABASE_URL);
    expect(admin.database).toHaveBeenCalled();
  });
});
