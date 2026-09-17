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

/**
 * The handler is driven with a real `../src/events` against an Eventarc
 * channel that rejects every publish, as a deleted channel does with
 * PERMISSION_DENIED. The resize must still run.
 */

import { logger } from "firebase-functions";
import type { StorageEvent } from "firebase-functions/v2/storage";
import { beforeEach, expect, test, vi } from "vitest";

const publish = vi
  .fn()
  .mockRejectedValue(
    Object.assign(new Error("Permission denied"), { code: 403 })
  );

vi.mock("firebase-admin/eventarc", () => ({
  getEventarc: () => ({ channel: () => ({ publish }) }),
}));
vi.mock("../src/logs");
vi.mock("../src/filters", () => ({ shouldResize: vi.fn(() => false) }));

import * as events from "../src/events";
import { resolveResizeImagesConfig } from "../src/export-config";
import { shouldResize } from "../src/filters";
import { type HandlerContext, handleObjectFinalized } from "../src/handlers";

function makeCtx(): HandlerContext {
  return {
    config: resolveResizeImagesConfig({
      bucket: "demo-bucket",
      sizes: "200x200",
      region: "us-central1",
      deleteOriginal: "false",
    }),
    storage: { bucket: vi.fn(() => ({})) },
  } as unknown as HandlerContext;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(logger, "warn").mockImplementation(() => {});
  process.env.EVENTARC_CHANNEL = "projects/p/locations/l/channels/firebase";
  events.setupEventChannel();
});

test("an upload still reaches the resize path when every Eventarc publish is denied", async () => {
  const event = {
    id: "evt-1",
    type: "google.cloud.storage.object.v1.finalized",
    source: "//storage.googleapis.com/projects/_/buckets/demo-bucket",
    time: "2026-01-01T00:00:00Z",
    data: { name: "img.png", bucket: "demo-bucket", contentType: "image/png" },
  } as unknown as StorageEvent;

  await expect(
    handleObjectFinalized(event, makeCtx())
  ).resolves.toBeUndefined();

  expect(publish).toHaveBeenCalled();
  expect(logger.warn).toHaveBeenCalled();
  expect(shouldResize).toHaveBeenCalled();
});
