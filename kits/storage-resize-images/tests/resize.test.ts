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
 * Parity with the extension's `__tests__/resize.test.ts`. The extension reads
 * sharp options off the module-level config singleton and measures the output
 * with `image-size`; the kit passes config in and sharp already reports the
 * dimensions it wrote.
 */

import * as path from "node:path";

import sharp from "sharp";
import { describe, expect, test } from "vitest";

import { resolveResizeImagesConfig } from "../src/export-config";
import {
  SUPPORTED_CONTENT_TYPES,
  SUPPORTED_IMAGE_CONTENT_TYPE_MAP,
} from "../src/global";
import { resize } from "../src/resize-image";

const TEST_IMAGE = path.join(__dirname, "fixtures", "test-image.png");

const config = resolveResizeImagesConfig({
  bucket: "extensions-testing.appspot.com",
  sizes: "200x200",
  deleteOriginal: "true",
  region: "us-central1",
});

describe("resize", () => {
  test("throw error if the wrong delimiter is used for resize string", () => {
    const filePath = "/file/path";
    const errorMessage = "height and width are not delimited by a ',' or a 'x'";

    expect(() => resize(filePath, "200200", config)).toThrow(errorMessage);
    expect(() => resize(filePath, "200 200", config)).toThrow(errorMessage);
  });

  test("accepts both the ',' and 'x' delimiters", async () => {
    for (const size of ["75x75", "75,75"]) {
      const { width, height } = await sharp(
        await resize(TEST_IMAGE, size, config)
      ).metadata();
      expect(width).toEqual(75);
      expect(height).toEqual(75);
    }
  });

  test("resize image correctly", async () => {
    const modifiedImageBuffer = await resize(TEST_IMAGE, "75x75", config);
    const { width, height } = await sharp(modifiedImageBuffer).metadata();

    expect(width).toEqual(75);
    expect(height).toEqual(75);
  });

  test("does not enlarge an image past its original size", async () => {
    const original = await sharp(TEST_IMAGE).metadata();
    const { width, height } = await sharp(
      await resize(TEST_IMAGE, "5000x5000", config)
    ).metadata();

    expect(width).toEqual(original.width);
    expect(height).toEqual(original.height);
  });

  test("ignores unparseable sharpOptions instead of throwing", async () => {
    // `resolveResizeImagesConfig` itself parses sharpOptions and would throw,
    // so the malformed value is injected past it to exercise resize's guard.
    const buffer = await resize(TEST_IMAGE, "50x50", {
      ...config,
      sharpOptions: "not json",
    });

    const { width } = await sharp(buffer).metadata();
    expect(width).toEqual(50);
  });

  test("config resolution rejects unparseable sharpOptions", () => {
    // Matches the extension: a malformed SHARP_OPTIONS is a cold-start throw,
    // not a silently ignored value.
    expect(() =>
      resolveResizeImagesConfig({
        bucket: "b",
        sizes: "50x50",
        sharpOptions: "not json",
      })
    ).toThrow(SyntaxError);
  });

  test("image types supported", () => {
    expect(SUPPORTED_CONTENT_TYPES).toEqual(
      expect.arrayContaining([
        "image/jpeg",
        "image/png",
        "image/tiff",
        "image/webp",
      ])
    );
    expect(SUPPORTED_IMAGE_CONTENT_TYPE_MAP).toMatchObject({
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      tiff: "image/tiff",
      webp: "image/webp",
    });
  });
});
