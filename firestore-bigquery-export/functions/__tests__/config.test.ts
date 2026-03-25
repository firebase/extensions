import { readFileSync } from "fs";

import { resolve as pathResolve } from "path";

import * as yaml from "js-yaml";
import mockedEnv from "mocked-env";

import { buildPartitioningConfig, clustering } from "../src/config";

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

  describe("buildPartitioningConfig", () => {
    describe("no partitioning (TABLE_PARTITIONING is null)", () => {
      test.each([
        {
          description: "all undefined",
          field: undefined,
          fieldType: undefined,
          firestoreField: undefined,
        },
        {
          description: "all empty strings",
          field: "",
          fieldType: "",
          firestoreField: "",
        },
        {
          description: "all whitespace-only",
          field: "  ",
          fieldType: "  ",
          firestoreField: "  ",
        },
        {
          description: "field and firestoreField are NONE, fieldType is omit",
          field: "NONE",
          fieldType: "omit",
          firestoreField: "NONE",
        },
        {
          description: "all omit",
          field: "omit",
          fieldType: "omit",
          firestoreField: "omit",
        },
      ])(
        "returns NONE when $description",
        ({ field, fieldType, firestoreField }) => {
          expect(
            buildPartitioningConfig({
              timePartitioning: null,
              timePartitioningField: field,
              timePartitioningFieldType: fieldType,
              timePartitioningFirestoreField: firestoreField,
            })
          ).toEqual({ granularity: "NONE" });
        }
      );

      test("returns NONE with mixed sentinels across fields", () => {
        expect(
          buildPartitioningConfig({
            timePartitioning: null,
            timePartitioningField: "",
            timePartitioningFieldType: "omit",
            timePartitioningFirestoreField: "NONE",
          })
        ).toEqual({ granularity: "NONE" });
      });

      test("throws when real field values are provided without partitioning", () => {
        expect(() =>
          buildPartitioningConfig({
            timePartitioning: null,
            timePartitioningField: "created_at",
            timePartitioningFieldType: "TIMESTAMP",
            timePartitioningFirestoreField: "createdAt",
          })
        ).toThrow(/TABLE_PARTITIONING is NONE/);
      });

      test("throws when only fieldName is provided without partitioning", () => {
        expect(() =>
          buildPartitioningConfig({
            timePartitioning: null,
            timePartitioningField: "my_field",
            timePartitioningFieldType: undefined,
            timePartitioningFirestoreField: undefined,
          })
        ).toThrow(/TABLE_PARTITIONING is NONE/);
      });

      test("throws when only fieldType is a real value without partitioning", () => {
        expect(() =>
          buildPartitioningConfig({
            timePartitioning: null,
            timePartitioningField: undefined,
            timePartitioningFieldType: "TIMESTAMP",
            timePartitioningFirestoreField: undefined,
          })
        ).toThrow(/TABLE_PARTITIONING is NONE/);
      });
    });

    describe("ingestion-time partitioning", () => {
      test.each(["HOUR", "DAY", "MONTH", "YEAR"] as const)(
        "uses ingestion-time with %s granularity",
        (granularity) => {
          expect(
            buildPartitioningConfig({
              timePartitioning: granularity,
              timePartitioningField: undefined,
              timePartitioningFieldType: undefined,
              timePartitioningFirestoreField: undefined,
            })
          ).toEqual({ granularity });
        }
      );

      test("normalizes NONE/omit sentinels in optional fields to ingestion-time", () => {
        expect(
          buildPartitioningConfig({
            timePartitioning: "DAY",
            timePartitioningField: "NONE",
            timePartitioningFieldType: "omit",
            timePartitioningFirestoreField: "NONE",
          })
        ).toEqual({ granularity: "DAY" });
      });

      test("normalizes empty strings in optional fields to ingestion-time", () => {
        expect(
          buildPartitioningConfig({
            timePartitioning: "DAY",
            timePartitioningField: "",
            timePartitioningFieldType: "",
            timePartitioningFirestoreField: "",
          })
        ).toEqual({ granularity: "DAY" });
      });
    });

    describe("timestamp field partitioning", () => {
      test("supports timestamp field with TIMESTAMP type", () => {
        expect(
          buildPartitioningConfig({
            timePartitioning: "DAY",
            timePartitioningField: "timestamp",
            timePartitioningFieldType: "TIMESTAMP",
            timePartitioningFirestoreField: undefined,
          })
        ).toEqual({
          granularity: "DAY",
          bigqueryColumnName: "timestamp",
          bigqueryColumnType: "TIMESTAMP",
        });
      });

      test("supports timestamp field with DATE type", () => {
        expect(
          buildPartitioningConfig({
            timePartitioning: "MONTH",
            timePartitioningField: "timestamp",
            timePartitioningFieldType: "DATE",
            timePartitioningFirestoreField: undefined,
          })
        ).toEqual({
          granularity: "MONTH",
          bigqueryColumnName: "timestamp",
          bigqueryColumnType: "DATE",
        });
      });

      test("supports timestamp field with DATETIME type", () => {
        expect(
          buildPartitioningConfig({
            timePartitioning: "MONTH",
            timePartitioningField: "timestamp",
            timePartitioningFieldType: "DATETIME",
            timePartitioningFirestoreField: undefined,
          })
        ).toEqual({
          granularity: "MONTH",
          bigqueryColumnName: "timestamp",
          bigqueryColumnType: "DATETIME",
        });
      });

      test("supports timestamp field with no field type", () => {
        expect(
          buildPartitioningConfig({
            timePartitioning: "DAY",
            timePartitioningField: "timestamp",
            timePartitioningFieldType: undefined,
            timePartitioningFirestoreField: undefined,
          })
        ).toEqual({
          granularity: "DAY",
          bigqueryColumnName: "timestamp",
        });
      });

      test("treats omit fieldType as no field type for timestamp field", () => {
        expect(
          buildPartitioningConfig({
            timePartitioning: "DAY",
            timePartitioningField: "timestamp",
            timePartitioningFieldType: "omit",
            timePartitioningFirestoreField: undefined,
          })
        ).toEqual({
          granularity: "DAY",
          bigqueryColumnName: "timestamp",
        });
      });

      test("treats NONE fieldType as no field type for timestamp field", () => {
        expect(
          buildPartitioningConfig({
            timePartitioning: "HOUR",
            timePartitioningField: "timestamp",
            timePartitioningFieldType: "NONE",
            timePartitioningFirestoreField: undefined,
          })
        ).toEqual({
          granularity: "HOUR",
          bigqueryColumnName: "timestamp",
        });
      });

      test("supports timestamp field with NONE firestoreField sentinel", () => {
        expect(
          buildPartitioningConfig({
            timePartitioning: "DAY",
            timePartitioningField: "timestamp",
            timePartitioningFieldType: "TIMESTAMP",
            timePartitioningFirestoreField: "NONE",
          })
        ).toEqual({
          granularity: "DAY",
          bigqueryColumnName: "timestamp",
          bigqueryColumnType: "TIMESTAMP",
        });
      });
    });

    describe("custom field partitioning", () => {
      test("returns custom config with TIMESTAMP type", () => {
        expect(
          buildPartitioningConfig({
            timePartitioning: "HOUR",
            timePartitioningField: "partition_column",
            timePartitioningFieldType: "TIMESTAMP",
            timePartitioningFirestoreField: "time",
          })
        ).toEqual({
          granularity: "HOUR",
          bigqueryColumnName: "partition_column",
          bigqueryColumnType: "TIMESTAMP",
          firestoreFieldName: "time",
        });
      });

      test("returns custom config with DATE type", () => {
        expect(
          buildPartitioningConfig({
            timePartitioning: "DAY",
            timePartitioningField: "date_col",
            timePartitioningFieldType: "DATE",
            timePartitioningFirestoreField: "eventDate",
          })
        ).toEqual({
          granularity: "DAY",
          bigqueryColumnName: "date_col",
          bigqueryColumnType: "DATE",
          firestoreFieldName: "eventDate",
        });
      });

      test("returns custom config with DATETIME type", () => {
        expect(
          buildPartitioningConfig({
            timePartitioning: "MONTH",
            timePartitioningField: "dt_col",
            timePartitioningFieldType: "DATETIME",
            timePartitioningFirestoreField: "createdAt",
          })
        ).toEqual({
          granularity: "MONTH",
          bigqueryColumnName: "dt_col",
          bigqueryColumnType: "DATETIME",
          firestoreFieldName: "createdAt",
        });
      });

      test("trims whitespace from field values", () => {
        expect(
          buildPartitioningConfig({
            timePartitioning: "DAY",
            timePartitioningField: "  partition_column  ",
            timePartitioningFieldType: "  TIMESTAMP  ",
            timePartitioningFirestoreField: "  time  ",
          })
        ).toEqual({
          granularity: "DAY",
          bigqueryColumnName: "partition_column",
          bigqueryColumnType: "TIMESTAMP",
          firestoreFieldName: "time",
        });
      });
    });

    describe("error cases", () => {
      test("throws when only fieldName is provided with partitioning enabled", () => {
        expect(() =>
          buildPartitioningConfig({
            timePartitioning: "HOUR",
            timePartitioningField: "partition_column",
            timePartitioningFieldType: undefined,
            timePartitioningFirestoreField: undefined,
          })
        ).toThrow(/Invalid partitioning configuration/);
      });

      test("throws when fieldName and fieldType are provided but firestoreField is missing", () => {
        expect(() =>
          buildPartitioningConfig({
            timePartitioning: "HOUR",
            timePartitioningField: "partition_column",
            timePartitioningFieldType: "TIMESTAMP",
            timePartitioningFirestoreField: undefined,
          })
        ).toThrow(/Invalid partitioning configuration/);
      });

      test("throws when only firestoreField is provided", () => {
        expect(() =>
          buildPartitioningConfig({
            timePartitioning: "HOUR",
            timePartitioningField: undefined,
            timePartitioningFieldType: undefined,
            timePartitioningFirestoreField: "time",
          })
        ).toThrow(/Invalid partitioning configuration/);
      });

      test("throws when fieldType and firestoreField are provided but fieldName is missing", () => {
        expect(() =>
          buildPartitioningConfig({
            timePartitioning: "HOUR",
            timePartitioningField: undefined,
            timePartitioningFieldType: "TIMESTAMP",
            timePartitioningFirestoreField: "time",
          })
        ).toThrow(/Valid combinations are/);
      });

      test("throws when fieldType is omit sentinel with real fieldName", () => {
        expect(() =>
          buildPartitioningConfig({
            timePartitioning: "HOUR",
            timePartitioningField: "partition_column",
            timePartitioningFieldType: "omit",
            timePartitioningFirestoreField: undefined,
          })
        ).toThrow(/Invalid partitioning configuration/);
      });

      test("throws with invalid fieldType string for custom config", () => {
        expect(() =>
          buildPartitioningConfig({
            timePartitioning: "DAY",
            timePartitioningField: "partition_column",
            timePartitioningFieldType: "INTEGER",
            timePartitioningFirestoreField: "createdAt",
          })
        ).toThrow(/Invalid partitioning configuration/);
      });

      test("error message includes received parameter values", () => {
        expect(() =>
          buildPartitioningConfig({
            timePartitioning: "HOUR",
            timePartitioningField: "my_field",
            timePartitioningFieldType: undefined,
            timePartitioningFirestoreField: undefined,
          })
        ).toThrow(/Received TABLE_PARTITIONING/);
      });

      test("error message lists valid combinations", () => {
        expect(() =>
          buildPartitioningConfig({
            timePartitioning: "HOUR",
            timePartitioningField: "my_field",
            timePartitioningFieldType: undefined,
            timePartitioningFirestoreField: undefined,
          })
        ).toThrow(/Valid combinations are/);
      });
    });
  });
});
