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
import * as path from "node:path";
import sharp from "sharp";
import { beforeAll, describe, expect, test } from "vitest";

import { resolveResizeImagesConfig } from "../src/export-config";
import { convertType } from "../src/util";

const config = resolveResizeImagesConfig({
  bucket: "extensions-testing.appspot.com",
  sizes: "200x200",
  imageTypes: "jpeg",
});

const fixture = (name: string) => fs.readFileSync(path.join(__dirname, name));

const formatOf = async (buffer: Buffer) =>
  (await sharp(buffer).metadata()).format;

let bufferJPG: Buffer;
let bufferPNG: Buffer;
let bufferGIF: Buffer;

beforeAll(() => {
  bufferJPG = fixture("test-image.jpeg");
  bufferPNG = fixture("test-image.png");
  bufferGIF = fixture("test-image.gif");
});

describe("convertType", () => {
  test.each([
    ["png", () => bufferJPG, "png"],
    ["jpeg", () => bufferPNG, "jpeg"],
    ["webp", () => bufferPNG, "webp"],
    ["tiff", () => bufferPNG, "tiff"],
    ["gif", () => bufferGIF, "gif"],
  ])("converts to %s image type", async (format, source, expected) => {
    const buffer = await convertType(
      source(),
      format,
      config.outputOptions,
      config.animated
    );

    expect(await formatOf(buffer)).toBe(expected);
  });

  test("remains jpeg image type when the target type is not supported", async () => {
    const buffer = await convertType(
      bufferJPG,
      "raw",
      config.outputOptions,
      config.animated
    );

    expect(await formatOf(buffer)).toBe("jpeg");
  });

  test("remains gif image type when the target type is not supported", async () => {
    const buffer = await convertType(
      bufferGIF,
      "raw",
      config.outputOptions,
      config.animated
    );

    expect(await formatOf(buffer)).toBe("gif");
  });
});
