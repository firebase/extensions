SELECT
  *
FROM
  (
    SELECT
      document_name,
      document_id,
      timestamp,
      operation,
      `test.test_dataset.firestoreArray`(JSON_EXTRACT(data, '$.map.array')) AS map_array,
      `test.test_dataset.firestoreArray`(JSON_EXTRACT(data, '$.map2.array')) AS map2_array
    FROM
      `test.test_dataset.test_table`
  ) test_table
  LEFT JOIN UNNEST(test_table.map_array) AS map_array_member WITH OFFSET map_array_index
  LEFT JOIN UNNEST(test_table.map2_array) AS map2_array_member WITH OFFSET map2_array_index