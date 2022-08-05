import * as functionsTestInit from "firebase-functions-test";

export const testTranslations = {
  de: "hallo",
  en: "hello",
  es: "hola",
  fr: "salut",
};

export const mockTranslate = () => {
  let functionsTest = functionsTestInit();
  return functionsTest.wrap(require("../../src").fstranslate);
};

// await translate.translate('hello', 'de');
export const mockTranslateClassMethod = jest
  .fn()
  .mockImplementation((string: string, targetLanguage: string) => {
    return Promise.resolve([testTranslations[targetLanguage]]);
  });

// new Translate(opts);
export const mockTranslateClass = jest.fn().mockImplementation(() => {
  return { translate: mockTranslateClassMethod };
});

// import { Translate } from "@google-cloud/translate";
export function mockTranslateModuleFactory() {
  return {
    Translate: mockTranslateClass,
  };
}
