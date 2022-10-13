"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const functionsTestInit = require("firebase-functions-test");
const yaml = require("js-yaml");
const mocked_env_1 = require("mocked-env");
const messages_1 = require("../src/logs/messages");
let restoreEnv;
let extensionYaml;
let extensionParams;
const environment = {
    LOCATION: "us-central1",
    LANGUAGES: "en,es,de,fr,en",
    COLLECTION_PATH: "translations",
    INPUT_FIELD_NAME: "input",
    OUTPUT_FIELD_NAME: "translated",
};
const { config } = global;
functionsTestInit();
describe("extension config", () => {
    let logMock;
    beforeAll(() => {
        extensionYaml = yaml.safeLoad((0, fs_1.readFileSync)((0, path_1.resolve)(__dirname, "../../extension.yaml"), "utf8"));
        extensionParams = extensionYaml.params.reduce((obj, param) => {
            obj[param.param] = param;
            return obj;
        }, {});
    });
    beforeEach(() => {
        restoreEnv = (0, mocked_env_1.default)(environment);
        logMock = jest.fn();
        require("firebase-functions").logger = {
            log: logMock,
        };
    });
    afterEach(() => restoreEnv());
    test("config loaded from environment variables", () => {
        const functionsConfig = config();
        expect(functionsConfig).toMatchSnapshot({});
    });
    test("config is logged on initialize", () => {
        jest.requireActual("../src");
        const functionsConfig = config();
        expect(logMock).toBeCalledWith(...messages_1.messages.init(functionsConfig));
    });
    // LANGUAGES
    describe("config.LANGUAGES", () => {
        test("param exists", () => {
            const extensionParam = extensionParams["LANGUAGES"];
            expect(extensionParam).toMatchSnapshot();
        });
        test("removes any duplicated languages from user input", () => {
            const functionsConfig = require("../src/config").default;
            expect(functionsConfig.languages).toEqual(["en", "es", "de", "fr"]);
        });
        describe("validationRegex", () => {
            test("does not allow empty strings", () => {
                const { validationRegex } = extensionParams["LANGUAGES"];
                expect(Boolean("".match(new RegExp(validationRegex)))).toBeFalsy();
            });
            test("does not allow trailing delimiter", () => {
                const { validationRegex } = extensionParams["LANGUAGES"];
                expect(Boolean("en,".match(new RegExp(validationRegex)))).toBeFalsy();
            });
            // https://github.com/firebase/extensions/issues/43
            test("allows a single language", () => {
                const { validationRegex } = extensionParams["LANGUAGES"];
                expect(Boolean("en".match(new RegExp(validationRegex)))).toBeTruthy();
            });
            test("allows multiple languages", () => {
                const { validationRegex } = extensionParams["LANGUAGES"];
                expect(Boolean("en,fr".match(new RegExp(validationRegex)))).toBeTruthy();
                expect(Boolean("en,fr,de,es".match(new RegExp(validationRegex)))).toBeTruthy();
            });
        });
    });
});
