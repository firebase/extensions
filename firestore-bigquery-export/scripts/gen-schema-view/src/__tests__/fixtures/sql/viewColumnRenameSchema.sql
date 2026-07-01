-- Given a user-defined schema over a raw JSON changelog, returns the
-- schema elements of the latest set of live documents in the collection.
--   timestamp: The Firestore timestamp at which the event took place.
--   operation: One of INSERT, UPDATE, DELETE, IMPORT.
--   event_id: The event that wrote this row.
--   <schema-fields>: This can be one, many, or no typed-columns
--                    corresponding to fields defined in the schema.
SELECT
  *
EXCEPT
  (
    newArray,
    newMapColumnName_arrayMap,
    newGeopoint,
    newMapColumnName_geopointMap
  )
FROM
  (
    SELECT
      document_name,
      document_id,
      timestamp,
      operation,
      newArray,
      newString,
      newNumber,
      newBoolean,
      newGeopoint,
      newGeopoint_latitude,
      newGeopoint_longitude,
      newTimestamp,
      newReference,
      newMapColumnName_referenceMap,
      newMapColumnName_arrayMap,
      newMapColumnName_stringMap,
      newMapColumnName_numberMap,
      newMapColumnName_booleanMap,
      newMapColumnName_geopointMap,
      newMapColumnName_geopointMap_latitude,
      newMapColumnName_geopointMap_longitude,
      newMapColumnName_timestampMap
    FROM
      (
        SELECT
          document_name,
          document_id,
          timestamp,
          operation,
          operation = "DELETE" AS is_deleted,
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
          `test.test_dataset.test_table` QUALIFY RANK() OVER(
            PARTITION BY document_name
            ORDER BY
              timestamp DESC
          ) = 1
      )
    WHERE
      NOT is_deleted
  ) test_table
  LEFT JOIN UNNEST(test_table.newArray) AS newArray_member WITH OFFSET newArray_index
  LEFT JOIN UNNEST(test_table.newMapColumnName_arrayMap) AS newMapColumnName_arrayMap_member WITH OFFSET newMapColumnName_arrayMap_index
GROUP BY
  document_name,
  document_id,
  timestamp,
  operation,
  newString,
  newNumber,
  newBoolean,
  newGeopoint_latitude,
  newGeopoint_longitude,
  newTimestamp,
  newReference,
  newMapColumnName_referenceMap,
  newMapColumnName_stringMap,
  newMapColumnName_numberMap,
  newMapColumnName_booleanMap,
  newMapColumnName_geopointMap_latitude,
  newMapColumnName_geopointMap_longitude,
  newMapColumnName_timestampMap,
  newArray_index,
  newArray_member,
  newMapColumnName_arrayMap_index,
  newMapColumnName_arrayMap_member,
  newGeopoint_latitude,
  newGeopoint_longitude,
  newMapColumnName_geopointMap_latitude,
  newMapColumnName_geopointMap_longitude