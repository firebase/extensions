SELECT
    document_name,
    document_id,
    timestamp,
    operation,
    JSON_EXTRACT(data, '$.friends') AS friends
  FROM
    `test.test_dataset.test_table`