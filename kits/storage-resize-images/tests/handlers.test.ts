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
 * Parity with the extension's `__tests__/unit/generateResizedImageHandler.test.ts`.
 * The extension loads config from the emulator's `.env.local` and reads the
 * `config` singleton; the kit's handler takes a `HandlerContext`, so the
 * config and the storage handle are supplied per case instead.
 */

import * as path from "node:path";

import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return { ...actual, copyFileSync: vi.fn() };
});

vi.mock("../src/filters", () => ({ shouldResize: vi.fn() }));

vi.mock("../src/file-operations", () => ({
  downloadOriginalFile: vi.fn(),
  handleFailedImage: vi.fn().mockResolvedValue(undefined),
  deleteTempFile: vi.fn().mockResolvedValue(undefined),
  deleteRemoteFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/content-filter", () => ({ checkImageContent: vi.fn() }));

vi.mock("../src/placeholder", () => ({
  replacePlaceholder: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/resize-image", () => ({ resizeImages: vi.fn() }));

vi.mock("../src/events", () => ({
  setupEventChannel: vi.fn(),
  recordStartEvent: vi.fn().mockResolvedValue(undefined),
  recordStartResizeEvent: vi.fn().mockResolvedValue(undefined),
  recordSuccessEvent: vi.fn().mockResolvedValue(undefined),
  recordErrorEvent: vi.fn().mockResolvedValue(undefined),
  recordCompletionEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/logs", () => ({
  init: vi.fn(),
  start: vi.fn(),
  failed: vi.fn(),
  complete: vi.fn(),
  error: vi.fn(),
  contentFilterErrored: vi.fn(),
  contentFilterRejected: vi.fn(),
  placeholderReplaceError: vi.fn(),
}));

import * as fs from "node:fs";

import { checkImageContent } from "../src/content-filter";
import * as events from "../src/events";
import {
  DELETE_IMAGE,
  type ResizeImagesConfig,
  type ResolvedResizeImagesConfig,
  resolveResizeImagesConfig,
} from "../src/export-config";
import {
  deleteRemoteFile,
  deleteTempFile,
  downloadOriginalFile,
  handleFailedImage,
} from "../src/file-operations";
import { shouldResize } from "../src/filters";
import {
  generateResizedImageHandler,
  type HandlerContext,
  handleObjectFinalized,
} from "../src/handlers";
import * as logs from "../src/logs";
import { replacePlaceholder } from "../src/placeholder";
import { resizeImages } from "../src/resize-image";
import type { StorageObjectMetadata } from "../src/util";

const mock = <T>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

const bucketStub = {};

// deleteOriginal is pinned: an omitted value resolves to on_success, and
// these tests exercise handler logic, not the resolver's defaults.
const baseInput: ResizeImagesConfig = {
  bucket: "demo-bucket",
  sizes: "200x200",
  region: "us-central1",
  deleteOriginal: "false",
};

function makeCtx(
  overrides: Partial<ResolvedResizeImagesConfig> = {},
  input: ResizeImagesConfig = baseInput
): HandlerContext {
  return {
    config: {
      ...resolveResizeImagesConfig(input),
      ...overrides,
    },
    storage: {
      bucket: vi.fn(() => bucketStub),
    } as unknown as HandlerContext["storage"],
  };
}

const mockObject = {
  bucket: "demo-bucket",
  name: "images/test.jpg",
  contentType: "image/jpeg",
} satisfies StorageObjectMetadata;

const parsedPathMatcher = expect.objectContaining({
  dir: "images",
  base: "test.jpg",
  name: "test",
  ext: ".jpg",
});

/** The default happy-path wiring the extension's tests set up per case. */
function primeHappyPath() {
  mock(shouldResize).mockReturnValue(true);
  mock(downloadOriginalFile).mockResolvedValue(["/tmp/test.jpg", {}]);
  mock(checkImageContent).mockResolvedValue(true);
  mock(resizeImages).mockResolvedValue([
    { status: "fulfilled", value: { success: true } },
  ]);
  mock(replacePlaceholder).mockResolvedValue(undefined);
}

describe("generateResizedImageHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    primeHappyPath();
  });

  test("routes blocked-by-filter images to the failed-image path with blockedByFilter=true", async () => {
    const ctx = makeCtx();
    mock(checkImageContent).mockResolvedValue(false);

    await generateResizedImageHandler(mockObject, ctx, false);

    expect(handleFailedImage).toHaveBeenCalledWith(
      bucketStub,
      "/tmp/test.jpg",
      mockObject,
      parsedPathMatcher,
      true,
      ctx.config
    );
    expect(handleFailedImage).toHaveBeenCalledTimes(1);
    expect(fs.copyFileSync).toHaveBeenCalledWith(
      "/tmp/test.jpg",
      "/tmp/test.jpg-placeholder"
    );
    expect(replacePlaceholder).toHaveBeenCalledWith(
      "/tmp/test.jpg-placeholder",
      bucketStub,
      null
    );
    expect(resizeImages).toHaveBeenCalledWith(
      bucketStub,
      "/tmp/test.jpg-placeholder",
      parsedPathMatcher,
      mockObject,
      ctx.config
    );
  });

  test("resizes when the content filter passes", async () => {
    const ctx = makeCtx();

    await generateResizedImageHandler(mockObject, ctx, false);

    expect(replacePlaceholder).not.toHaveBeenCalled();
    expect(resizeImages).toHaveBeenCalledWith(
      bucketStub,
      "/tmp/test.jpg",
      parsedPathMatcher,
      mockObject,
      ctx.config
    );
    expect(handleFailedImage).not.toHaveBeenCalled();
  });

  test("treats filter errors as failures and skips resizing", async () => {
    const ctx = makeCtx();
    mock(checkImageContent).mockRejectedValue(new Error("filter boom"));

    await generateResizedImageHandler(mockObject, ctx, false);

    expect(replacePlaceholder).not.toHaveBeenCalled();
    expect(resizeImages).not.toHaveBeenCalled();
    expect(handleFailedImage).toHaveBeenCalledWith(
      bucketStub,
      "/tmp/test.jpg",
      mockObject,
      parsedPathMatcher,
      false,
      ctx.config
    );
  });

  test("still routes blocked images to the failed path when placeholder swap errors", async () => {
    const ctx = makeCtx();
    mock(checkImageContent).mockResolvedValue(false);
    const swapErr = new Error("swap boom");
    mock(replacePlaceholder).mockRejectedValue(swapErr);

    await generateResizedImageHandler(mockObject, ctx, false);

    expect(handleFailedImage).toHaveBeenCalledWith(
      bucketStub,
      "/tmp/test.jpg",
      mockObject,
      parsedPathMatcher,
      true,
      ctx.config
    );
    expect(handleFailedImage).toHaveBeenCalledTimes(1);
    expect(fs.copyFileSync).toHaveBeenCalledWith(
      "/tmp/test.jpg",
      "/tmp/test.jpg-placeholder"
    );
    expect(replacePlaceholder).toHaveBeenCalledWith(
      "/tmp/test.jpg-placeholder",
      bucketStub,
      null
    );
    expect(logs.placeholderReplaceError).toHaveBeenCalledWith(swapErr);
    expect(logs.contentFilterErrored).not.toHaveBeenCalled();
    expect(resizeImages).not.toHaveBeenCalled();
  });

  test("does nothing when the object is filtered out", async () => {
    const ctx = makeCtx();
    mock(shouldResize).mockReturnValue(false);

    await generateResizedImageHandler(mockObject, ctx, false);

    expect(downloadOriginalFile).not.toHaveBeenCalled();
    expect(events.recordStartResizeEvent).not.toHaveBeenCalled();
    expect(resizeImages).not.toHaveBeenCalled();
  });

  test("reports the resize outcome on the success event", async () => {
    const ctx = makeCtx();

    await generateResizedImageHandler(mockObject, ctx, false);

    expect(events.recordStartResizeEvent).toHaveBeenCalledWith({
      subject: "images/test.jpg",
      data: { input: mockObject },
    });
    expect(events.recordSuccessEvent).toHaveBeenCalledWith({
      subject: "images/test.jpg",
      data: {
        input: mockObject,
        outputs: [{ status: "fulfilled", value: { success: true } }],
        contentFilterPassed: true,
      },
    });
  });

  test("flags contentFilterPassed: false on the success event for blocked images", async () => {
    const ctx = makeCtx();
    mock(checkImageContent).mockResolvedValue(false);

    await generateResizedImageHandler(mockObject, ctx, false);

    expect(events.recordSuccessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ contentFilterPassed: false }),
      })
    );
  });

  test("treats a rejected resize task as a failure", async () => {
    const ctx = makeCtx();
    mock(resizeImages).mockResolvedValue([
      { status: "rejected", reason: new Error("boom") },
    ]);

    await generateResizedImageHandler(mockObject, ctx, false);

    expect(logs.failed).toHaveBeenCalled();
    expect(handleFailedImage).toHaveBeenCalledTimes(1);
  });

  test("treats an unsuccessful resize result as a failure", async () => {
    const ctx = makeCtx();
    mock(resizeImages).mockResolvedValue([
      { status: "fulfilled", value: { success: false } },
    ]);

    await generateResizedImageHandler(mockObject, ctx, false);

    expect(logs.failed).toHaveBeenCalled();
    expect(handleFailedImage).toHaveBeenCalledTimes(1);
  });

  test("treats zero resize outputs as a failure", async () => {
    const ctx = makeCtx();
    mock(resizeImages).mockResolvedValue([]);

    await generateResizedImageHandler(mockObject, ctx, false);

    expect(logs.failed).toHaveBeenCalled();
    expect(handleFailedImage).toHaveBeenCalledTimes(1);
  });

  test("keeps the original under on_success when no resize was produced", async () => {
    mock(downloadOriginalFile).mockResolvedValue([
      "/tmp/test.jpg",
      { delete: vi.fn() },
    ]);
    mock(resizeImages).mockResolvedValue([]);
    const ctx = makeCtx({ deleteOriginalFile: DELETE_IMAGE.onSuccess });

    await generateResizedImageHandler(mockObject, ctx, false);

    expect(deleteRemoteFile).not.toHaveBeenCalled();
  });

  test("deletes the original only after a successful run under on_success", async () => {
    const remoteFile = { delete: vi.fn() };
    mock(downloadOriginalFile).mockResolvedValue(["/tmp/test.jpg", remoteFile]);
    const ctx = makeCtx({ deleteOriginalFile: DELETE_IMAGE.onSuccess });

    await generateResizedImageHandler(mockObject, ctx, false);

    expect(deleteRemoteFile).toHaveBeenCalledWith(
      remoteFile,
      "images/test.jpg"
    );
    expect(deleteRemoteFile).toHaveBeenCalledTimes(1);
  });

  test("keeps the original on a failed run under on_success", async () => {
    mock(downloadOriginalFile).mockResolvedValue([
      "/tmp/test.jpg",
      { delete: vi.fn() },
    ]);
    mock(resizeImages).mockResolvedValue([
      { status: "fulfilled", value: { success: false } },
    ]);
    const ctx = makeCtx({ deleteOriginalFile: DELETE_IMAGE.onSuccess });

    await generateResizedImageHandler(mockObject, ctx, false);

    expect(deleteRemoteFile).not.toHaveBeenCalled();
  });

  test("deletes the original regardless of outcome under always", async () => {
    const remoteFile = { delete: vi.fn() };
    mock(downloadOriginalFile).mockResolvedValue(["/tmp/test.jpg", remoteFile]);
    mock(resizeImages).mockResolvedValue([
      { status: "fulfilled", value: { success: false } },
    ]);
    const ctx = makeCtx({ deleteOriginalFile: DELETE_IMAGE.always });

    await generateResizedImageHandler(mockObject, ctx, false);

    expect(deleteRemoteFile).toHaveBeenCalledWith(
      remoteFile,
      "images/test.jpg"
    );
  });

  test("never deletes the original under never", async () => {
    mock(downloadOriginalFile).mockResolvedValue([
      "/tmp/test.jpg",
      { delete: vi.fn() },
    ]);
    const ctx = makeCtx({ deleteOriginalFile: DELETE_IMAGE.never });

    await generateResizedImageHandler(mockObject, ctx, false);

    expect(deleteRemoteFile).not.toHaveBeenCalled();
  });

  test("an omitted deleteOriginal deletes the original after a successful run", async () => {
    // The extension resolved an unset DELETE_ORIGINAL_FILE to on_success.
    const remoteFile = { delete: vi.fn() };
    mock(downloadOriginalFile).mockResolvedValue(["/tmp/test.jpg", remoteFile]);
    const ctx = makeCtx(
      {},
      { bucket: "demo-bucket", sizes: "200x200", region: "us-central1" }
    );

    await generateResizedImageHandler(mockObject, ctx, false);

    expect(deleteRemoteFile).toHaveBeenCalledWith(
      remoteFile,
      "images/test.jpg"
    );
    expect(deleteRemoteFile).toHaveBeenCalledTimes(1);
  });

  test("an omitted deleteOriginal keeps the original on a failed run", async () => {
    mock(downloadOriginalFile).mockResolvedValue([
      "/tmp/test.jpg",
      { delete: vi.fn() },
    ]);
    mock(resizeImages).mockResolvedValue([
      { status: "fulfilled", value: { success: false } },
    ]);
    const ctx = makeCtx(
      {},
      { bucket: "demo-bucket", sizes: "200x200", region: "us-central1" }
    );

    await generateResizedImageHandler(mockObject, ctx, false);

    expect(deleteRemoteFile).not.toHaveBeenCalled();
  });

  test("cleans up the temp files it created", async () => {
    const ctx = makeCtx();
    mock(checkImageContent).mockResolvedValue(false);

    await generateResizedImageHandler(mockObject, ctx, false);

    expect(deleteTempFile).toHaveBeenCalledWith(
      "/tmp/test.jpg",
      "images/test.jpg",
      false
    );
    expect(deleteTempFile).toHaveBeenCalledWith(
      "/tmp/test.jpg-placeholder",
      "images/test.jpg",
      false
    );
  });

  test("records an error event and cleans up when the download throws", async () => {
    const ctx = makeCtx();
    const err = new Error("download boom");
    mock(downloadOriginalFile).mockRejectedValue(err);

    await generateResizedImageHandler(mockObject, ctx, false);

    expect(logs.error).toHaveBeenCalledWith(err);
    expect(events.recordErrorEvent).toHaveBeenCalledWith(err);
    expect(deleteTempFile).not.toHaveBeenCalled();
  });

  test("wraps a non-Error throw before recording it", async () => {
    const ctx = makeCtx();
    mock(downloadOriginalFile).mockRejectedValue("just a string");

    await generateResizedImageHandler(mockObject, ctx, false);

    expect(events.recordErrorEvent).toHaveBeenCalledWith(
      expect.objectContaining({ message: "just a string" })
    );
  });

  test("logs start and complete when verbose", async () => {
    const ctx = makeCtx();

    await generateResizedImageHandler(mockObject, ctx);

    expect(logs.start).toHaveBeenCalledWith(ctx.config);
    expect(logs.complete).toHaveBeenCalled();
  });

  test("stays quiet when not verbose", async () => {
    const ctx = makeCtx();

    await generateResizedImageHandler(mockObject, ctx, false);

    expect(logs.start).not.toHaveBeenCalled();
    expect(logs.complete).not.toHaveBeenCalled();
  });
});

describe("handleObjectFinalized", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    primeHappyPath();
  });

  const storageEvent = {
    id: "event-1",
    type: "google.cloud.storage.object.v1.finalized",
    source: "//storage.googleapis.com/projects/_/buckets/demo-bucket",
    time: "2026-01-01T00:00:00.000Z",
    data: mockObject,
  } as unknown as Parameters<typeof handleObjectFinalized>[0];

  test("brackets the resize with start and completion events", async () => {
    await handleObjectFinalized(storageEvent, makeCtx());

    expect(events.recordStartEvent).toHaveBeenCalledWith(mockObject);
    expect(events.recordCompletionEvent).toHaveBeenCalledWith({
      context: {
        eventId: "event-1",
        eventType: "google.cloud.storage.object.v1.finalized",
        resource: "//storage.googleapis.com/projects/_/buckets/demo-bucket",
        timestamp: "2026-01-01T00:00:00.000Z",
      },
    });
  });

  test("resolves the bucket from the event payload", async () => {
    const ctx = makeCtx();

    await handleObjectFinalized(storageEvent, ctx);

    expect(ctx.storage.bucket).toHaveBeenCalledWith("demo-bucket");
  });

  test("still emits the completion event when the resize errors", async () => {
    mock(downloadOriginalFile).mockRejectedValue(new Error("boom"));

    await handleObjectFinalized(storageEvent, makeCtx());

    expect(events.recordCompletionEvent).toHaveBeenCalledTimes(1);
  });

  test("passes the event's object name through to the parsed path", async () => {
    await handleObjectFinalized(
      {
        ...storageEvent,
        data: { ...mockObject, name: "nested/dir/photo.png" },
      } as never,
      makeCtx()
    );

    expect(resizeImages).toHaveBeenCalledWith(
      bucketStub,
      "/tmp/test.jpg",
      expect.objectContaining({
        dir: path.parse("nested/dir/photo.png").dir,
        name: "photo",
        ext: ".png",
      }),
      expect.objectContaining({ name: "nested/dir/photo.png" }),
      expect.anything()
    );
  });
});
