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
 * Parity with the extension's `__tests__/filters.test.ts`. The extension's
 * `shouldResize` reads the module-level `config` singleton; the kit takes the
 * resolved config as a second argument, so the mutations the extension makes
 * to `config.includePathList` etc. become per-case config objects here.
 */

import * as path from "node:path";

import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../src/logs", () => ({
  noContentType: vi.fn(),
  contentTypeInvalid: vi.fn(),
  gzipContentEncoding: vi.fn(),
  unsupportedType: vi.fn(),
  imageOutsideOfPaths: vi.fn(),
  imageInsideOfExcludedPaths: vi.fn(),
  imageAlreadyResized: vi.fn(),
  imageFailedAttempt: vi.fn(),
}));

vi.mock("../src/util", async () => {
  const actual = await vi.importActual<typeof import("../src/util")>(
    "../src/util"
  );
  return { ...actual, startsWithArray: vi.fn() };
});

import type { ResolvedResizeImagesConfig } from "../src/export-config";
import { shouldResize } from "../src/filters";
import * as logs from "../src/logs";
import { startsWithArray, type StorageObjectMetadata } from "../src/util";

const startsWithArrayMock = startsWithArray as unknown as ReturnType<
  typeof vi.fn
>;

/** Mirrors the extension's mocked config, in resolved-config shape. */
function makeConfig(
  overrides: Partial<ResolvedResizeImagesConfig> = {}
): ResolvedResizeImagesConfig {
  return {
    bucket: "extensions-testing.appspot.com",
    imageSizes: ["200x200"],
    deleteOriginalFile: 0,
    makePublic: false,
    includePathList: undefined,
    excludePathList: undefined,
    imageTypes: ["false"],
    outputOptions: undefined,
    sharpOptions: "{}",
    animated: true,
    memory: "1GiB",
    regenerateToken: true,
    contentFilterLevel: null,
    customFilterPrompt: null,
    placeholderImagePath: null,
    cacheControlHeader: undefined,
    resizedImagesPath: undefined,
    failedImagesPath: undefined,
    region: "us-central1",
    ...overrides,
  };
}

const defaultMetadata = {
  bucket: "extensions-testing.appspot.com",
  name: "path/to/image.jpg",
  contentType: "image/jpeg",
  metadata: {},
} satisfies StorageObjectMetadata;

describe("shouldResize function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Content Type Checks", () => {
    test.each([
      ["no contentType", undefined, () => logs.noContentType],
      ["non-image contentType", "text/plain", () => logs.contentTypeInvalid],
      ["unsupported image format", "image/foo", () => logs.unsupportedType],
    ])("%s", (_desc, contentType, logFunction) => {
      const object = { ...defaultMetadata, contentType };
      const result = shouldResize(object, makeConfig());
      expect(logFunction()).toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  test("gzip", () => {
    const result = shouldResize(
      { ...defaultMetadata, contentEncoding: "gzip" },
      makeConfig()
    );
    expect(logs.gzipContentEncoding).toHaveBeenCalled();
    expect(result).toBe(false);
  });

  describe("Path Validations", () => {
    test("returns false if image is outside of allowed paths", () => {
      const config = makeConfig({ includePathList: ["/allowed"] });
      startsWithArrayMock.mockReturnValue(false);

      const result = shouldResize(defaultMetadata, config);

      const calls = (logs.imageOutsideOfPaths as ReturnType<typeof vi.fn>).mock
        .calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0][0]).toBe(config.includePathList?.[0]);
      expect(result).toBe(false);
    });

    test("returns false if image is inside of excluded paths", () => {
      const config = makeConfig({ excludePathList: ["/not-allowed"] });
      const tmpFilePath = path.resolve("/", "path/not-allowed/image.jpg");
      startsWithArrayMock.mockReturnValue(true);

      const result = shouldResize(
        { ...defaultMetadata, name: tmpFilePath },
        config
      );

      const calls = (
        logs.imageInsideOfExcludedPaths as ReturnType<typeof vi.fn>
      ).mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0][0]).toBe(config.excludePathList?.[0]);
      expect(result).toBe(false);
    });

    test("passes the posix-normalized directory to the path matchers", () => {
      // Guards the `convertPathToPosix(path.resolve(...))` call: on Windows
      // `path.resolve` yields `C:\path\to`, which must reach startsWithArray
      // as `/path/to`.
      startsWithArrayMock.mockReturnValue(true);

      shouldResize(defaultMetadata, makeConfig({ includePathList: ["/path"] }));

      expect(startsWithArrayMock).toHaveBeenCalledWith(["/path"], "/path/to");
    });
  });

  describe("Metadata Checks", () => {
    test.each([
      [
        "already resized",
        { resizedImage: "true" },
        () => logs.imageAlreadyResized,
      ],
      [
        "resizing failed previously",
        { resizeFailed: "true" },
        () => logs.imageFailedAttempt,
      ],
    ])(
      "returns false if image metadata indicates %s",
      (_desc, metadata, logFn) => {
        const result = shouldResize(
          { ...defaultMetadata, metadata },
          makeConfig()
        );
        expect(logFn()).toHaveBeenCalled();
        expect(result).toBe(false);
      }
    );

    test("a boolean-ish resizedImage marker does not skip the image", () => {
      // The kit writes `resizedImage: "true"` (string) and matches on the
      // string, so an unrelated truthy value must not short-circuit.
      const result = shouldResize(
        { ...defaultMetadata, metadata: { resizedImage: "false" } },
        makeConfig()
      );
      expect(logs.imageAlreadyResized).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  test("returns true if all conditions are met", () => {
    const config = makeConfig({
      includePathList: ["/allowed"],
      excludePathList: ["/not-allowed"],
    });
    startsWithArrayMock.mockReturnValueOnce(true).mockReturnValueOnce(false);

    const result = shouldResize(
      { ...defaultMetadata, name: "path/allowed/image.jpg" },
      config
    );

    expect(result).toBe(true);
  });

  test("accepts every supported content type", () => {
    for (const contentType of [
      "image/jpg",
      "image/jpeg",
      "image/png",
      "image/tiff",
      "image/webp",
      "image/gif",
      "image/avif",
    ]) {
      expect(
        shouldResize({ ...defaultMetadata, contentType }, makeConfig())
      ).toBe(true);
    }
  });
});
