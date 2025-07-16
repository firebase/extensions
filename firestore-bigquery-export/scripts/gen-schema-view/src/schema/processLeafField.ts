import {
  FirestoreField,
  firestoreToBigQueryFieldType,
  qualifyFieldName,
} from ".";
import {
  firestoreArray,
  firestoreBoolean,
  firestoreGeopoint,
  firestoreNumber,
  firestoreTimestamp,
} from "../udf";
import { jsonExtract, jsonExtractScalar } from "./extractors";

/**
 * Once we have reached the field in the JSON tree, we must determine what type
 * it is in the schema and then perform any conversions needed to coerce it into
 * the BigQuery type.
 */
export const processLeafField = (
  datasetId: string,
  dataFieldName: string,
  prefix: string[],
  field: FirestoreField,
  transformer: (selector: string, isArrayType?: boolean) => string,
  bigQueryFields: { [property: string]: string }[],
  extractPrefix: string[],
  isArrayValue?: boolean
) => {
  const extractPrefixJoined = `${extractPrefix.join(".")}`;

  let fieldNameToSelector = {};
  let selector;

  switch (field.type) {
    case "null":
      selector = transformer(`NULL`);
      break;

    case "stringified_map":
      selector = jsonExtract(
        dataFieldName,
        extractPrefixJoined,
        field,
        "",
        transformer
      );
      break;
    case "string":
    case "reference":
      selector = jsonExtractScalar(
        dataFieldName,
        extractPrefixJoined,
        field,
        ``,
        transformer,
        isArrayValue
      );
      break;
    case "array":
      selector = firestoreArray(
        datasetId,
        jsonExtract(dataFieldName, extractPrefixJoined, field, ``, transformer)
      );
      break;
    case "boolean":
      selector = firestoreBoolean(
        datasetId,
        jsonExtractScalar(
          dataFieldName,
          extractPrefixJoined,
          field,
          ``,
          transformer
        )
      );
      break;
    case "number":
      selector = firestoreNumber(
        datasetId,
        jsonExtractScalar(
          dataFieldName,
          extractPrefixJoined,
          field,
          ``,
          transformer
        )
      );
      break;
    case "timestamp":
      selector = firestoreTimestamp(
        datasetId,
        jsonExtract(dataFieldName, extractPrefixJoined, field, ``, transformer)
      );
      break;
    case "geopoint":
      const latitude = jsonExtractScalar(
        dataFieldName,
        extractPrefixJoined,
        field,
        `._latitude`,
        transformer
      );
      const longitude = jsonExtractScalar(
        dataFieldName,
        extractPrefixJoined,
        field,
        `._longitude`,
        transformer
      );
      /*
       * We return directly from this branch because it's the only one that
       * generates multiple selector clauses.
       */
      fieldNameToSelector[
        qualifyFieldName(prefix, field.name)
      ] = `${firestoreGeopoint(
        datasetId,
        jsonExtract(dataFieldName, extractPrefixJoined, field, ``, transformer)
      )} AS ${prefix.concat(field.name).join("_")}`;

      bigQueryFields.push({
        name: qualifyFieldName(prefix, field.name),
        mode: "NULLABLE",
        type: firestoreToBigQueryFieldType[field.type],
        description: field.description,
      });

      fieldNameToSelector[
        qualifyFieldName(prefix, `${field.name}_latitude`)
      ] = `SAFE_CAST(${latitude} AS NUMERIC) AS ${qualifyFieldName(
        prefix,
        `${field.name}_latitude`
      )}`;

      bigQueryFields.push({
        name: qualifyFieldName(prefix, `${field.name}_latitude`),
        mode: "NULLABLE",
        type: "NUMERIC",
        description: `Numeric latitude component of ${field.name}.`,
      });

      fieldNameToSelector[
        qualifyFieldName(prefix, `${field.name}_longitude`)
      ] = `SAFE_CAST(${longitude} AS NUMERIC) AS ${qualifyFieldName(
        prefix,
        `${field.name}_longitude`
      )}`;

      bigQueryFields.push({
        name: qualifyFieldName(prefix, `${field.name}_longitude`),
        mode: "NULLABLE",
        type: "NUMERIC",
        description: `Numeric longitude component of ${field.name}.`,
      });
      return fieldNameToSelector;
  }

  fieldNameToSelector[
    qualifyFieldName(prefix, field.name)
  ] = `${selector} AS ${qualifyFieldName(prefix, field.name)}`;

  if (field.type === "array") {
    bigQueryFields.push({
      name: qualifyFieldName(prefix, field.name),
      mode: "REPEATED",
      type: "STRING",
      description: field.description,
    });
  } else {
    bigQueryFields.push({
      name: qualifyFieldName(prefix, field.name),
      mode: "NULLABLE",
      type: firestoreToBigQueryFieldType[field.type],
      description: field.description,
    });
  }

  return fieldNameToSelector;
};
