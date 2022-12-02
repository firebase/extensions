import { startsWithArray } from "../src/util";

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
});
