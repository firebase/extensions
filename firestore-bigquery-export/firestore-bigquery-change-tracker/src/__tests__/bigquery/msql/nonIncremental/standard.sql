CREATE MATERIALIZED VIEW `test.test_dataset.materialized_view_test`
  OPTIONS (
    allow_non_incremental_definition = true,
    enable_refresh = true,
    refresh_interval_minutes = 60,
    max_staleness = INTERVAL "4:0:0" HOUR TO SECOND
  )
  AS (
    WITH latests AS (
      SELECT
        document_name,
        MAX_BY(document_id, timestamp) AS document_id,
        MAX(timestamp) AS timestamp,
        MAX_BY(event_id, timestamp) AS event_id,
        MAX_BY(operation, timestamp) AS operation,
        MAX_BY(data, timestamp) AS data,
        MAX_BY(old_data, timestamp) AS old_data,
        MAX_BY(extra_field, timestamp) AS extra_field
      FROM `test.test_dataset.test_table`
      GROUP BY document_name
    )
    SELECT *
    FROM latests
    WHERE operation != "DELETE"
  )