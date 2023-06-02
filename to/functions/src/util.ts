export const startsWithArray = (
  userInputPaths: string[],
  imagePath: string
) => {
  for (let userPath of userInputPaths) {
    const trimmedUserPath = userPath
      .trim()
      .replace(/\*/g, "([a-zA-Z0-9_\\-.\\s\\/]*)?");

    const regex = new RegExp("^" + trimmedUserPath + "(?:/.*|$)");

    if (regex.test(imagePath)) {
      return true;
    }
  }
  return false;
};
