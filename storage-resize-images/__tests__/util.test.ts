import { extractFileNameWithoutExtension, startsWithArray } from "../functions/src/util";
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

describe("startsWithArray", () => {
  const absolutePathList = [
    "/users",
    "/posts/pictures",
    "/design/resources/images",
  ];
  const filePathDirnamePost = "/posts/pictures";
  const filePathDirnameUser = "/users/avatars";
  const filePathDirnameIcon = "/icons";

  describe("when file path dirname is included in the absolute paths at same level", () => {
    it("check the file path dirname agains absolute path list", () => {
      const result = startsWithArray(absolutePathList, filePathDirnamePost);
      expect(result).toBeTruthy();
    });
  });

  describe("when file path dirname is included in the absolute paths not at same level", () => {
    it("check the file path dirname agains absolute path list", () => {
      const result = startsWithArray(absolutePathList, filePathDirnameUser);
      expect(result).toBeTruthy();
    });
  });

  describe("when file path dirname is not included in the absolute paths", () => {
    it("check the file path dirname agains absolute path list", () => {
      const result = startsWithArray(absolutePathList, filePathDirnameIcon);
      expect(result).toBeFalsy();
    });
  });
});
