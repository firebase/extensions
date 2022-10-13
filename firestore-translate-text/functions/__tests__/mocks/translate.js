"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockTranslateModuleFactory = exports.mockTranslateClass = exports.mockTranslateClassMethod = exports.mockTranslate = exports.testTranslations = void 0;
const functionsTestInit = require("firebase-functions-test");
exports.testTranslations = {
    de: "hallo",
    en: "hello",
    es: "hola",
    fr: "salut",
};
const mockTranslate = () => {
    let functionsTest = functionsTestInit();
    return functionsTest.wrap(require("../../src").fstranslate);
};
exports.mockTranslate = mockTranslate;
// await translate.translate('hello', 'de');
exports.mockTranslateClassMethod = jest
    .fn()
    .mockImplementation((string, targetLanguage) => {
    return Promise.resolve([exports.testTranslations[targetLanguage]]);
});
// new Translate(opts);
exports.mockTranslateClass = jest.fn().mockImplementation(() => {
    return { translate: exports.mockTranslateClassMethod };
});
// import { Translate } from "@google-cloud/translate";
function mockTranslateModuleFactory() {
    return {
        Translate: exports.mockTranslateClass,
    };
}
exports.mockTranslateModuleFactory = mockTranslateModuleFactory;
