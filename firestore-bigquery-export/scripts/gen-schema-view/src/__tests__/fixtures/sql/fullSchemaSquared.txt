SELECT
  *
FROM
  (
    SELECT
      document_name,
      document_id,
      timestamp,
      operation,
      JSON_EXTRACT(data, '$.schema1.people') AS schema1_people,
      JSON_EXTRACT_SCALAR(data, '$.schema1.name') AS schema1_name,
      `test.test_dataset.firestoreArray`(JSON_EXTRACT(data, '$.schema1.favorite_numbers')) AS schema1_favorite_numbers,
      `test.test_dataset.firestoreTimestamp`(JSON_EXTRACT(data, '$.schema1.last_login')) AS schema1_last_login,
      `test.test_dataset.firestoreGeopoint`(JSON_EXTRACT(data, '$.schema1.last_location')) AS schema1_last_location,
      SAFE_CAST(
        JSON_EXTRACT_SCALAR(data, '$.schema1.last_location._latitude') AS NUMERIC
      ) AS schema1_last_location_latitude,
      SAFE_CAST(
        JSON_EXTRACT_SCALAR(data, '$.schema1.last_location._longitude') AS NUMERIC
      ) AS schema1_last_location_longitude,
      JSON_EXTRACT_SCALAR(data, '$.schema1.friends.name') AS schema1_friends_name,
      JSON_EXTRACT(data, '$.schema2.people') AS schema2_people,
      JSON_EXTRACT_SCALAR(data, '$.schema2.name') AS schema2_name,
      `test.test_dataset.firestoreArray`(JSON_EXTRACT(data, '$.schema2.favorite_numbers')) AS schema2_favorite_numbers,
      `test.test_dataset.firestoreTimestamp`(JSON_EXTRACT(data, '$.schema2.last_login')) AS schema2_last_login,
      `test.test_dataset.firestoreGeopoint`(JSON_EXTRACT(data, '$.schema2.last_location')) AS schema2_last_location,
      SAFE_CAST(
        JSON_EXTRACT_SCALAR(data, '$.schema2.last_location._latitude') AS NUMERIC
      ) AS schema2_last_location_latitude,
      SAFE_CAST(
        JSON_EXTRACT_SCALAR(data, '$.schema2.last_location._longitude') AS NUMERIC
      ) AS schema2_last_location_longitude,
      JSON_EXTRACT_SCALAR(data, '$.schema2.friends.name') AS schema2_friends_name
    FROM
      `test.test_dataset.test_table`
  ) test_table
  LEFT JOIN UNNEST(test_table.schema1_favorite_numbers) AS schema1_favorite_numbers_member WITH OFFSET schema1_favorite_numbers_index
  LEFT JOIN UNNEST(test_table.schema2_favorite_numbers) AS schema2_favorite_numbers_member WITH OFFSET schema2_favorite_numbers_index