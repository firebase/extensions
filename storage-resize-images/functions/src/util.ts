import * as path from "path";

export const extractFileNameWithoutExtension = (
  filePath: string,
  ext: string
) => {
  return path.basename(filePath, ext);
};

const userPathRegex = (userPath) => {
  const trimmedUserPath = userPath.trim();
  return new RegExp("^" + trimmedUserPath + "(?:/.*|$)");
};

export const startsWithArray = (
  userInputPaths: string[],
  imagePath: string
) => {
  for (let userPath of userInputPaths) {
    if (userPathRegex(userPath).test(imagePath)) {
      return true;
    }
  }
  return false;
};

export const findSizes = (
  userInputPaths: { path: string; sizes: string[] }[],
  imagePath: string,
  defaultSizes
): string[] => {
  const pathConfiguration = userInputPaths.find((it) => {
    return userPathRegex(it.path).test(imagePath);
  });

  if (pathConfiguration.sizes && pathConfiguration.sizes.length > 0) {
    return pathConfiguration.sizes;
  }

  return defaultSizes;
};
