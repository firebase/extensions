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

const { onDocumentWritten, onSchedule } = vi.hoisted(() => ({
  onDocumentWritten: vi.fn((options: unknown) => options),
  onSchedule: vi.fn((options: unknown) => options),
}));

vi.mock("firebase-functions/firestore", () => ({ onDocumentWritten }));
vi.mock("firebase-functions/scheduler", () => ({ onSchedule }));
vi.mock("firebase-functions/v2", () => ({
  requiresAPI: vi.fn(),
  requiresRole: vi.fn(),
}));
vi.mock("firebase-admin/app", () => ({
  getApp: vi.fn(() => ({ name: "[DEFAULT]" })),
  initializeApp: vi.fn(),
}));
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
}));

const original = process.env.DATABASE_REGION;

function setDatabaseRegion(value?: string): void {
  if (value === undefined) {
    delete process.env.DATABASE_REGION;
  } else {
    process.env.DATABASE_REGION = value;
  }
}

async function importIndex() {
  vi.resetModules();
  onDocumentWritten.mockClear();
  onSchedule.mockClear();
  await import("../src/index");

  return [
    ...onSchedule.mock.calls.map(([options]) => options),
    ...onDocumentWritten.mock.calls.map(([options]) => options),
  ] as Array<Record<string, unknown>>;
}

describe("function region", () => {
  beforeEach(() => {
    setDatabaseRegion(undefined);
  });

  afterEach(() => {
    setDatabaseRegion(original);
  });

  test("every function in the instance is pinned to the same region", async () => {
    setDatabaseRegion("europe-west2");
    const options = await importIndex();

    // The task-queue-free kit still has three functions; all must agree, or the
    // scheduler and the trigger land in different regions.
    expect(options).toHaveLength(3);
    for (const option of options) {
      expect(option.region).toBe("europe-west2");
    }
  });

  test("a multi-region location maps every function to a Cloud Run region", async () => {
    setDatabaseRegion("nam5");
    const options = await importIndex();

    expect(options).toHaveLength(3);
    for (const option of options) {
      expect(option.region).toBe("us-central1");
    }
  });

  test("no function declares a region when the location is unset", async () => {
    const options = await importIndex();

    expect(options).toHaveLength(3);
    for (const option of options) {
      expect(option).not.toHaveProperty("region");
    }
  });
});
