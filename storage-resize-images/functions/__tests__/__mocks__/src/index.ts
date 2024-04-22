import * as functionsTestInit from "firebase-functions-test";
import { generateResizedImage as originalGenerateResizedImage } from "../../../src";

export const generateResizedImage = () => {
  let functionsTest = functionsTestInit();
  return functionsTest.wrap(originalGenerateResizedImage);
};
