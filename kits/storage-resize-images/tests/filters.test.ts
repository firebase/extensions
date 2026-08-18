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

import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../src/logs");

import {
  type ResizeImagesConfig,
  resolveResizeImagesConfig,
} from "../src/export-config";
import { shouldResize } from "../src/filters";
import * as logs from "../src/logs";
import type { StorageObjectMetadata } from "../src/util";

const defaultMetadata = {
  bucket: "test-bucket",
  name: "path/to/image.jpg",
  contentType: "image/jpeg",
  metadata: {},
};

function makeConfig(overrides: Partial<ResizeImagesConfig> = {}) {
  return resolveResizeImagesConfig({
    bucket: "extensions-testing.appspot.com",
    sizes: "200x200",
    deleteOriginal: "true",
    ...overrides,
  });
}

function check(
  object: Partial<StorageObjectMetadata>,
  overrides: Partial<ResizeImagesConfig> = {}
) {
  return shouldResize(
    { ...defaultMetadata, ...object } as StorageObjectMetadata,
    makeConfig(overrides)
  );
}

describe("shouldResize", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("content type checks", () => {
    test.each([
      ["no contentType", undefined, () => logs.noContentType],
      ["non-image contentType", "text/plain", () => logs.contentTypeInvalid],
      ["unsupported image format", "image/foo", () => logs.unsupportedType],
    ])("%s", (_desc, contentType, logFunction) => {
      expect(check({ contentType })).toBe(false);
      expect(logFunction()).toHaveBeenCalled();
    });
  });

  test("gzip", () => {
    expect(check({ contentEncoding: "gzip" })).toBe(false);
    expect(logs.gzipContentEncoding).toHaveBeenCalled();
  });

  describe("path validations", () => {
    test("returns false if image is outside of allowed paths", () => {
      expect(check({}, { includePathList: "/allowed" })).toBe(false);

      const calls = vi.mocked(logs.imageOutsideOfPaths).mock.calls;
      expect(calls).toHaveLength(1);
      expect(calls[0][0][0]).toBe("/allowed");
    });

    test("returns false if image is inside of excluded paths", () => {
      expect(
        check(
          { name: "path/not-allowed/image.jpg" },
          { excludePathList: "/path/not-allowed" }
        )
      ).toBe(false);

      const calls = vi.mocked(logs.imageInsideOfExcludedPaths).mock.calls;
      expect(calls).toHaveLength(1);
      expect(calls[0][0][0]).toBe("/path/not-allowed");
    });
  });

  describe("metadata checks", () => {
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
        expect(check({ metadata })).toBe(false);
        expect(logFn()).toHaveBeenCalled();
      }
    );
  });

  test("returns true if all conditions are met", () => {
    expect(
      check(
        { name: "path/allowed/image.jpg" },
        {
          includePathList: "/path/allowed",
          excludePathList: "/path/not-allowed",
        }
      )
    ).toBe(true);
  });
});
