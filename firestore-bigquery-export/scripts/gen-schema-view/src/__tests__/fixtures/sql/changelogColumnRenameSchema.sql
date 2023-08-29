SELECT
  *
FROM
  (
    SELECT
      document_name,
      document_id,
      timestamp,
      operation,
      `test.test_dataset.firestoreArray`(JSON_EXTRACT(data, '$.order')) AS newArray,
      JSON_EXTRACT_SCALAR(data, '$.limit') AS newString,
      `test.test_dataset.firestoreNumber`(JSON_EXTRACT_SCALAR(data, '$.from')) AS newNumber,
      `test.test_dataset.firestoreBoolean`(JSON_EXTRACT_SCALAR(data, '$.select')) AS newBoolean,
      `test.test_dataset.firestoreGeopoint`(JSON_EXTRACT(data, '$.where')) AS newGeopoint,
      SAFE_CAST(
        JSON_EXTRACT_SCALAR(data, '$.where._latitude') AS NUMERIC
      ) AS newGeopoint_latitude,
      SAFE_CAST(
        JSON_EXTRACT_SCALAR(data, '$.where._longitude') AS NUMERIC
      ) AS newGeopoint_longitude,
      `test.test_dataset.firestoreTimestamp`(JSON_EXTRACT(data, '$.between')) AS newTimestamp,
      JSON_EXTRACT_SCALAR(data, '$.like') AS newReference,
      JSON_EXTRACT_SCALAR(data, '$.and.like') AS newMapColumnName_referenceMap,
      `test.test_dataset.firestoreArray`(JSON_EXTRACT(data, '$.and.order')) AS newMapColumnName_arrayMap,
      JSON_EXTRACT_SCALAR(data, '$.and.limit') AS newMapColumnName_stringMap,
      `test.test_dataset.firestoreNumber`(JSON_EXTRACT_SCALAR(data, '$.and.from')) AS newMapColumnName_numberMap,
      `test.test_dataset.firestoreBoolean`(JSON_EXTRACT_SCALAR(data, '$.and.select')) AS newMapColumnName_booleanMap,
      `test.test_dataset.firestoreGeopoint`(JSON_EXTRACT(data, '$.and.where')) AS newMapColumnName_geopointMap,
      SAFE_CAST(
        JSON_EXTRACT_SCALAR(data, '$.and.where._latitude') AS NUMERIC
      ) AS newMapColumnName_geopointMap_latitude,
      SAFE_CAST(
        JSON_EXTRACT_SCALAR(data, '$.and.where._longitude') AS NUMERIC
      ) AS newMapColumnName_geopointMap_longitude,
      `test.test_dataset.firestoreTimestamp`(JSON_EXTRACT(data, '$.and.between')) AS newMapColumnName_timestampMap
    FROM
      `test.test_dataset.test_table`
  ) test_table
  LEFT JOIN UNNEST(test_table.newArray) AS newArray_member WITH OFFSET newArray_index
  LEFT JOIN UNNEST(test_table.newMapColumnName_arrayMap) AS newMapColumnName_arrayMap_member WITH OFFSET newMapColumnName_arrayMap_index