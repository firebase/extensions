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
import sharp from "sharp";
import { describe, expect, test } from "vitest";

import { resolveResizeImagesConfig } from "../src/export-config";
import {
  SUPPORTED_CONTENT_TYPES,
  SUPPORTED_IMAGE_CONTENT_TYPE_MAP,
} from "../src/global";
import { resize } from "../src/resize-image";

const TEST_IMAGE = path.join(__dirname, "test-image.png");

const config = resolveResizeImagesConfig({
  bucket: "extensions-testing.appspot.com",
  sizes: "200x200",
  deleteOriginal: "true",
});

describe("resize", () => {
  test("throws if the wrong delimiter is used for the resize string", () => {
    const errorMessage = "height and width are not delimited by a ',' or a 'x'";

    expect(() => resize("/file/path", "200200", config)).toThrow(errorMessage);
    expect(() => resize("/file/path", "200 200", config)).toThrow(errorMessage);
  });

  test("accepts either delimiter", async () => {
    for (const size of ["75x75", "75,75"]) {
      const metadata = await sharp(
        await resize(TEST_IMAGE, size, config)
      ).metadata();

      expect(metadata.width).toBe(75);
      expect(metadata.height).toBe(75);
    }
  });

  test("resizes the image correctly", async () => {
    const metadata = await sharp(
      await resize(TEST_IMAGE, "75x75", config)
    ).metadata();

    expect(metadata.width).toBe(75);
    expect(metadata.height).toBe(75);
  });

  test("does not enlarge an image smaller than the requested size", async () => {
    const original = await sharp(TEST_IMAGE).metadata();
    const metadata = await sharp(
      await resize(TEST_IMAGE, "5000x5000", config)
    ).metadata();

    expect(metadata.width).toBe(original.width);
    expect(metadata.height).toBe(original.height);
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
