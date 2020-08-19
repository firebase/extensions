import * as path from "path";

export const extractFileNameWithoutExtension = (
  filePath: string,
  ext: string
) => {
  return path.basename(filePath, ext);
};

export const startsWithArray = (arraySearch: string[], text: string) => {
  for (let search of arraySearch) {
    if (text.startsWith(search)) {
      return true;
    }
  }
  return false;
};
