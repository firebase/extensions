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

import * as fs from "fs";

import mockedEnv from "mocked-env";
import sizeOf from "image-size";
import sharp from "sharp";

const environment = {
  LOCATION: "us-central1",
  IMG_BUCKET: "extensions-testing.appspot.com",
  CACHE_CONTROL_HEADER: undefined,
  IMG_SIZES: "200x200",
  RESIZED_IMAGES_PATH: undefined,
  DELETE_ORIGINAL_FILE: "true",
};

let restoreEnv;
restoreEnv = mockedEnv(environment);

import { resize } from "../src/resize-image";

import {
  supportedContentTypes,
  supportedImageContentTypeMap,
} from "../src/global";

import * as path from "path";

const TEST_IMAGE = path.join(__dirname, "test-image.png");

describe("extension", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => restoreEnv());

  test("throw error if the wrong delimiter is used for resize string", async () => {
    const filePath = "/file/path";
    const errorMessage = "height and width are not delimited by a ',' or a 'x'";

    try {
      resize(filePath, "200200");
    } catch (e) {
      expect(e.message).toContain(errorMessage);
    }

    try {
      resize(filePath, "200 200");
    } catch (e) {
      expect(e.message).toContain(errorMessage);
    }
  });

  test("resize image correctly", async () => {
    const temporaryPath = `${__dirname}/temp-image.png`;
    const size = "75x75";

    const modifiedImageBuffer = await resize(TEST_IMAGE, size);

    await sharp(modifiedImageBuffer).toFile(temporaryPath);

    var dimensions = sizeOf(temporaryPath);

    expect(dimensions.width).toEqual(75);
    expect(dimensions.height).toEqual(75);

    fs.unlink(temporaryPath, (err) => {
      if (err) throw new Error(err.message);
    });
  });

  test("image types supported", async () => {
    expect(supportedContentTypes).toEqual(
      expect.arrayContaining([
        "image/jpeg",
        "image/png",
        "image/tiff",
        "image/webp",
      ])
    );
    expect(supportedImageContentTypeMap).toMatchObject({
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      tiff: "image/tiff",
      webp: "image/webp",
    });
  });
});
