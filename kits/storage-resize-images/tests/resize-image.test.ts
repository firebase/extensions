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
 * Parity with the extension's `__tests__/unit/modifyImage.test.ts` — the
 * Windows path regression in `getModifiedFilePath` — plus coverage of the
 * `modifyImage` / `constructMetadata` / `resizeImages` surface the extension
 * only reaches through its emulator e2e run, which a standalone kit cannot
 * use.
 */

import * as path from "node:path";

import { beforeEach, describe, expect, test, vi } from "vitest";

import type { ResolvedResizeImagesConfig } from "../src/export-config";
import { resolveResizeImagesConfig } from "../src/export-config";
import {
  constructMetadata,
  getModifiedFilePath,
  modifyImage,
  resizeImages,
} from "../src/resize-image";
import type { StorageObjectMetadata } from "../src/util";

const TEST_IMAGE = path.join(__dirname, "fixtures", "test-image.png");

function makeConfig(
  overrides: Partial<ResolvedResizeImagesConfig> = {}
): ResolvedResizeImagesConfig {
  return {
    ...resolveResizeImagesConfig({
      bucket: "extensions-testing.appspot.com",
      sizes: "200x200",
      region: "us-central1",
    }),
    ...overrides,
  };
}

const objectMetadata: StorageObjectMetadata = {
  bucket: "extensions-testing.appspot.com",
  name: "images/test.png",
  contentType: "image/png",
  metadata: {},
};

/** A Bucket stub that records uploads instead of performing them. */
function makeBucket() {
  const uploaded: { destination: string; metadata: unknown }[] = [];
  const makePublic = vi.fn().mockResolvedValue(undefined);
  const bucket = {
    upload: vi.fn(
      async (
        _localPath: string,
        options: { destination: string; metadata: unknown }
      ) => {
        uploaded.push(options);
        return [{ makePublic }];
      }
    ),
    file: vi.fn(),
  };
  return { bucket, uploaded, makePublic };
}

describe("getModifiedFilePath", () => {
  test("windows path handling", () => {
    // Regression: the old implementation used `path.posix.join` on a
    // backslash-separated dir, leaving the separators unconverted.
    const parsedPath = {
      ext: ".jpg",
      dir: "C:\\Users\\user\\Desktop\\storage-resize-images\\functions\\tests",
      name: "test",
    };
    const modifiedFileName = `${parsedPath.name}_200x200${parsedPath.ext}`;

    expect(
      getModifiedFilePath(parsedPath.dir, "thumbnails", modifiedFileName)
    ).toBe(
      "C:/Users/user/Desktop/storage-resize-images/functions/tests/thumbnails/test_200x200.jpg"
    );
  });

  test("expect old logic to fail", () => {
    const oldGetModifiedFilePath = (
      fileDir: string,
      resizedImagesPath: string | undefined,
      modifiedFileName: string
    ) =>
      path.posix.normalize(
        resizedImagesPath
          ? path.posix.join(fileDir, resizedImagesPath, modifiedFileName)
          : path.posix.join(fileDir, modifiedFileName)
      );

    const dir =
      "C:\\Users\\user\\Desktop\\storage-resize-images\\functions\\tests";

    expect(
      oldGetModifiedFilePath(dir, "thumbnails", "test_200x200.jpg")
    ).not.toBe(
      "C:/Users/user/Desktop/storage-resize-images/functions/tests/thumbnails/test_200x200.jpg"
    );
  });

  test("keeps the output beside the original when no resizedImagesPath is set", () => {
    expect(getModifiedFilePath("images", undefined, "test_200x200.png")).toBe(
      "images/test_200x200.png"
    );
  });

  test("nests the output under resizedImagesPath", () => {
    expect(getModifiedFilePath("images", "thumbs", "test_200x200.png")).toBe(
      "images/thumbs/test_200x200.png"
    );
  });

  test("handles a root-level original", () => {
    expect(getModifiedFilePath("", "thumbs", "test_200x200.png")).toBe(
      "thumbs/test_200x200.png"
    );
  });
});

describe("constructMetadata", () => {
  test("marks the output as resized and carries the content type", () => {
    const metadata = constructMetadata(
      "test_200x200.png",
      "image/png",
      objectMetadata,
      makeConfig()
    );

    expect(metadata.contentType).toBe("image/png");
    expect(metadata.metadata).toEqual({ resizedImage: "true" });
  });

  test("does not mutate the source object's metadata", () => {
    const source: StorageObjectMetadata = {
      ...objectMetadata,
      metadata: { owner: "abc" },
    };

    constructMetadata("test_200x200.png", "image/png", source, makeConfig());

    expect(source.metadata).toEqual({ owner: "abc" });
  });

  test("rewrites the filename inside contentDisposition", () => {
    const metadata = constructMetadata(
      "test_200x200.png",
      "image/png",
      {
        ...objectMetadata,
        contentDisposition: "inline; filename*=utf-8''x.png",
      },
      makeConfig()
    );

    expect(metadata.contentDisposition).toBe(
      "inline; filename*=utf-8''test_200x200.png"
    );
  });

  test("prefers the configured cacheControlHeader over the original", () => {
    const metadata = constructMetadata(
      "test_200x200.png",
      "image/png",
      { ...objectMetadata, cacheControl: "max-age=60" },
      makeConfig({ cacheControlHeader: "max-age=3600" })
    );

    expect(metadata.cacheControl).toBe("max-age=3600");
  });

  test("falls back to the original cacheControl when unset", () => {
    const metadata = constructMetadata(
      "test_200x200.png",
      "image/png",
      { ...objectMetadata, cacheControl: "max-age=60" },
      makeConfig({ cacheControlHeader: undefined })
    );

    expect(metadata.cacheControl).toBe("max-age=60");
  });

  test("treats an empty cacheControlHeader as unset", () => {
    const metadata = constructMetadata(
      "test_200x200.png",
      "image/png",
      { ...objectMetadata, cacheControl: "max-age=60" },
      makeConfig({ cacheControlHeader: "" })
    );

    expect(metadata.cacheControl).toBe("max-age=60");
  });

  test("regenerates an existing download token", () => {
    const metadata = constructMetadata(
      "test_200x200.png",
      "image/png",
      {
        ...objectMetadata,
        metadata: { firebaseStorageDownloadTokens: "original-token" },
      },
      makeConfig({ regenerateToken: true })
    );

    const custom = metadata.metadata as Record<string, string>;
    expect(custom.firebaseStorageDownloadTokens).not.toBe("original-token");
    expect(custom.firebaseStorageDownloadTokens).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("keeps the download token when regeneration is off", () => {
    const metadata = constructMetadata(
      "test_200x200.png",
      "image/png",
      {
        ...objectMetadata,
        metadata: { firebaseStorageDownloadTokens: "original-token" },
      },
      makeConfig({ regenerateToken: false })
    );

    const custom = metadata.metadata as Record<string, string>;
    expect(custom.firebaseStorageDownloadTokens).toBe("original-token");
  });
});

describe("modifyImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const parsedPath = path.parse("images/test.png");

  test("uploads the resized image and reports success", async () => {
    const { bucket, uploaded } = makeBucket();

    const result = await modifyImage({
      bucket: bucket as never,
      originalFile: TEST_IMAGE,
      parsedPath,
      contentType: "image/png",
      size: "50x50",
      objectMetadata,
      format: "false",
      config: makeConfig(),
    });

    expect(result).toEqual({
      size: "50x50",
      outputFilePath: "images/test_50x50.png",
      success: true,
    });
    expect(uploaded).toHaveLength(1);
    expect(uploaded[0].destination).toBe("images/test_50x50.png");
  });

  test("swaps the extension when converting the format", async () => {
    const { bucket, uploaded } = makeBucket();

    const result = await modifyImage({
      bucket: bucket as never,
      originalFile: TEST_IMAGE,
      parsedPath,
      contentType: "image/png",
      size: "50x50",
      objectMetadata,
      format: "webp",
      config: makeConfig(),
    });

    expect(result.outputFilePath).toBe("images/test_50x50.webp");
    expect(uploaded[0].metadata).toMatchObject({ contentType: "image/webp" });
  });

  test("appends the size for unrecognised extensions instead of replacing them", async () => {
    const { bucket } = makeBucket();

    const result = await modifyImage({
      bucket: bucket as never,
      originalFile: TEST_IMAGE,
      parsedPath: path.parse("images/test.bin"),
      contentType: "image/png",
      size: "50x50",
      objectMetadata,
      format: "false",
      config: makeConfig(),
    });

    expect(result.outputFilePath).toBe("images/test.bin_50x50");
  });

  test("makes the upload public when configured", async () => {
    const { bucket, makePublic } = makeBucket();

    await modifyImage({
      bucket: bucket as never,
      originalFile: TEST_IMAGE,
      parsedPath,
      contentType: "image/png",
      size: "50x50",
      objectMetadata,
      format: "false",
      config: makeConfig({ makePublic: true }),
    });

    expect(makePublic).toHaveBeenCalledTimes(1);
  });

  test("reports success: false rather than throwing on a bad size", async () => {
    const { bucket } = makeBucket();

    const result = await modifyImage({
      bucket: bucket as never,
      originalFile: TEST_IMAGE,
      parsedPath,
      contentType: "image/png",
      size: "50-50",
      objectMetadata,
      format: "false",
      config: makeConfig(),
    });

    expect(result.success).toBe(false);
    expect(bucket.upload).not.toHaveBeenCalled();
  });

  test("reports success: false when the upload fails", async () => {
    const { bucket } = makeBucket();
    bucket.upload.mockRejectedValueOnce(new Error("upload boom"));

    const result = await modifyImage({
      bucket: bucket as never,
      originalFile: TEST_IMAGE,
      parsedPath,
      contentType: "image/png",
      size: "50x50",
      objectMetadata,
      format: "false",
      config: makeConfig(),
    });

    expect(result.success).toBe(false);
  });
});

describe("resizeImages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("produces one output per format × size, deduplicated", async () => {
    const { bucket, uploaded } = makeBucket();

    const results = await resizeImages(
      bucket as never,
      TEST_IMAGE,
      path.parse("images/test.png"),
      objectMetadata,
      makeConfig({
        imageSizes: ["50x50", "60x60", "50x50"],
        imageTypes: ["false", "webp", "webp"],
      })
    );

    expect(results).toHaveLength(4);
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    expect(uploaded.map((u) => u.destination).sort()).toEqual([
      "images/test_50x50.png",
      "images/test_50x50.webp",
      "images/test_60x60.png",
      "images/test_60x60.webp",
    ]);
  });

  test("produces no outputs when no sizes are configured", async () => {
    const { bucket } = makeBucket();

    const results = await resizeImages(
      bucket as never,
      TEST_IMAGE,
      path.parse("images/test.png"),
      objectMetadata,
      makeConfig({ imageSizes: [] })
    );

    expect(results).toEqual([]);
    expect(bucket.upload).not.toHaveBeenCalled();
  });

  test("reports per-output failures without rejecting the batch", async () => {
    const { bucket } = makeBucket();
    bucket.upload.mockRejectedValueOnce(new Error("upload boom"));

    const results = await resizeImages(
      bucket as never,
      TEST_IMAGE,
      path.parse("images/test.png"),
      objectMetadata,
      makeConfig({ imageSizes: ["50x50", "60x60"], imageTypes: ["false"] })
    );

    expect(results).toHaveLength(2);
    const successes = results.map(
      (r) => r.status === "fulfilled" && r.value.success
    );
    expect(successes).toContain(false);
    expect(successes).toContain(true);
  });
});
