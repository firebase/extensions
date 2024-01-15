/**
 * Extract a field from a raw JSON string that lives in the column
 * `dataFieldName`. The result of this function is a clause which can be used in
 * the argument of a SELECT query to create a corresponding BigQuery-typed
 * column in the result set.
 *
 * @param dataFieldName the source column containing raw JSON
 * @param prefix the path we need to follow from the root of the JSON to arrive
 * at the named field
 * @param field the field we are extracting
 * @param subselector the path we want to follow within the named field. As an
 * example, this is useful when extracting latitude and longitude from a
 * serialized geopoint field.
 * @param transformer any transformation we want to apply to the result of
 * JSON_EXTRACT. This is typically a BigQuery CAST, or an UNNEST (in the case
 * where the result is an ARRAY).
 */

import { FirestoreField } from ".";

export const jsonExtractScalar = (
  dataFieldName: string,
  prefix: string,
  field: FirestoreField,
  subselector: string = "",
  transformer: (selector: string, isArrayType?: boolean) => string = (
    selector
  ) => selector, // Add a default transformer here
  isArrayValue?: boolean
) => {
  /** Retrn early for an invalid transformer */
  if (!transformer) return null;

  return transformer(
    `JSON_EXTRACT_SCALAR(${dataFieldName}, \'\$.${
      prefix.length > 0 ? `${prefix}.` : ``
    }${field.extractor ? field.extractor + subselector : ""}\')`,
    isArrayValue
  );
};

export const jsonExtract = (
  dataFieldName: string,
  prefix: string,
  field: FirestoreField,
  subselector: string = "",
  transformer: (selector: string, isArrayType?: boolean) => string = (
    selector
  ) => selector,
  isArrayValue?: boolean
) => {
  /** Check for valid extractors */
  if (!field?.extractor && !subselector)
    throw new Error(`No valid extractor field path or subselector provided`);

  /** Retrn early for an invalid transformer */
  if (!transformer) return null;

  return transformer(
    `JSON_EXTRACT(${dataFieldName}, \'\$.${
      prefix.length > 0 ? `${prefix}.` : ``
    }${field.extractor}${subselector}\')`,
    isArrayValue
  );
};
