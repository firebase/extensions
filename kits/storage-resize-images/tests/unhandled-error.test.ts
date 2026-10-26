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

import { logger } from "firebase-functions";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.mock("firebase-admin", async () => {
  const actual = await vi.importActual<typeof import("firebase-admin")>(
    "firebase-admin"
  );
  return {
    ...actual,
    apps: [],
    initializeApp: vi.fn(),
    storage: vi.fn(() => ({ bucket: vi.fn(() => ({})) })),
  };
});

const cloudEvent = {
  specversion: "1.0",
  id: "event-1",
  source: "//storage.googleapis.com/projects/_/buckets/demo-bucket",
  type: "google.cloud.storage.object.v1.finalized",
  time: "2026-01-01T00:00:00.000Z",
  subject: "objects/notes.txt",
  data: { bucket: "demo-bucket", name: "notes.txt", contentType: "text/plain" },
};

async function invoke(): Promise<void> {
  vi.resetModules();
  const { generateResizedImage } = await import("../src/index");
  await (generateResizedImage as unknown as (e: unknown) => Promise<void>)(
    cloudEvent
  );
}

beforeEach(() => {
  vi.stubEnv("IMG_BUCKET", "demo-bucket");
  vi.stubEnv("IMG_SIZES", "200x200");
  vi.spyOn(logger, "error").mockImplementation(() => {});
  vi.spyOn(logger, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test("an error thrown outside the resize is logged at ERROR and rethrown", async () => {
  vi.stubEnv("SHARP_OPTIONS", "{bad}");

  await expect(invoke()).rejects.toThrow(SyntaxError);

  expect(logger.error).toHaveBeenCalledWith(
    "Unhandled error in generateResizedImage",
    expect.any(SyntaxError)
  );
});

test("an event that completes logs no error", async () => {
  vi.stubEnv("SHARP_OPTIONS", "{}");

  await expect(invoke()).resolves.toBeUndefined();

  expect(logger.error).not.toHaveBeenCalled();
});
