import { extractFileNameWithoutExtension } from "../functions/src/util";
describe("extractFileNameWithoutExtension", () => {
  const filePathWithExtension = "/ref/to/my/image.png";
  const filePathWithoutExtension = "/ref/to/my/image";
  const ext = ".png";

  describe("when file path includes file extension", () => {
    it("extracts the basename without extension", () => {
      const fileNameWithoutExtension = extractFileNameWithoutExtension(
        filePathWithExtension,
        ext
      );
      expect(fileNameWithoutExtension).toBe("image");
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
});
