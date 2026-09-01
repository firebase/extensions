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
 * Parity with the extension's `__tests__/util.test.ts`, plus the traversal
 * and metadata-conversion helpers the extension only covers indirectly.
 */

import { describe, expect, it, test } from "vitest";

import {
  convertPathToPosix,
  convertToObjectMetadata,
  countNegativeTraversals,
  startsWithArray,
  validateFile,
} from "../src/util";

const imagePath = ["/test/picture"];

describe("startsWithArray function for testing image path", () => {
  it("allowed paths", () => {
    const allowed = ["/test/picture", "/test/picture/directory"];

    allowed.forEach((path) => {
      expect(startsWithArray(imagePath, path)).toBe(true);
    });
  });

  it("blocked paths", () => {
    const notAllowed = [
      "/test",
      "/test/pict",
      "/test/pictures",
      "/test/picturesssssss",
    ];

    notAllowed.forEach((path) => {
      expect(startsWithArray(imagePath, path)).toBe(false);
    });
  });

  it("can handle allowed globbed paths", () => {
    const imagePaths = ["/test/picture", "/test/*/picture"];
    const allowed = [
      "/test/picture",
      "/test/something/picture",
      "/test/folder1/folder2/picture",
    ];

    allowed.forEach((path) => {
      expect(startsWithArray(imagePaths, path)).toBe(true);
    });
  });

  it("can handle not allowed globbed paths", () => {
    const imagePaths = ["/test/picture", "/test/*/picture"];
    const notAllowed = ["/test/*/pictures", "/test/*/folder2/pictures"];

    notAllowed.forEach((path) => {
      expect(startsWithArray(imagePaths, path)).toBe(false);
    });
  });

  it("can handle '+' when replacing '*' in globbed paths", () => {
    const allowed = ["/test/picture", "/test/*/picture"];
    const imagePaths = ["/test/picture", "/test/+/picture"];

    imagePaths.forEach((path) => {
      expect(startsWithArray(allowed, path)).toBe(true);
    });
  });

  it("trims whitespace around configured paths", () => {
    expect(startsWithArray([" /test/picture "], "/test/picture")).toBe(true);
  });

  it("returns false for an empty path list", () => {
    expect(startsWithArray([], "/test/picture")).toBe(false);
  });
});

describe("convertPathToPosix function for converting path to posix", () => {
  it("converts windows path to posix without drive", () => {
    const windowsPaths = [
      "C:\\Users\\test\\image.jpg",
      "D:\\Users\\test\\image.jpg",
      "E:\\Users\\test\\image.jpg",
      "Z:\\Users\\test\\image.jpg",
      "C:\\Users\\test:user\\image.jpg",
    ];

    const expectedPosixPaths = [
      "/Users/test/image.jpg",
      "/Users/test/image.jpg",
      "/Users/test/image.jpg",
      "/Users/test/image.jpg",
      "/Users/test:user/image.jpg",
    ];

    windowsPaths.forEach((windowsPath, index) => {
      expect(convertPathToPosix(windowsPath, true)).toBe(
        expectedPosixPaths[index]
      );
    });
  });

  it("converts windows path to posix with drive", () => {
    const windowsPaths = [
      "C:\\Users\\test\\image.jpg",
      "D:\\Users\\test\\image.jpg",
      "E:\\Users\\test\\image.jpg",
      "Z:\\Users\\test\\image.jpg",
      "C:\\Users\\test:user\\image.jpg",
    ];

    const expectedPosixPaths = [
      "C:/Users/test/image.jpg",
      "D:/Users/test/image.jpg",
      "E:/Users/test/image.jpg",
      "Z:/Users/test/image.jpg",
      "C:/Users/test:user/image.jpg",
    ];

    windowsPaths.forEach((windowsPath, index) => {
      expect(convertPathToPosix(windowsPath, false)).toBe(
        expectedPosixPaths[index]
      );
    });
  });

  it("converts posix path to posix (no change)", () => {
    const posixPaths = ["/Users/test/image.jpg", "/Users/test:user/image.jpg"];

    const expectedPosixPaths = [
      "/Users/test/image.jpg",
      "/Users/test:user/image.jpg",
    ];

    posixPaths.forEach((posixPath, index) => {
      expect(convertPathToPosix(posixPath)).toBe(expectedPosixPaths[index]);
    });
  });
});

describe("countNegativeTraversals", () => {
  test.each([
    ["images/thumbs", 0],
    ["images/../thumbs", 1],
    // The `/../` matches cannot overlap, so this counts once, not twice.
    ["images/../../thumbs", 1],
    ["images/../a/../thumbs", 2],
    // No leading separator, so nothing matches — the caller relies on the
    // path.join/normalize prefix check for this shape.
    ["../thumbs", 0],
  ])("%s → %i", (filePath, expected) => {
    expect(countNegativeTraversals(filePath)).toBe(expected);
  });
});

describe("validateFile", () => {
  test("accepts a supported content type", () => {
    expect(validateFile({ contentType: "image/png", name: "a.bin" })).toBe(
      true
    );
  });

  test("accepts a supported extension even without a content type", () => {
    expect(validateFile({ name: "a.JPEG" })).toBe(true);
  });

  test("rejects an unsupported file", () => {
    expect(validateFile({ contentType: "text/plain", name: "a.txt" })).toBe(
      false
    );
  });

  test("tolerates a missing name", () => {
    expect(validateFile({})).toBe(false);
  });
});

describe("convertToObjectMetadata", () => {
  test("stringifies custom metadata values", () => {
    const converted = convertToObjectMetadata({
      bucket: "demo-bucket",
      name: "images/test.jpg",
      contentType: "image/jpeg",
      metadata: { resizedImage: true, attempts: 2 } as never,
    });

    expect(converted.metadata).toEqual({
      resizedImage: "true",
      attempts: "2",
    });
  });

  test("defaults bucket and name to empty strings", () => {
    const converted = convertToObjectMetadata({});
    expect(converted.bucket).toBe("");
    expect(converted.name).toBe("");
    expect(converted.metadata).toBeUndefined();
  });
});
