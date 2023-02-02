SELECT
  document_name,
  document_id,
  timestamp,
  operation,
  JSON_EXTRACT_SCALAR(data, '$.reference') AS reference,
  JSON_EXTRACT_SCALAR(data, '$.map.reference') AS map_reference
FROM
  `test.test_dataset.test_table`