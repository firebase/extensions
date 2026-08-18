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

import * as path from "node:path";
import type { Bucket } from "@google-cloud/storage";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../src/logs");

import {
  type ResizeImagesConfig,
  resolveResizeImagesConfig,
} from "../src/export-config";
import { handleFailedImage } from "../src/file-operations";
import * as logs from "../src/logs";
import {
  countNegativeTraversals,
  type StorageObjectMetadata,
} from "../src/util";

const object = {
  bucket: "test-bucket",
  name: "users/uid1/images/photo.jpg",
  contentType: "image/jpeg",
} as StorageObjectMetadata;

function makeConfig(overrides: Partial<ResizeImagesConfig> = {}) {
  return resolveResizeImagesConfig({
    bucket: "extensions-testing.appspot.com",
    sizes: "200x200",
    ...overrides,
  });
}

function fakeBucket() {
  const upload = vi.fn().mockResolvedValue([{}]);
  return { upload, bucket: { upload } as unknown as Bucket };
}

const run = (
  failedImagesPath: string | undefined,
  contentFilterFailed = false
) => {
  const { upload, bucket } = fakeBucket();
  return handleFailedImage(
    bucket,
    "/tmp/local.jpg",
    object,
    path.parse(object.name),
    contentFilterFailed,
    makeConfig({ failedImagesPath })
  ).then(() => upload);
};

describe("countNegativeTraversals", () => {
  test("is non-zero for a path that walks up a directory", () => {
    // Matches do not overlap, so consecutive hops share a slash and count
    // once. Callers only branch on zero versus non-zero.
    expect(countNegativeTraversals("images/../config.json")).toBe(1);
    expect(countNegativeTraversals("images/../../config.json")).toBe(1);
    expect(countNegativeTraversals("images/thumbs")).toBe(0);
  });
});

describe("handleFailedImage", () => {
  beforeEach(() => vi.clearAllMocks());

  test("does nothing when no failed path is configured", async () => {
    expect(await run(undefined)).not.toHaveBeenCalled();
  });

  test("uploads the original under the failed path", async () => {
    const upload = await run("failed");

    expect(upload).toHaveBeenCalledWith("/tmp/local.jpg", {
      destination: "users/uid1/images/failed/photo.jpg",
      metadata: { metadata: { resizeFailed: "true" } },
    });
  });

  test("flags images the content filter rejected", async () => {
    const upload = await run("failed", true);

    expect(upload).toHaveBeenCalledWith("/tmp/local.jpg", {
      destination: "users/uid1/images/failed/photo.jpg",
      metadata: {
        metadata: { resizeFailed: "true", contentFilterFailed: "true" },
      },
    });
  });

  test("refuses a failed path that traverses out of the original directory", async () => {
    const upload = await run("../../..");

    expect(upload).not.toHaveBeenCalled();
    expect(logs.invalidFailedResizePath).toHaveBeenCalled();
  });

  test("refuses a single parent-directory hop", async () => {
    // No "/../" to count, so this only stays inside the original prefix
    // because the normalized destination is checked as well.
    const upload = await run("..");

    expect(upload).not.toHaveBeenCalled();
    expect(logs.invalidFailedResizePath).toHaveBeenCalled();
  });

  test("allows a nested failed path", async () => {
    const upload = await run("failed/thumbs");

    expect(upload).toHaveBeenCalledWith(
      "/tmp/local.jpg",
      expect.objectContaining({
        destination: "users/uid1/images/failed/thumbs/photo.jpg",
      })
    );
  });
});
