// import { getModifiedFilePath } from "../../src/resize-image";
import * as path from "path";
import { config } from "dotenv";

const envLocalPath = path.resolve(
  __dirname,
  "../../../../_emulator/extensions/storage-resize-images.env.local"
);

config({ path: envLocalPath, debug: true, override: true });

import { getModifiedFilePath } from "../../src/resize-image";
import { platform } from "os";

const convertToPosixPath = (filePath: string, locale?: "win32" | "posix") => {
  const sep = locale ? path[locale].sep : path.sep;
  return filePath.split(sep).join(path.posix.sep);
};

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
