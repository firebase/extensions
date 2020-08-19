import * as path from "path";

export const extractFileNameWithoutExtension = (
  filePath: string,
  ext: string
) => {
  return path.basename(filePath, ext);
};
