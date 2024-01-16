import { FirestoreField } from "../../../schema";
import { processLeafField } from "../../../schema/processLeafField";

describe("processLeafField", () => {
  describe("prefix", () => {
    describe("should process leaf fields with a prefix", () => {
      /** Set system vars */
      process.env.PROJECT_ID = "test_project_id";

      const datasetId = "test_dataset";
      const dataFieldName = "dataFieldName";
      const prefix = ["prefix"];
      const transformer = (selector: string) => selector;
      const bigQueryFields: { [property: string]: string }[] = [];
      const extractPrefix: string[] = [];

      afterEach(() => {
        bigQueryFields.length = 0;
      });

      test("Should process 'null' type", () => {
        const field = { name: "testField", type: "null" } as FirestoreField;
        const result = processLeafField(
          datasetId,
          dataFieldName,
          prefix,
          field,
          transformer,
          bigQueryFields,
          extractPrefix
        );

        expect(result).toEqual({
          prefix_testField: "NULL AS prefix_testField",
        });
        expect(bigQueryFields).toEqual([
          {
            name: "prefix_testField",
            mode: "NULLABLE",
            type: "STRING",
            description: undefined,
          },
        ]);
      });

      test("Should process 'string' type", () => {
        const field = {
          name: "stringField",
          type: "string",
          description: "A string field",
          extractor: "stringField",
        } as FirestoreField;
        const result = processLeafField(
          datasetId,
          dataFieldName,
          prefix,
          field,
          transformer,
          bigQueryFields,
          extractPrefix
        );

        expect(result).toEqual({
          prefix_stringField:
            "JSON_EXTRACT_SCALAR(dataFieldName, '$.stringField') AS prefix_stringField",
        });
        expect(bigQueryFields).toEqual([
          {
            name: "prefix_stringField",
            mode: "NULLABLE",
            type: "STRING",
            description: "A string field",
          },
        ]);
      });

      test("Should process 'number' type", () => {
        const field = {
          name: "numberField",
          type: "number",
          description: "A number field",
          extractor: "numberField",
        } as FirestoreField;
        const result = processLeafField(
          datasetId,
          dataFieldName,
          prefix,
          field,
          transformer,
          bigQueryFields,
          extractPrefix
        );

        expect(result).toEqual({
          prefix_numberField:
            "`test_project_id.test_dataset.firestoreNumber`(JSON_EXTRACT_SCALAR(dataFieldName, '$.numberField')) AS prefix_numberField",
        });

        expect(bigQueryFields).toEqual([
          {
            name: "prefix_numberField",
            mode: "NULLABLE",
            type: "NUMERIC",
            description: "A number field",
          },
        ]);
      });
    });

    describe("should process leaf fields without a prefix", () => {
      /** Set system vars */
      process.env.PROJECT_ID = "test_project_id";

      const datasetId = "test_dataset";
      const dataFieldName = "dataFieldName";
      const prefix = [];
      const transformer = (selector: string) => selector;
      const bigQueryFields: { [property: string]: string }[] = [];
      const extractPrefix: string[] = [];

      afterEach(() => {
        bigQueryFields.length = 0;
      });

      test("Should process 'null' type", () => {
        const field = { name: "testField", type: "null" } as FirestoreField;
        const result = processLeafField(
          datasetId,
          dataFieldName,
          prefix,
          field,
          transformer,
          bigQueryFields,
          extractPrefix
        );

        expect(result).toEqual({
          testField: "NULL AS testField",
        });
        expect(bigQueryFields).toEqual([
          {
            name: "testField",
            mode: "NULLABLE",
            type: "STRING",
            description: undefined,
          },
        ]);
      });

      test("Should process 'string' type", () => {
        const field = {
          name: "stringField",
          type: "string",
          description: "A string field",
          extractor: "stringField",
        } as FirestoreField;
        const result = processLeafField(
          datasetId,
          dataFieldName,
          prefix,
          field,
          transformer,
          bigQueryFields,
          extractPrefix
        );

        expect(result).toEqual({
          stringField:
            "JSON_EXTRACT_SCALAR(dataFieldName, '$.stringField') AS stringField",
        });
        expect(bigQueryFields).toEqual([
          {
            name: "stringField",
            mode: "NULLABLE",
            type: "STRING",
            description: "A string field",
          },
        ]);
      });

      test("Should process 'number' type", () => {
        const field = {
          name: "numberField",
          type: "number",
          description: "A number field",
          extractor: "numberField",
        } as FirestoreField;
        const result = processLeafField(
          datasetId,
          dataFieldName,
          prefix,
          field,
          transformer,
          bigQueryFields,
          extractPrefix
        );

        expect(result).toEqual({
          numberField:
            "`test_project_id.test_dataset.firestoreNumber`(JSON_EXTRACT_SCALAR(dataFieldName, '$.numberField')) AS numberField",
        });

        expect(bigQueryFields).toEqual([
          {
            name: "numberField",
            mode: "NULLABLE",
            type: "NUMERIC",
            description: "A number field",
          },
        ]);
      });
    });
  });

  describe("extractor", () => {
    describe("should process leaf fields with an extractor", () => {
      /** Set system vars */
      process.env.PROJECT_ID = "test_project_id";

      const datasetId = "test_dataset";
      const dataFieldName = "dataFieldName";
      const prefix = [];
      const transformer = (selector: string) => selector;
      const bigQueryFields: { [property: string]: string }[] = [];
      const extractPrefix: string[] = [];

      afterEach(() => {
        bigQueryFields.length = 0;
      });

      test("Should process 'null' type", () => {
        const field = { name: "testField", type: "null" } as FirestoreField;
        const result = processLeafField(
          datasetId,
          dataFieldName,
          prefix,
          field,
          transformer,
          bigQueryFields,
          extractPrefix
        );

        expect(result).toEqual({
          testField: "NULL AS testField",
        });
        expect(bigQueryFields).toEqual([
          {
            name: "testField",
            mode: "NULLABLE",
            type: "STRING",
            description: undefined,
          },
        ]);
      });

      test("Should process 'string' type", () => {
        const field = {
          name: "stringField",
          type: "string",
          description: "A string field",
          extractor: "stringField",
        } as FirestoreField;
        const result = processLeafField(
          datasetId,
          dataFieldName,
          prefix,
          field,
          transformer,
          bigQueryFields,
          extractPrefix
        );

        expect(result).toEqual({
          stringField:
            "JSON_EXTRACT_SCALAR(dataFieldName, '$.stringField') AS stringField",
        });
        expect(bigQueryFields).toEqual([
          {
            name: "stringField",
            mode: "NULLABLE",
            type: "STRING",
            description: "A string field",
          },
        ]);
      });

      test("Should process 'number' type", () => {
        const field = {
          name: "numberField",
          type: "number",
          description: "A number field",
          extractor: "numberField",
        } as FirestoreField;
        const result = processLeafField(
          datasetId,
          dataFieldName,
          prefix,
          field,
          transformer,
          bigQueryFields,
          extractPrefix
        );

        expect(result).toEqual({
          numberField:
            "`test_project_id.test_dataset.firestoreNumber`(JSON_EXTRACT_SCALAR(dataFieldName, '$.numberField')) AS numberField",
        });

        expect(bigQueryFields).toEqual([
          {
            name: "numberField",
            mode: "NULLABLE",
            type: "NUMERIC",
            description: "A number field",
          },
        ]);
      });

      test("Should process 'boolean' type", () => {
        const field = {
          name: "booleanField",
          type: "boolean",
          description: "A boolean field",
          extractor: "booleanField",
        } as FirestoreField;
        const result = processLeafField(
          datasetId,
          dataFieldName,
          prefix,
          field,
          transformer,
          bigQueryFields,
          extractPrefix
        );

        expect(result).toEqual({
          booleanField:
            "`test_project_id.test_dataset.firestoreBoolean`(JSON_EXTRACT_SCALAR(dataFieldName, '$.booleanField')) AS booleanField",
        });

        expect(bigQueryFields).toEqual([
          {
            name: "booleanField",
            mode: "NULLABLE",
            type: "BOOLEAN",
            description: "A boolean field",
          },
        ]);
      });

      test("Should process 'timestamp' type", () => {
        const field = {
          name: "timestampField",
          type: "timestamp",
          description: "A timestamp field",
          extractor: "timestampField",
        } as FirestoreField;
        const result = processLeafField(
          datasetId,
          dataFieldName,
          prefix,
          field,
          (selector: string) => selector,
          bigQueryFields,
          extractPrefix
        );

        expect(result).toEqual({
          timestampField:
            "`test_project_id.test_dataset.firestoreTimestamp`(JSON_EXTRACT(dataFieldName, '$.timestampField')) AS timestampField",
        });

        expect(bigQueryFields).toEqual([
          {
            name: "timestampField",
            mode: "NULLABLE",
            type: "TIMESTAMP",
            description: "A timestamp field",
          },
        ]);
      });

      test("Should process 'geopoint' type", () => {
        const field = {
          name: "geopointField",
          type: "geopoint",
          description: "A geopoint field",
          extractor: "geopointField",
        } as FirestoreField;
        const result = processLeafField(
          datasetId,
          dataFieldName,
          prefix,
          field,
          (selector: string) => selector,
          bigQueryFields,
          extractPrefix
        );

        expect(result).toEqual({
          geopointField:
            "`test_project_id.test_dataset.firestoreGeopoint`(JSON_EXTRACT(dataFieldName, '$.geopointField')) AS geopointField",
          geopointField_latitude:
            "SAFE_CAST(JSON_EXTRACT_SCALAR(dataFieldName, '$.geopointField._latitude') AS NUMERIC) AS geopointField_latitude",
          geopointField_longitude:
            "SAFE_CAST(JSON_EXTRACT_SCALAR(dataFieldName, '$.geopointField._longitude') AS NUMERIC) AS geopointField_longitude",
        });

        expect(bigQueryFields).toEqual([
          {
            name: "geopointField",
            mode: "NULLABLE",
            type: "GEOGRAPHY",
            description: "A geopoint field",
          },
          {
            name: "geopointField_latitude",
            mode: "NULLABLE",
            type: "NUMERIC",
            description: "Numeric latitude component of geopointField.",
          },
          {
            name: "geopointField_longitude",
            mode: "NULLABLE",
            type: "NUMERIC",
            description: "Numeric longitude component of geopointField.",
          },
        ]);
      });

      test("Should process 'array' type", () => {
        const field = {
          name: "arrayField",
          type: "array",
          description: "An array field",
          extractor: "arrayField",
        } as FirestoreField;
        const result = processLeafField(
          datasetId,
          dataFieldName,
          prefix,
          field,
          (selector: string) => selector,
          bigQueryFields,
          extractPrefix
        );

        expect(result).toEqual({
          arrayField:
            "`test_project_id.test_dataset.firestoreArray`(JSON_EXTRACT(dataFieldName, '$.arrayField')) AS arrayField",
        });

        expect(bigQueryFields).toEqual([
          {
            name: "arrayField",
            mode: "REPEATED",
            type: "STRING",
            description: "An array field",
          },
        ]);
      });

      test("Should process 'geopoint' type", () => {
        const field = {
          name: "geopointField",
          type: "geopoint",
          description: "A geopoint field",
          extractor: "geopointField",
        } as FirestoreField;
        const result = processLeafField(
          datasetId,
          dataFieldName,
          prefix,
          field,
          (selector: string) => selector,
          bigQueryFields,
          extractPrefix
        );

        expect(result).toEqual({
          geopointField:
            "`test_project_id.test_dataset.firestoreGeopoint`(JSON_EXTRACT(dataFieldName, '$.geopointField')) AS geopointField",
          geopointField_latitude:
            "SAFE_CAST(JSON_EXTRACT_SCALAR(dataFieldName, '$.geopointField._latitude') AS NUMERIC) AS geopointField_latitude",
          geopointField_longitude:
            "SAFE_CAST(JSON_EXTRACT_SCALAR(dataFieldName, '$.geopointField._longitude') AS NUMERIC) AS geopointField_longitude",
        });

        expect(bigQueryFields).toEqual([
          {
            name: "geopointField",
            mode: "NULLABLE",
            type: "GEOGRAPHY",
            description: "A geopoint field",
          },
          {
            name: "geopointField_latitude",
            mode: "NULLABLE",
            type: "NUMERIC",
            description: "Numeric latitude component of geopointField.",
          },
          {
            name: "geopointField_longitude",
            mode: "NULLABLE",
            type: "NUMERIC",
            description: "Numeric longitude component of geopointField.",
          },
        ]);
      });
    });
  });
});
