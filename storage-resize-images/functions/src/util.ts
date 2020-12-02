import * as path from "path";

export const extractFileNameWithoutExtension = (
  filePath: string,
  ext: string
) => {
  return path.basename(filePath, ext);
};

export const startsWithArray = (
  userInputPaths: string[],
  imagePath: string
) => {
  for (let userPath of userInputPaths) {
    const trimmedUserPath = userPath.trim();
    const regex = new RegExp("^" + trimmedUserPath + "(?:/.*|$)");

    if (regex.test(imagePath)) {
      return true;
    }
  }
  return false;
};
