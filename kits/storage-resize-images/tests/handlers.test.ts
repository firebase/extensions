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

import * as fs from "node:fs";
import type * as admin from "firebase-admin";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("node:fs", async (importOriginal) => ({
  ...(await importOriginal<typeof fs>()),
  copyFileSync: vi.fn(),
}));
vi.mock("../src/filters");
vi.mock("../src/file-operations");
vi.mock("../src/content-filter");
vi.mock("../src/placeholder");
vi.mock("../src/resize-image");
vi.mock("../src/events");
vi.mock("../src/logs");

import { checkImageContent } from "../src/content-filter";
import {
  type ResizeImagesConfig,
  resolveResizeImagesConfig,
} from "../src/export-config";
import {
  deleteRemoteFile,
  downloadOriginalFile,
  handleFailedImage,
} from "../src/file-operations";
import { shouldResize } from "../src/filters";
import {
  generateResizedImageHandler,
  type HandlerContext,
} from "../src/handlers";
import * as logs from "../src/logs";
import { replacePlaceholder } from "../src/placeholder";
import { resizeImages } from "../src/resize-image";
import type { StorageObjectMetadata } from "../src/util";

const mockObject = {
  bucket: "demo-bucket",
  name: "images/test.jpg",
  contentType: "image/jpeg",
} as StorageObjectMetadata;

const parsedPathMatcher = expect.objectContaining({
  dir: "images",
  base: "test.jpg",
  name: "test",
  ext: ".jpg",
});

const remoteFile = { name: "images/test.jpg" };

function makeCtx(configOverrides: Partial<ResizeImagesConfig> = {}) {
  const config = resolveResizeImagesConfig({
    bucket: "demo-bucket",
    sizes: "200x200",
    contentFilterLevel: "BLOCK_MEDIUM_AND_ABOVE",
    region: "us-central1",
    ...configOverrides,
  });
  return {
    config,
    storage: {
      bucket: vi.fn(() => ({})),
    } as unknown as admin.storage.Storage,
  } satisfies HandlerContext as HandlerContext;
}

describe("generateResizedImageHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(shouldResize).mockReturnValue(true);
    vi.mocked(downloadOriginalFile).mockResolvedValue([
      "/tmp/test.jpg",
      remoteFile as never,
    ]);
    vi.mocked(checkImageContent).mockResolvedValue(true);
    vi.mocked(replacePlaceholder).mockResolvedValue(undefined);
    vi.mocked(resizeImages).mockResolvedValue([
      {
        status: "fulfilled",
        value: {
          size: "200x200",
          outputFilePath: "images/test_200x200.jpg",
          success: true,
        },
      },
    ]);
  });

  test("does nothing for an object that should not be resized", async () => {
    vi.mocked(shouldResize).mockReturnValue(false);

    await generateResizedImageHandler(mockObject, makeCtx(), false);

    expect(downloadOriginalFile).not.toHaveBeenCalled();
    expect(resizeImages).not.toHaveBeenCalled();
  });

  test("routes blocked-by-filter images to the failed-image path", async () => {
    vi.mocked(checkImageContent).mockResolvedValue(false);

    await generateResizedImageHandler(mockObject, makeCtx(), false);

    expect(handleFailedImage).toHaveBeenCalledTimes(1);
    expect(handleFailedImage).toHaveBeenCalledWith(
      expect.anything(),
      "/tmp/test.jpg",
      mockObject,
      parsedPathMatcher,
      true,
      expect.anything()
    );
    expect(fs.copyFileSync).toHaveBeenCalledWith(
      "/tmp/test.jpg",
      "/tmp/test.jpg-placeholder"
    );
    expect(replacePlaceholder).toHaveBeenCalledWith(
      "/tmp/test.jpg-placeholder",
      expect.anything(),
      null
    );
    expect(resizeImages).toHaveBeenCalledWith(
      expect.anything(),
      "/tmp/test.jpg-placeholder",
      parsedPathMatcher,
      mockObject,
      expect.anything()
    );
  });

  test("resizes when the content filter passes", async () => {
    await generateResizedImageHandler(mockObject, makeCtx(), false);

    expect(replacePlaceholder).not.toHaveBeenCalled();
    expect(resizeImages).toHaveBeenCalledWith(
      expect.anything(),
      "/tmp/test.jpg",
      parsedPathMatcher,
      mockObject,
      expect.anything()
    );
    expect(handleFailedImage).not.toHaveBeenCalled();
  });

  test("treats filter errors as failures and skips resizing", async () => {
    vi.mocked(checkImageContent).mockRejectedValue(new Error("filter boom"));

    await generateResizedImageHandler(mockObject, makeCtx(), false);

    expect(replacePlaceholder).not.toHaveBeenCalled();
    expect(resizeImages).not.toHaveBeenCalled();
    expect(handleFailedImage).toHaveBeenCalledWith(
      expect.anything(),
      "/tmp/test.jpg",
      mockObject,
      parsedPathMatcher,
      false,
      expect.anything()
    );
  });

  test("still routes blocked images to the failed path when the placeholder swap errors", async () => {
    vi.mocked(checkImageContent).mockResolvedValue(false);
    const swapErr = new Error("swap boom");
    vi.mocked(replacePlaceholder).mockRejectedValue(swapErr);

    await generateResizedImageHandler(mockObject, makeCtx(), false);

    expect(handleFailedImage).toHaveBeenCalledTimes(1);
    expect(handleFailedImage).toHaveBeenCalledWith(
      expect.anything(),
      "/tmp/test.jpg",
      mockObject,
      parsedPathMatcher,
      true,
      expect.anything()
    );
    expect(logs.placeholderReplaceError).toHaveBeenCalledWith(swapErr);
    expect(logs.contentFilterErrored).not.toHaveBeenCalled();
    expect(resizeImages).not.toHaveBeenCalled();
  });

  test("stores the original when a resize fails", async () => {
    vi.mocked(resizeImages).mockResolvedValue([
      {
        status: "fulfilled",
        value: {
          size: "200x200",
          outputFilePath: "images/test_200x200.jpg",
          success: false,
        },
      },
    ]);

    await generateResizedImageHandler(mockObject, makeCtx(), false);

    expect(handleFailedImage).toHaveBeenCalledWith(
      expect.anything(),
      "/tmp/test.jpg",
      mockObject,
      parsedPathMatcher,
      false,
      expect.anything()
    );
    expect(logs.failed).toHaveBeenCalled();
  });

  test("deletes the original on success only in on_success mode", async () => {
    await generateResizedImageHandler(
      mockObject,
      makeCtx({ deleteOriginal: "on_success" }),
      false
    );

    expect(deleteRemoteFile).toHaveBeenCalledWith(
      remoteFile,
      "images/test.jpg"
    );
  });

  test("keeps the original when a resize fails in on_success mode", async () => {
    vi.mocked(resizeImages).mockResolvedValue([
      { status: "rejected", reason: new Error("resize boom") },
    ]);

    await generateResizedImageHandler(
      mockObject,
      makeCtx({ deleteOriginal: "on_success" }),
      false
    );

    expect(deleteRemoteFile).not.toHaveBeenCalled();
  });

  test("deletes the original on any attempt in always mode", async () => {
    vi.mocked(resizeImages).mockResolvedValue([
      { status: "rejected", reason: new Error("resize boom") },
    ]);

    await generateResizedImageHandler(
      mockObject,
      makeCtx({ deleteOriginal: "true" }),
      false
    );

    expect(deleteRemoteFile).toHaveBeenCalledWith(
      remoteFile,
      "images/test.jpg"
    );
  });

  test("never deletes the original by default", async () => {
    await generateResizedImageHandler(mockObject, makeCtx(), false);

    expect(deleteRemoteFile).not.toHaveBeenCalled();
  });
});
