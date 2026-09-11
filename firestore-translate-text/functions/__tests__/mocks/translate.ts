/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
