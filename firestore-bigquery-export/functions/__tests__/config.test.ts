import { readFileSync } from "fs";

import { resolve as pathResolve } from "path";

import * as yaml from "js-yaml";
import mockedEnv from "mocked-env";

import { clustering } from "../src/config";

let restoreEnv;
let extensionYaml;
let extensionParams;

const environment = {
  LOCATION: "us-central1",
  DATASET_ID: "my_dataset",
  DATABASE_ID: "(default)",
  TABLE_ID: "my_table",
  TRANSFORM_FUNCTION: "",
  CLUSTERING: "data,timestamp",
  KMS_KEY_NAME: "test",
};

//@ts-ignore
const { config } = global;

describe("extension config", () => {
  beforeAll(() => {
    extensionYaml = yaml.safeLoad(
      readFileSync(pathResolve(__dirname, "../../extension.yaml"), "utf8")
    );

    extensionParams = extensionYaml.params.reduce((obj, param) => {
      obj[param.param] = param;
      return obj;
    }, {});
  });

  beforeEach(() => {
    jest.resetModules();
    restoreEnv = mockedEnv(environment);
  });

  afterEach(() => restoreEnv());

  test("config loaded from environment variables", () => {
    const env = {
      location: environment.LOCATION,
      datasetId: environment.DATASET_ID,
      databaseId: environment.DATABASE_ID,
      tableId: environment.TABLE_ID,
      clustering: clustering(environment.CLUSTERING),
      kmsKeyName: environment.KMS_KEY_NAME,
    };
    expect(config()).toMatchSnapshot(env);
  });

  // DATASET_ID
  describe("config.datasetId", () => {
    test("param exists", () => {
      const extensionParam = extensionParams["DATASET_ID"];
      expect(extensionParam).toMatchSnapshot();
    });

    describe("validationRegex", () => {
      test("does not allow empty strings", () => {
        const { validationRegex } = extensionParams["DATASET_ID"];
        expect(Boolean("".match(new RegExp(validationRegex)))).toBeFalsy();
      });

      test("does not allow spaces", () => {
        const { validationRegex } = extensionParams["DATASET_ID"];
        expect(
          Boolean("foo bar,".match(new RegExp(validationRegex)))
        ).toBeFalsy();
      });

      test("allows a alphanumeric underscore ids", () => {
        const { validationRegex } = extensionParams["DATASET_ID"];
        expect(
          Boolean("my_dataset".match(new RegExp(validationRegex)))
        ).toBeTruthy();
      });
    });
  });

  // TABLE_ID
  describe("config.tableId", () => {
    test("param exists", () => {
      const extensionParam = extensionParams["TABLE_ID"];
      expect(extensionParam).toMatchSnapshot();
    });

    describe("validationRegex", () => {
      test("does not allow empty strings", () => {
        const { validationRegex } = extensionParams["TABLE_ID"];
        expect(Boolean("".match(new RegExp(validationRegex)))).toBeFalsy();
      });
      test("does not allow spaces", () => {
        const { validationRegex } = extensionParams["TABLE_ID"];
        expect(
          Boolean("foo bar,".match(new RegExp(validationRegex)))
        ).toBeFalsy();
      });

      test("allows a alphanumeric underscore ids", () => {
        const { validationRegex } = extensionParams["TABLE_ID"];
        expect(
          Boolean("my_table".match(new RegExp(validationRegex)))
        ).toBeTruthy();
      });
    });
  });

  // CLUSTERING TESTING
  describe("config.clustering", () => {
    test("param exists", () => {
      const extensionParam = extensionParams["CLUSTERING"];
      expect(extensionParam).toMatchSnapshot();
    });

    describe("validationRegex", () => {
      test("does not allow empty strings", () => {
        const { validationRegex } = extensionParams["CLUSTERING"];
        expect(Boolean("".match(new RegExp(validationRegex)))).toBeFalsy();
      });
      test("does not allow spaces", () => {
        const { validationRegex } = extensionParams["CLUSTERING"];
        expect(
          Boolean("foo, bar".match(new RegExp(validationRegex)))
        ).toBeFalsy();
      });

      test("allows a alphanumeric underscore ids", () => {
        const { validationRegex } = extensionParams["CLUSTERING"];
        expect(
          Boolean("event_id,timestamp".match(new RegExp(validationRegex)))
        ).toBeTruthy();
      });

      test("allows max 4 fields", () => {
        const { validationRegex } = extensionParams["CLUSTERING"];
        expect(
          Boolean(
            "document_id,timestamp,event_id,operation,data".match(
              new RegExp(validationRegex)
            )
          )
        ).toBeFalsy();
      });
    });
  });
});
