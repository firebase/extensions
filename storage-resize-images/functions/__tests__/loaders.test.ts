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

import mockedEnv from "mocked-env";
import * as path from "path";
import sharp from "sharp";

const restoreEnv = mockedEnv({
  LOCATION: "us-central1",
  IMG_BUCKET: "extensions-testing.appspot.com",
  IMG_SIZES: "200x200",
  DELETE_ORIGINAL_FILE: "false",
});

import { resize } from "../src/resize-image";
import { shouldResize } from "../src/filters";
import { allowedLoaders } from "../src/loaders";

afterAll(() => restoreEnv());

// SVG bytes stored under a .png name, the shape of an upload whose
// contentType metadata says image/png.
const SVG_AS_PNG = path.join(__dirname, "svg-bytes-as.png");

describe("loader restriction", () => {
  test("the contentType gate alone admits SVG bytes labelled image/png", () => {
    expect(
      shouldResize({
        name: "uploads/svg-bytes-as.png",
        bucket: "extensions-testing.appspot.com",
        contentType: "image/png",
        metadata: {},
      } as any)
    ).toBe(true);
  });

  test("resize rejects bytes for a format outside supportedContentTypes", async () => {
    await expect(resize(SVG_AS_PNG, "200x200")).rejects.toThrow(
      /unsupported image format/
    );
  });

  test("resize still handles every supported format", async () => {
    const png = await sharp({
      create: { width: 64, height: 48, channels: 3, background: "#3b35ae" },
    })
      .png()
      .toBuffer();
    const inputs = {
      jpeg: await sharp(png).jpeg().toBuffer(),
      png,
      tiff: await sharp(png).tiff().toBuffer(),
      webp: await sharp(png).webp().toBuffer(),
      gif: await sharp(png).gif().toBuffer(),
      avif: await sharp(png).avif().toBuffer(),
    };
    for (const [format, buffer] of Object.entries(inputs)) {
      const out = await resize(buffer, "20x20");
      expect(out.length).toBeGreaterThan(0);
      expect((await sharp(buffer).metadata()).format).toBe(
        format === "avif" ? "heif" : format
      );
    }
    expect(allowedLoaders).toHaveLength(6);
  });
});
