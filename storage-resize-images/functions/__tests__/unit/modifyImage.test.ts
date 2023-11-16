// import { getModifiedFilePath } from "../../src/resize-image";
import * as path from "path";

const convertToPosixPath = (filePath: string, locale?: "win32" | "posix") => {
  const sep = locale ? path[locale].sep : path.sep;
  return filePath.split(sep).join(path.posix.sep);
};
const getModifiedFilePath = (fileDir, resizedImagesPath, modifiedFileName) => {
  return convertToPosixPath(
    path.posix.normalize(
      resizedImagesPath
        ? path.posix.join(fileDir, resizedImagesPath, modifiedFileName)
        : path.posix.join(fileDir, modifiedFileName)
    ),
    "win32"
  );
};

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
    console.log(mfp);
  });
});
