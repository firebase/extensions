SELECT
  *
FROM
  (
    SELECT
      document_name,
      document_id,
      timestamp,
      operation,
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
      `test.test_dataset.test_table_latest`
  ) test_table_latest
  LEFT JOIN UNNEST(test_table_latest.favorite_numbers) AS favorite_numbers_member WITH OFFSET favorite_numbers_index