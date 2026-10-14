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

const mocks = vi.hoisted(() => {
  const remoteFile = { delete: vi.fn().mockResolvedValue(undefined) };
  return {
    remoteFile,
    checkImageContent: vi.fn().mockResolvedValue(true),
    resizeImages: vi.fn().mockResolvedValue([
      {
        status: "fulfilled",
        value: {
          size: "200x200",
          outputFilePath: "img_200x200.png",
          success: true,
        },
      },
    ]),
    downloadOriginalFile: vi
      .fn()
      .mockResolvedValue(["/tmp/original.png", remoteFile]),
    handleFailedImage: vi.fn().mockResolvedValue(undefined),
    deleteTempFile: vi.fn().mockResolvedValue(undefined),
    deleteRemoteFile: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("firebase-admin/eventarc", () => ({
  getEventarc: () => ({ channel: () => ({ publish }) }),
}));
vi.mock("../src/logs");
vi.mock("../src/filters", () => ({ shouldResize: vi.fn(() => true) }));
vi.mock("../src/content-filter", () => ({
  checkImageContent: mocks.checkImageContent,
}));
vi.mock("../src/resize-image", () => ({ resizeImages: mocks.resizeImages }));
vi.mock("../src/file-operations", () => ({
  downloadOriginalFile: mocks.downloadOriginalFile,
  handleFailedImage: mocks.handleFailedImage,
  deleteTempFile: mocks.deleteTempFile,
  deleteRemoteFile: mocks.deleteRemoteFile,
}));

import * as events from "../src/events";
import { resolveResizeImagesConfig } from "../src/export-config";
import { type HandlerContext, handleObjectFinalized } from "../src/handlers";

const eventType = (name: string) =>
  `firebase.extensions.storage-resize-images.v1.${name}`;

function makeCtx(): HandlerContext {
  return {
    config: resolveResizeImagesConfig({
      bucket: "demo-bucket",
      sizes: "200x200",
      region: "us-central1",
      deleteOriginal: "on_success",
    }),
    storage: { bucket: vi.fn(() => ({})) },
  } as unknown as HandlerContext;
}

function makeEvent(): StorageEvent {
  return {
    id: "evt-1",
    type: "google.cloud.storage.object.v1.finalized",
    source: "//storage.googleapis.com/projects/_/buckets/demo-bucket",
    time: "2026-01-01T00:00:00Z",
    data: { name: "img.png", bucket: "demo-bucket", contentType: "image/png" },
  } as unknown as StorageEvent;
}

const publishedTypes = () =>
  publish.mock.calls.map((call) => (call[0] as { type: string }).type);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkImageContent.mockResolvedValue(true);
  mocks.resizeImages.mockResolvedValue([
    {
      status: "fulfilled",
      value: {
        size: "200x200",
        outputFilePath: "img_200x200.png",
        success: true,
      },
    },
  ]);
  mocks.downloadOriginalFile.mockResolvedValue([
    "/tmp/original.png",
    mocks.remoteFile,
  ]);
  vi.spyOn(logger, "warn").mockImplementation(() => {});
  process.env.EVENTARC_CHANNEL = "projects/p/locations/l/channels/firebase";
  events.setupEventChannel();
});

test("an upload is still resized when every Eventarc publish is denied", async () => {
  await expect(
    handleObjectFinalized(makeEvent(), makeCtx())
  ).resolves.toBeUndefined();

  expect(mocks.resizeImages).toHaveBeenCalled();
  expect(mocks.deleteRemoteFile).toHaveBeenCalledWith(
    mocks.remoteFile,
    "img.png"
  );
  expect(mocks.deleteTempFile).toHaveBeenCalled();
  expect(publishedTypes()).toEqual([
    eventType("onStart"),
    eventType("onStartResize"),
    eventType("onSuccess"),
    eventType("onCompletion"),
  ]);
  expect(logger.warn).toHaveBeenCalledTimes(4);
});

test("a resize that throws still reports through a denied onError publish", async () => {
  mocks.resizeImages.mockRejectedValue(new Error("sharp exploded"));

  await expect(
    handleObjectFinalized(makeEvent(), makeCtx())
  ).resolves.toBeUndefined();

  expect(publishedTypes()).toContain(eventType("onError"));
  expect(mocks.deleteTempFile).toHaveBeenCalled();
});

test("a failed resize still stores the original when every publish is denied", async () => {
  mocks.resizeImages.mockResolvedValue([
    {
      status: "fulfilled",
      value: {
        size: "200x200",
        outputFilePath: "img_200x200.png",
        success: false,
      },
    },
  ]);

  await expect(
    handleObjectFinalized(makeEvent(), makeCtx())
  ).resolves.toBeUndefined();

  expect(mocks.handleFailedImage).toHaveBeenCalled();
  expect(mocks.deleteRemoteFile).not.toHaveBeenCalled();
  expect(publishedTypes()).toContain(eventType("onSuccess"));
});
