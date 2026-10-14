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
 * Parity with the extension's `__tests__/convert-image.test.ts`. The
 * extension detects the output type with `image-type`; sharp already reports
 * the format it decoded, so it is used here rather than adding a dependency.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";

import { convertType } from "../src/util";

/** The mime type sharp reports for the buffer's decoded format. */
async function mimeOf(buffer: Buffer): Promise<string> {
  const { format } = await sharp(buffer).metadata();
  return `image/${format === "jpeg" ? "jpeg" : format}`;
}

const fixture = (name: string) => path.join(__dirname, "fixtures", name);

let bufferJPG: Buffer;
let bufferPNG: Buffer;
let bufferGIF: Buffer;

beforeAll(async () => {
  bufferJPG = await fs.readFile(fixture("test-image.jpeg"));
  bufferPNG = await fs.readFile(fixture("test-image.png"));
  bufferGIF = await fs.readFile(fixture("test-image.gif"));
});

describe("convertType", () => {
  it("converts to png image type", async () => {
    const buffer = await convertType(bufferJPG, "png", undefined, false);
    expect(await mimeOf(buffer)).toBe("image/png");
  });

  it("converts to jpeg image type", async () => {
    const buffer = await convertType(bufferPNG, "jpeg", undefined, false);
    expect(await mimeOf(buffer)).toBe("image/jpeg");
  });

  it("converts to jpeg image type for the 'jpg' alias", async () => {
    const buffer = await convertType(bufferPNG, "jpg", undefined, false);
    expect(await mimeOf(buffer)).toBe("image/jpeg");
  });

  it("converts to webp image type", async () => {
    const buffer = await convertType(bufferPNG, "webp", undefined, false);
    expect(await mimeOf(buffer)).toBe("image/webp");
  });

  it("converts to tiff image type", async () => {
    const buffer = await convertType(bufferPNG, "tiff", undefined, false);
    expect(await mimeOf(buffer)).toBe("image/tiff");
  });

  it("converts to tiff image type for the 'tif' alias", async () => {
    const buffer = await convertType(bufferPNG, "tif", undefined, false);
    expect(await mimeOf(buffer)).toBe("image/tiff");
  });

  it("converts to gif image type", async () => {
    const buffer = await convertType(bufferGIF, "gif", undefined, true);
    expect(await mimeOf(buffer)).toBe("image/gif");
  });

  it("converts to avif image type", async () => {
    const buffer = await convertType(bufferPNG, "avif", undefined, false);
    // sharp reports AVIF-in-HEIF as "heif".
    expect(["image/avif", "image/heif"]).toContain(await mimeOf(buffer));
  });

  it("remains jpeg image type when different image type is not supported", async () => {
    const buffer = await convertType(bufferJPG, "raw", undefined, false);
    expect(buffer).toBe(bufferJPG);
    expect(await mimeOf(buffer)).toBe("image/jpeg");
  });

  it("remains gif image type when different image type is not supported", async () => {
    const buffer = await convertType(bufferGIF, "raw", undefined, false);
    expect(buffer).toBe(bufferGIF);
    expect(await mimeOf(buffer)).toBe("image/gif");
  });

  it("applies parsed output options", async () => {
    // The gif fixture has enough detail for the quality setting to move the
    // output size; the flat png/jpeg fixtures compress identically at any
    // quality.
    const lossy = await convertType(
      bufferGIF,
      "jpeg",
      '{"jpeg":{"quality":1}}',
      false
    );
    const lossless = await convertType(
      bufferGIF,
      "jpeg",
      '{"jpeg":{"quality":100}}',
      false
    );

    expect(await mimeOf(lossy)).toBe("image/jpeg");
    expect(lossy.byteLength).toBeLessThan(lossless.byteLength);
  });

  it("ignores unparseable output options instead of throwing", async () => {
    const buffer = await convertType(bufferGIF, "jpeg", "not json", false);
    expect(await mimeOf(buffer)).toBe("image/jpeg");
    // Falls back to sharp's defaults rather than the quality:1 above.
    expect(buffer.byteLength).toBeGreaterThan(
      (await convertType(bufferGIF, "jpeg", '{"jpeg":{"quality":1}}', false))
        .byteLength
    );
  });
});
