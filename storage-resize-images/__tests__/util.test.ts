import {
  extractFileNameWithoutExtension,
  startsWithArray,
} from "../functions/src/util";

describe("extractFileNameWithoutExtension", () => {
  const filePathWithExtension = "/ref/to/my/image.png";
  const filePathWithoutExtension = "/ref/to/my/image";
  const ext = ".png";

  describe("when file path includes file extension", () => {
    it("extracts the basename without extension", () => {
      const fileNameWithExtension = extractFileNameWithoutExtension(
        filePathWithExtension,
        ext
      );
      expect(fileNameWithExtension).toBe("image");
    });
  });

  describe("when file path does not include file extension", () => {
    it("extracts the basename without extension", () => {
      const fileNameWithoutExtension = extractFileNameWithoutExtension(
        filePathWithoutExtension,
        ext
      );
      expect(fileNameWithoutExtension).toBe("image");
    });
  });

  const imagePath = ["/test/picture"];

  describe("startsWithArray function for testing image path", () => {
    it("allowed paths", () => {
      const allowed = ["/test/picture", "/test/picture/directory"];

      allowed.forEach((path) => {
        let allowResize = startsWithArray(imagePath, path);
        expect(allowResize).toBe(true);
      });
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
});
