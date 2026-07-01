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
          timestamp,
          operation,
          operation = "DELETE" AS is_deleted,
          JSON_EXTRACT_SCALAR(data, '$.name') AS name,
          `test.test_dataset.firestoreArray`(JSON_EXTRACT(data, '$.favorite_numbers')) AS favorite_numbers,
          `test.test_dataset.firestoreTimestamp`(JSON_EXTRACT(data, '$.last_login')) AS last_login,
          `test.test_dataset.firestoreGeopoint`(JSON_EXTRACT(data, '$.last_location')) AS last_location,
          SAFE_CAST(
            JSON_EXTRACT_SCALAR(data, '$.last_location._latitude') AS NUMERIC
          ) AS last_location_latitude,
          SAFE_CAST(
            JSON_EXTRACT_SCALAR(data, '$.last_location._longitude') AS NUMERIC
          ) AS last_location_longitude,
          JSON_EXTRACT_SCALAR(data, '$.friends.name') AS friends_name
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