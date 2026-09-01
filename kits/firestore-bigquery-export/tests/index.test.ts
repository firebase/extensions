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

vi.mock("firebase-functions/firestore", () => ({
  onDocumentWritten: vi.fn(() => ({})),
}));
vi.mock("firebase-functions/tasks", () => ({
  onTaskDispatched: vi.fn(() => ({})),
}));
vi.mock("firebase-functions/v2", () => ({
  requiresAPI: vi.fn(),
  requiresRole: vi.fn(),
}));
vi.mock("firebase-functions/v2/lifecycle", () => ({
  afterFirstDeploy: vi.fn(),
  afterRedeploy: vi.fn(),
}));

import { onDocumentWritten } from "firebase-functions/firestore";
import { onTaskDispatched } from "firebase-functions/tasks";
import "../src/index";

function triggerOptions(): Record<string, unknown> {
  const call = vi.mocked(onDocumentWritten).mock.calls[0];
  return call[0] as unknown as Record<string, unknown>;
}

function taskOptions(): Array<Record<string, unknown>> {
  return vi
    .mocked(onTaskDispatched)
    .mock.calls.map((call) => call[0] as unknown as Record<string, unknown>);
}

describe("exported function options", () => {
  test("no function sets a region (DATABASE_REGION values like nam5 are Firestore locations, not Cloud Run regions)", () => {
    expect(triggerOptions()).not.toHaveProperty("region");

    const tasks = taskOptions();
    expect(tasks).toHaveLength(2);
    for (const opts of tasks) {
      expect(opts).not.toHaveProperty("region");
    }
  });

  test("the trigger binds to the configured database instance", () => {
    expect(String(triggerOptions().database)).toBe("params.DATABASE");
  });

  test("the trigger watches the configured collection path", () => {
    const document = triggerOptions().document as { toCEL(): string };
    expect(document.toCEL()).toContain("params.COLLECTION_PATH");
  });
});
