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
  (favorite_numbers, last_location)
FROM
  (
    SELECT
      document_name,
      document_id,
      timestamp,
      operation,
      name,
      favorite_numbers,
      last_login,
      last_location,
      last_location_latitude,
      last_location_longitude,
      friends_name
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
          FIRST_VALUE(JSON_EXTRACT_SCALAR(data, '$.name')) OVER(
            PARTITION BY document_name
            ORDER BY
              timestamp DESC
          ) AS name,
          `test.test_dataset.firestoreArray`(
            FIRST_VALUE(JSON_EXTRACT(data, '$.favorite_numbers')) OVER(
              PARTITION BY document_name
              ORDER BY
                timestamp DESC
            )
          ) AS favorite_numbers,
          `test.test_dataset.firestoreTimestamp`(
            FIRST_VALUE(JSON_EXTRACT(data, '$.last_login')) OVER(
              PARTITION BY document_name
              ORDER BY
                timestamp DESC
            )
          ) AS last_login,
          `test.test_dataset.firestoreGeopoint`(
            FIRST_VALUE(JSON_EXTRACT(data, '$.last_location')) OVER(
              PARTITION BY document_name
              ORDER BY
                timestamp DESC
            )
          ) AS last_location,
          SAFE_CAST(
            FIRST_VALUE(JSON_EXTRACT_SCALAR(data, '$.last_location._latitude')) OVER(
              PARTITION BY document_name
              ORDER BY
                timestamp DESC
            ) AS NUMERIC
          ) AS last_location_latitude,
          SAFE_CAST(
            FIRST_VALUE(JSON_EXTRACT_SCALAR(data, '$.last_location._longitude')) OVER(
              PARTITION BY document_name
              ORDER BY
                timestamp DESC
            ) AS NUMERIC
          ) AS last_location_longitude,
          FIRST_VALUE(JSON_EXTRACT_SCALAR(data, '$.friends.name')) OVER(
            PARTITION BY document_name
            ORDER BY
              timestamp DESC
          ) AS friends_name
        FROM
          `test.test_dataset.test_table`
      )
    WHERE
      NOT is_deleted
  ) test_table
  LEFT JOIN UNNEST(test_table.favorite_numbers) AS favorite_numbers_member WITH OFFSET favorite_numbers_index
GROUP BY
  document_name,
  document_id,
  timestamp,
  operation,
  name,
  last_login,
  last_location_latitude,
  last_location_longitude,
  friends_name,
  favorite_numbers_index,
  favorite_numbers_member,
  last_location_latitude,
  last_location_longitude