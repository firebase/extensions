import * as functionsTestInit from "firebase-functions-test";

export const mockGenerateResizedImage = () => {
  let functionsTest = functionsTestInit();
  return functionsTest.wrap(
    require("../../functions/src").generateResizedImage
  );
};
