import { startsWithArray, convertPathToPosix } from "../src/util";

const imagePath = ["/test/picture"];

describe("startsWithArray function for testing image path", () => {
  it("allowed paths", () => {
    const allowed = ["/test/picture", "/test/picture/directory"];

    allowed.forEach((path) => {
      let allowResize = startsWithArray(imagePath, path);
      expect(allowResize).toBe(true);
    });
  });

  it("blocked paths", () => {
    const notAllowed = [
      "/test",
      "/test/pict",
      "/test/pictures",
      "/test/picturesssssss",
    ];

    notAllowed.forEach((path) => {
      let allowResize = startsWithArray(imagePath, path);
      expect(allowResize).toBe(false);
    });
  });

  it("can handle allowed globbed paths", () => {
    const imagePaths = ["/test/picture", "/test/*/picture"];
    const allowed = [
      "/test/picture",
      "/test/something/picture",
      "/test/folder1/folder2/picture",
    ];

    allowed.forEach((path) => {
      let allowResize = startsWithArray(imagePaths, path);
      expect(allowResize).toBe(true);
    });
  });

  it("can handle not allowed globbed paths", () => {
    const imagePaths = ["/test/picture", "/test/*/picture"];
    const notAllowed = ["/test/*/pictures", "/test/*/folder2/pictures"];

    notAllowed.forEach((path) => {
      let allowResize = startsWithArray(imagePaths, path);
      expect(allowResize).toBe(false);
    });
  });

  it("can handle '+' when replacing '*' in globbed paths", () => {
    const allowed = ["/test/picture", "/test/*/picture"];
    const imagePaths = ["/test/picture", "/test/+/picture"];

    imagePaths.forEach((path) => {
      let allowResize = startsWithArray(allowed, path);
      expect(allowResize).toBe(true);
    });
  });
});

describe("convertPathToPosix function for converting path to posix", () => {
  it("converts windows path to posix without drive", () => {
    const windowsPaths = [
      "C:\\Users\\test\\image.jpg",
      "D:\\Users\\test\\image.jpg",
      "E:\\Users\\test\\image.jpg",
      "Z:\\Users\\test\\image.jpg",
      "C:\\Users\\test:user\\image.jpg",
    ];

    const expectedPosixPaths = [
      "/Users/test/image.jpg",
      "/Users/test/image.jpg",
      "/Users/test/image.jpg",
      "/Users/test/image.jpg",
      "/Users/test:user/image.jpg",
    ];

    windowsPaths.forEach((windowsPath, index) => {
      const outPosixPath = convertPathToPosix(windowsPath, true);
      expect(outPosixPath).toBe(expectedPosixPaths[index]);
    });
  });

  it("converts windows path to posix with drive", () => {
    const windowsPaths = [
      "C:\\Users\\test\\image.jpg",
      "D:\\Users\\test\\image.jpg",
      "E:\\Users\\test\\image.jpg",
      "Z:\\Users\\test\\image.jpg",
      "C:\\Users\\test:user\\image.jpg",
    ];

    const expectedPosixPaths = [
      "C:/Users/test/image.jpg",
      "D:/Users/test/image.jpg",
      "E:/Users/test/image.jpg",
      "Z:/Users/test/image.jpg",
      "C:/Users/test:user/image.jpg",
    ];

    windowsPaths.forEach((windowsPath, index) => {
      const outPosixPath = convertPathToPosix(windowsPath, false);
      expect(outPosixPath).toBe(expectedPosixPaths[index]);
    });
  });

  it("converts posix path to posix (no change)", () => {
    const posixPaths = ["/Users/test/image.jpg", "/Users/test:user/image.jpg"];

    const expectedPosixPaths = [
      "/Users/test/image.jpg",
      "/Users/test:user/image.jpg",
    ];

    posixPaths.forEach((posixPath, index) => {
      const outPosixPath = convertPathToPosix(posixPath);
      expect(outPosixPath).toBe(expectedPosixPaths[index]);
    });
  });
});
