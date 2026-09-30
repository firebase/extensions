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

import * as path from "path";
import { config } from "dotenv";

const envLocalPath = path.resolve(
  __dirname,
  "../../../../_emulator/extensions/storage-resize-images.env.local"
);

config({ path: envLocalPath, debug: true, override: true });

import { getModifiedFilePath } from "../../src/resize-image";

const oldGetModifiedFilePath = (
  fileDir,
  resizedImagesPath,
  modifiedFileName
) => {
  return path.posix.normalize(
    resizedImagesPath
      ? path.posix.join(fileDir, resizedImagesPath, modifiedFileName)
      : path.posix.join(fileDir, modifiedFileName)
  );
};

jest.mock("path", () => ({
  ...jest.requireActual("path"),
  sep: "\\",
}));

describe("getModifiedFilePath", () => {
  test("windows path handling", async () => {
    const parsedPath = {
      ext: ".jpg",
      dir: "C:\\Users\\user\\Desktop\\storage-resize-images\\functions\\__tests__\\unit",
      name: "test",
    };
    const {
      ext: fileExtension,
      dir: fileDir,
      name: fileNameWithoutExtension,
    } = parsedPath;
    const modifiedExtensionName = fileExtension;
    const modifiedFileName = `${fileNameWithoutExtension}_${"200x200"}${modifiedExtensionName}`;
    const resizedImagesPath = "thumbnails";
    const mfp = getModifiedFilePath(
      fileDir,
      resizedImagesPath,
      modifiedFileName
    );
    expect(mfp).toBe(
      "C:/Users/user/Desktop/storage-resize-images/functions/__tests__/unit/thumbnails/test_200x200.jpg"
    );
  });

  test("expect old logic to fail", async () => {
    const parsedPath = {
      ext: ".jpg",
      dir: "C:\\Users\\user\\Desktop\\storage-resize-images\\functions\\__tests__\\unit",
      name: "test",
    };
    const {
      ext: fileExtension,
      dir: fileDir,
      name: fileNameWithoutExtension,
    } = parsedPath;
    const modifiedExtensionName = fileExtension;
    const modifiedFileName = `${fileNameWithoutExtension}_${"200x200"}${modifiedExtensionName}`;
    const resizedImagesPath = "thumbnails";
    const mfp = oldGetModifiedFilePath(
      fileDir,
      resizedImagesPath,
      modifiedFileName
    );
    expect(mfp).not.toBe(
      "C:/Users/user/Desktop/storage-resize-images/functions/__tests__/unit/thumbnails/test_200x200.jpg"
    );
  });
});
