-- Retrieves the latest document change events for all live documents.
    --   timestamp: The Firestore timestamp at which the event took place.
    --   operation: One of INSERT, UPDATE, DELETE, IMPORT.
    --   event_id: The id of the event that triggered the cloud function mirrored the event.
    --   data: A raw JSON payload of the current state of the document.
    --   document_id: The document id as defined in the Firestore database
    WITH latest AS (
      SELECT
        MAX(timestamp) AS latest_timestamp,
        document_name
      FROM
       `test.test_dataset.test_table`
      GROUP BY
        document_name
    )
    SELECT
      t.document_name,
      document_id,
      timestamp AS timestamp,
      ANY_VALUE(event_id) AS event_id,
      operation AS operation,
      ANY_VALUE(data) AS data
    FROM
       `test.test_dataset.test_table` AS t
      JOIN latest ON (
        t.document_name = latest.document_name
        AND IFNULL(t.timestamp, TIMESTAMP("1970-01-01 00:00:00+00")) = IFNULL(
            latest.latest_timestamp,
            TIMESTAMP("1970-01-01 00:00:00+00")
          )
      )
    WHERE
      operation != "DELETE"
    GROUP BY
      document_name,
      document_id,
      timestamp,
      operation