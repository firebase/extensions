SELECT
  document_name,
  document_id,
  timestamp,
  operation,
  `test.test_dataset.firestoreNumber`(
    JSON_EXTRACT_SCALAR(data, '$.super.nested.schema.value')
  ) AS super_nested_schema_value
FROM
  `test.test_dataset.test_table`