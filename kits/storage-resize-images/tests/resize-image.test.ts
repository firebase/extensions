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
import * as os from "node:os";
import * as path from "node:path";
import type { Bucket } from "@google-cloud/storage";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../src/logs");

import {
  type ResizeImagesConfig,
  resolveResizeImagesConfig,
} from "../src/export-config";
import {
  constructMetadata,
  getModifiedFilePath,
  modifyImage,
} from "../src/resize-image";
import type { StorageObjectMetadata } from "../src/util";

const TEST_IMAGE = path.join(__dirname, "test-image.png");

function makeConfig(overrides: Partial<ResizeImagesConfig> = {}) {
  return resolveResizeImagesConfig({
    bucket: "extensions-testing.appspot.com",
    sizes: "200x200",
    ...overrides,
  });
}

describe("getModifiedFilePath", () => {
  test("windows path handling", () => {
    const parsedPath = {
      ext: ".jpg",
      dir: "C:\\Users\\user\\Desktop\\storage-resize-images\\images",
      name: "test",
    };
    const modifiedFileName = `${parsedPath.name}_200x200${parsedPath.ext}`;

    expect(
      getModifiedFilePath(parsedPath.dir, "thumbnails", modifiedFileName)
    ).toBe(
      "C:/Users/user/Desktop/storage-resize-images/images/thumbnails/test_200x200.jpg"
    );
  });

  test("writes alongside the original when no resized path is set", () => {
    expect(getModifiedFilePath("images", undefined, "test_200x200.jpg")).toBe(
      "images/test_200x200.jpg"
    );
  });
});

describe("constructMetadata", () => {
  const objectMetadata = {
    bucket: "test-bucket",
    name: "images/test.jpg",
    contentType: "image/jpeg",
    cacheControl: "public, max-age=60",
    contentDisposition: "inline; filename*=utf-8''test.jpg",
    metadata: { firebaseStorageDownloadTokens: "original-token" },
  } as StorageObjectMetadata;

  test("marks the output as a resized image", () => {
    const metadata = constructMetadata(
      "test_200x200.jpeg",
      "image/jpeg",
      objectMetadata,
      makeConfig()
    );

    expect(metadata.metadata).toMatchObject({ resizedImage: "true" });
    expect(metadata.contentType).toBe("image/jpeg");
  });

  test("prefers the configured cache-control header", () => {
    const metadata = constructMetadata(
      "test_200x200.jpeg",
      "image/jpeg",
      objectMetadata,
      makeConfig({ cacheControlHeader: "public, max-age=31536000" })
    );

    expect(metadata.cacheControl).toBe("public, max-age=31536000");
  });

  test("falls back to the original cache-control header", () => {
    const metadata = constructMetadata(
      "test_200x200.jpeg",
      "image/jpeg",
      objectMetadata,
      makeConfig()
    );

    expect(metadata.cacheControl).toBe("public, max-age=60");
  });

  test("regenerates the download token unless it is turned off", () => {
    const regenerated = constructMetadata(
      "test_200x200.jpeg",
      "image/jpeg",
      objectMetadata,
      makeConfig()
    ).metadata as Record<string, string>;
    const kept = constructMetadata(
      "test_200x200.jpeg",
      "image/jpeg",
      objectMetadata,
      makeConfig({ regenerateToken: false })
    ).metadata as Record<string, string>;

    expect(regenerated.firebaseStorageDownloadTokens).not.toBe(
      "original-token"
    );
    expect(kept.firebaseStorageDownloadTokens).toBe("original-token");
  });

  test("rewrites the filename in the content disposition", () => {
    const metadata = constructMetadata(
      "test_200x200.jpeg",
      "image/jpeg",
      objectMetadata,
      makeConfig()
    );

    expect(metadata.contentDisposition).toBe(
      "inline; filename*=utf-8''test_200x200.jpeg"
    );
  });
});

describe("modifyImage", () => {
  const uploaded: { source: string; destination: string }[] = [];
  const makePublic = vi.fn().mockResolvedValue(undefined);
  const bucket = {
    upload: vi.fn(async (source: string, options: { destination: string }) => {
      uploaded.push({ source, destination: options.destination });
      return [{ makePublic }];
    }),
  } as unknown as Bucket;
  const objectMetadata = {
    bucket: "test-bucket",
    name: "images/test.png",
    contentType: "image/png",
    metadata: {},
  } as StorageObjectMetadata;

  beforeEach(() => {
    uploaded.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    // modifyImage writes to the OS temp dir and cleans up after itself.
    expect(uploaded.every(({ source }) => !fs.existsSync(source))).toBe(true);
  });

  test("uploads the resized image next to the original", async () => {
    const result = await modifyImage({
      bucket,
      originalFile: TEST_IMAGE,
      parsedPath: path.parse("images/test.png"),
      contentType: "image/png",
      size: "75x75",
      objectMetadata,
      format: "false",
      config: makeConfig(),
    });

    expect(result).toMatchObject({
      size: "75x75",
      outputFilePath: "images/test_75x75.png",
      success: true,
    });
    expect(uploaded[0].destination).toBe("images/test_75x75.png");
    expect(uploaded[0].source.startsWith(os.tmpdir())).toBe(true);
  });

  test("converts the output format and extension when one is configured", async () => {
    const result = await modifyImage({
      bucket,
      originalFile: TEST_IMAGE,
      parsedPath: path.parse("images/test.png"),
      contentType: "image/png",
      size: "75x75",
      objectMetadata,
      format: "webp",
      config: makeConfig({ resizedImagesPath: "thumbs" }),
    });

    expect(result.outputFilePath).toBe("images/thumbs/test_75x75.webp");
    const [, options] = vi.mocked(bucket.upload).mock.calls[0] as unknown as [
      string,
      { metadata: { contentType: string } }
    ];
    expect(options.metadata.contentType).toBe("image/webp");
  });

  test("makes the upload public only when configured", async () => {
    await modifyImage({
      bucket,
      originalFile: TEST_IMAGE,
      parsedPath: path.parse("images/test.png"),
      contentType: "image/png",
      size: "75x75",
      objectMetadata,
      format: "false",
      config: makeConfig({ makePublic: true }),
    });

    expect(makePublic).toHaveBeenCalledTimes(1);
  });

  test("reports failure instead of throwing when the upload fails", async () => {
    vi.mocked(bucket.upload).mockRejectedValueOnce(new Error("upload boom"));

    const result = await modifyImage({
      bucket,
      originalFile: TEST_IMAGE,
      parsedPath: path.parse("images/test.png"),
      contentType: "image/png",
      size: "75x75",
      objectMetadata,
      format: "false",
      config: makeConfig(),
    });

    expect(result.success).toBe(false);
  });
});
