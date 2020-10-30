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
          FIRST_VALUE(timestamp) OVER(
            PARTITION BY document_name
            ORDER BY
              timestamp DESC
          ) AS timestamp,
          FIRST_VALUE(operation) OVER(
            PARTITION BY document_name
            ORDER BY
              timestamp DESC
          ) AS operation,
          FIRST_VALUE(operation) OVER(
            PARTITION BY document_name
            ORDER BY
              timestamp DESC
          ) = "DELETE" AS is_deleted,
          `test.test_dataset.firestoreArray`(
            FIRST_VALUE(JSON_EXTRACT(data, '$.order')) OVER(
              PARTITION BY document_name
              ORDER BY
                timestamp DESC
            )
          ) AS newArray,
          FIRST_VALUE(JSON_EXTRACT_SCALAR(data, '$.limit')) OVER(
            PARTITION BY document_name
            ORDER BY
              timestamp DESC
          ) AS newString,
          `test.test_dataset.firestoreNumber`(
            FIRST_VALUE(JSON_EXTRACT_SCALAR(data, '$.from')) OVER(
              PARTITION BY document_name
              ORDER BY
                timestamp DESC
            )
          ) AS newNumber,
          `test.test_dataset.firestoreBoolean`(
            FIRST_VALUE(JSON_EXTRACT_SCALAR(data, '$.select')) OVER(
              PARTITION BY document_name
              ORDER BY
                timestamp DESC
            )
          ) AS newBoolean,
          `test.test_dataset.firestoreGeopoint`(
            FIRST_VALUE(JSON_EXTRACT(data, '$.where')) OVER(
              PARTITION BY document_name
              ORDER BY
                timestamp DESC
            )
          ) AS newGeopoint,
          SAFE_CAST(
            FIRST_VALUE(JSON_EXTRACT_SCALAR(data, '$.where._latitude')) OVER(
              PARTITION BY document_name
              ORDER BY
                timestamp DESC
            ) AS NUMERIC
          ) AS newGeopoint_latitude,
          SAFE_CAST(
            FIRST_VALUE(JSON_EXTRACT_SCALAR(data, '$.where._longitude')) OVER(
              PARTITION BY document_name
              ORDER BY
                timestamp DESC
            ) AS NUMERIC
          ) AS newGeopoint_longitude,
          `test.test_dataset.firestoreTimestamp`(
            FIRST_VALUE(JSON_EXTRACT(data, '$.between')) OVER(
              PARTITION BY document_name
              ORDER BY
                timestamp DESC
            )
          ) AS newTimestamp,
          FIRST_VALUE(JSON_EXTRACT_SCALAR(data, '$.like')) OVER(
            PARTITION BY document_name
            ORDER BY
              timestamp DESC
          ) AS newReference,
          FIRST_VALUE(JSON_EXTRACT_SCALAR(data, '$.and.like')) OVER(
            PARTITION BY document_name
            ORDER BY
              timestamp DESC
          ) AS newMapColumnName_referenceMap,
          `test.test_dataset.firestoreArray`(
            FIRST_VALUE(JSON_EXTRACT(data, '$.and.order')) OVER(
              PARTITION BY document_name
              ORDER BY
                timestamp DESC
            )
          ) AS newMapColumnName_arrayMap,
          FIRST_VALUE(JSON_EXTRACT_SCALAR(data, '$.and.limit')) OVER(
            PARTITION BY document_name
            ORDER BY
              timestamp DESC
          ) AS newMapColumnName_stringMap,
          `test.test_dataset.firestoreNumber`(
            FIRST_VALUE(JSON_EXTRACT_SCALAR(data, '$.and.from')) OVER(
              PARTITION BY document_name
              ORDER BY
                timestamp DESC
            )
          ) AS newMapColumnName_numberMap,
          `test.test_dataset.firestoreBoolean`(
            FIRST_VALUE(JSON_EXTRACT_SCALAR(data, '$.and.select')) OVER(
              PARTITION BY document_name
              ORDER BY
                timestamp DESC
            )
          ) AS newMapColumnName_booleanMap,
          `test.test_dataset.firestoreGeopoint`(
            FIRST_VALUE(JSON_EXTRACT(data, '$.and.where')) OVER(
              PARTITION BY document_name
              ORDER BY
                timestamp DESC
            )
          ) AS newMapColumnName_geopointMap,
          SAFE_CAST(
            FIRST_VALUE(
              JSON_EXTRACT_SCALAR(data, '$.and.where._latitude')
            ) OVER(
              PARTITION BY document_name
              ORDER BY
                timestamp DESC
            ) AS NUMERIC
          ) AS newMapColumnName_geopointMap_latitude,
          SAFE_CAST(
            FIRST_VALUE(
              JSON_EXTRACT_SCALAR(data, '$.and.where._longitude')
            ) OVER(
              PARTITION BY document_name
              ORDER BY
                timestamp DESC
            ) AS NUMERIC
          ) AS newMapColumnName_geopointMap_longitude,
          `test.test_dataset.firestoreTimestamp`(
            FIRST_VALUE(JSON_EXTRACT(data, '$.and.between')) OVER(
              PARTITION BY document_name
              ORDER BY
                timestamp DESC
            )
          ) AS newMapColumnName_timestampMap
        FROM
          `test.test_dataset.test_table`
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