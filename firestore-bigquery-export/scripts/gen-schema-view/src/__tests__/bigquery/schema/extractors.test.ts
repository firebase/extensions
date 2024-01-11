import { jsonExtractScalar, jsonExtract } from "../../../schema/extractors";
import { FirestoreField } from "../../../schema";

describe("extractors", () => {
  describe("jsonExtractScalar", () => {
    test("Should extract usng minimal jsonExtractScalar", () => {
      /** Set data */
      const dataFieldName = "dataFieldName";
      const prefix = "";
      const field = { extractor: dataFieldName } as FirestoreField;
      const subselector = "";
      const transformer = (selector: string) => selector;
      const isArrayValue = false;

      /** Run extractor */
      const result = jsonExtractScalar(
        dataFieldName,
        prefix,
        field,
        subselector,
        transformer,
        isArrayValue
      );
      expect(result).toEqual(
        "JSON_EXTRACT_SCALAR(dataFieldName, '$.dataFieldName')"
      );
    });

    // Test with prefix
    test("Should handle prefix correctly", () => {
      const dataFieldName = "dataFieldName";
      const prefix = "prefix";
      const field = {
        extractor: "extractor",
      } as FirestoreField;

      const subselector = "";
      const transformer = (selector: string) => selector;

      const result = jsonExtractScalar(
        dataFieldName,
        prefix,
        field,
        subselector,
        transformer
      );
      expect(result).toEqual(
        "JSON_EXTRACT_SCALAR(dataFieldName, '$.prefix.extractor')"
      );
    });

    // Test with subselector
    test("Should handle subselector correctly", () => {
      const dataFieldName = "dataFieldName";
      const prefix = "";
      const field = {
        extractor: "extractor",
      } as FirestoreField;

      const subselector = ".subselector";
      const transformer = (selector: string) => selector;

      const result = jsonExtractScalar(
        dataFieldName,
        prefix,
        field,
        subselector,
        transformer
      );
      expect(result).toEqual(
        "JSON_EXTRACT_SCALAR(dataFieldName, '$.extractor.subselector')"
      );
    });

    test("Should handle subselector correctly with prefix", () => {
      const dataFieldName = "dataFieldName";
      const prefix = "prefix";
      const field = {
        extractor: "extractor",
      } as FirestoreField;

      const subselector = ".subselector";
      const transformer = (selector: string) => selector;

      const result = jsonExtractScalar(
        dataFieldName,
        prefix,
        field,
        subselector,
        transformer
      );
      expect(result).toEqual(
        "JSON_EXTRACT_SCALAR(dataFieldName, '$.prefix.extractor.subselector')"
      );
    });

    // Test with transformer
    test("Should handle transformer correctly", () => {
      const transformer = (selector) => `TRANSFORMED(${selector})`;
      const dataFieldName = "dataFieldName";
      const field = {
        extractor: "extractor",
      } as FirestoreField;

      const result = jsonExtractScalar(
        dataFieldName,
        "",
        field,
        "",
        transformer
      );
      expect(result).toEqual(
        "TRANSFORMED(JSON_EXTRACT_SCALAR(dataFieldName, '$.extractor'))"
      );
    });

    // Test with isArrayValue set to true
    test("Should handle isArrayValue set to true", () => {
      const dataFieldName = "dataFieldName";
      const prefix = "";
      const field = {
        extractor: "extractor",
      } as FirestoreField;

      const transformer = (selector, isArrayType) =>
        isArrayType ? `ARRAY(${selector})` : selector;
      const result = jsonExtractScalar(
        dataFieldName,
        prefix,
        field,
        "",
        transformer,
        true
      );
      expect(result).toEqual(
        "ARRAY(JSON_EXTRACT_SCALAR(dataFieldName, '$.extractor'))"
      );
    });

    // Test for invalid cases
    test("Should handle an empty transformer", () => {
      const dataFieldName = "dataFieldName";
      const prefix = "";
      const field = {
        extractor: "extractor",
      } as FirestoreField;
      const transformer = null;
      const result = jsonExtractScalar(
        dataFieldName,
        prefix,
        field,
        "",
        transformer
      );
      expect(result).toEqual(null);
    });
  });

  describe("jsonExtract", () => {
    // Existing test
    test("Should extract usng minimal jsonExtract", () => {
      /** Set data */
      const dataFieldName = "dataFieldName";
      const prefix = "";
      const field = { extractor: dataFieldName } as FirestoreField;
      const subselector = "";
      const transformer = (selector: string) => selector;
      const isArrayValue = false;

      /** Run extractor */
      const result = jsonExtract(
        dataFieldName,
        prefix,
        field,
        subselector,
        transformer,
        isArrayValue
      );
      expect(result).toEqual("JSON_EXTRACT(dataFieldName, '$.dataFieldName')");
    });

    // Test with prefix
    test("Should handle prefix correctly", () => {
      const dataFieldName = "dataFieldName";
      const prefix = "prefix";
      const field = { extractor: "extractor" } as FirestoreField;
      const result = jsonExtract(dataFieldName, prefix, field);
      expect(result).toEqual(
        "JSON_EXTRACT(dataFieldName, '$.prefix.extractor')"
      );
    });

    // Test with subselector
    test("Should handle subselector correctly", () => {
      const dataFieldName = "dataFieldName";
      const field = { extractor: "extractor" } as FirestoreField;
      const subselector = ".subselector";
      const result = jsonExtract(dataFieldName, "", field, subselector);
      expect(result).toEqual(
        "JSON_EXTRACT(dataFieldName, '$.extractor.subselector')"
      );
    });

    // Test with transformer
    test("Should handle transformer correctly", () => {
      const transformer = (selector) => `TRANSFORMED(${selector})`;
      const dataFieldName = "dataFieldName";
      const field = { extractor: "extractor" } as FirestoreField;
      const result = jsonExtract(dataFieldName, "", field, "", transformer);
      expect(result).toEqual(
        "TRANSFORMED(JSON_EXTRACT(dataFieldName, '$.extractor'))"
      );
    });

    // Test with isArrayValue set to true
    test("Should handle isArrayValue set to true", () => {
      const dataFieldName = "dataFieldName";
      const field = { extractor: "extractor" } as FirestoreField;
      const transformer = (selector, isArrayType) =>
        isArrayType ? `ARRAY(${selector})` : selector;
      const result = jsonExtract(
        dataFieldName,
        "",
        field,
        "",
        transformer,
        true
      );
      expect(result).toEqual(
        "ARRAY(JSON_EXTRACT(dataFieldName, '$.extractor'))"
      );
    });

    // Test for invalid cases
    test("Should handle an invalid transformer", () => {
      const dataFieldName = "dataFieldName";
      const field = { extractor: "extractor" } as FirestoreField;
      const transformer = null;
      const result = jsonExtract(dataFieldName, "", field, "", transformer);
      expect(result).toEqual(null);
    });

    test("should throw an error with extractor or subselector", () => {
      const dataFieldName = "dataFieldName";
      const field = { extractor: null } as FirestoreField;
      const transformer = null;
      expect(() =>
        jsonExtract(dataFieldName, "", field, "", transformer)
      ).toThrow(`No valid extractor field path or subselector provided`);
    });
  });
});
