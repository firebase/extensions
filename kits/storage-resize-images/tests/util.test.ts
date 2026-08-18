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

import { describe, expect, test } from "vitest";

import { convertPathToPosix, startsWithArray } from "../src/util";

const imagePath = ["/test/picture"];

describe("startsWithArray", () => {
  test("allowed paths", () => {
    const allowed = ["/test/picture", "/test/picture/directory"];

    for (const path of allowed) {
      expect(startsWithArray(imagePath, path)).toBe(true);
    }
  });

  test("blocked paths", () => {
    const notAllowed = [
      "/test",
      "/test/pict",
      "/test/pictures",
      "/test/picturesssssss",
    ];

    for (const path of notAllowed) {
      expect(startsWithArray(imagePath, path)).toBe(false);
    }
  });

  test("can handle allowed globbed paths", () => {
    const imagePaths = ["/test/picture", "/test/*/picture"];
    const allowed = [
      "/test/picture",
      "/test/something/picture",
      "/test/folder1/folder2/picture",
    ];

    for (const path of allowed) {
      expect(startsWithArray(imagePaths, path)).toBe(true);
    }
  });

  test("can handle not allowed globbed paths", () => {
    const imagePaths = ["/test/picture", "/test/*/picture"];
    const notAllowed = ["/test/*/pictures", "/test/*/folder2/pictures"];

    for (const path of notAllowed) {
      expect(startsWithArray(imagePaths, path)).toBe(false);
    }
  });

  test("can handle '+' when replacing '*' in globbed paths", () => {
    const allowed = ["/test/picture", "/test/*/picture"];
    const imagePaths = ["/test/picture", "/test/+/picture"];

    for (const path of imagePaths) {
      expect(startsWithArray(allowed, path)).toBe(true);
    }
  });
});

describe("convertPathToPosix", () => {
  const windowsPaths = [
    "C:\\Users\\test\\image.jpg",
    "D:\\Users\\test\\image.jpg",
    "E:\\Users\\test\\image.jpg",
    "Z:\\Users\\test\\image.jpg",
    "C:\\Users\\test:user\\image.jpg",
  ];

  test("converts windows path to posix without drive", () => {
    const expected = [
      "/Users/test/image.jpg",
      "/Users/test/image.jpg",
      "/Users/test/image.jpg",
      "/Users/test/image.jpg",
      "/Users/test:user/image.jpg",
    ];

    windowsPaths.forEach((windowsPath, index) => {
      expect(convertPathToPosix(windowsPath, true)).toBe(expected[index]);
    });
  });

  test("converts windows path to posix with drive", () => {
    const expected = [
      "C:/Users/test/image.jpg",
      "D:/Users/test/image.jpg",
      "E:/Users/test/image.jpg",
      "Z:/Users/test/image.jpg",
      "C:/Users/test:user/image.jpg",
    ];

    windowsPaths.forEach((windowsPath, index) => {
      expect(convertPathToPosix(windowsPath, false)).toBe(expected[index]);
    });
  });

  test("converts posix path to posix (no change)", () => {
    const posixPaths = ["/Users/test/image.jpg", "/Users/test:user/image.jpg"];

    for (const posixPath of posixPaths) {
      expect(convertPathToPosix(posixPath)).toBe(posixPath);
    }
  });
});
