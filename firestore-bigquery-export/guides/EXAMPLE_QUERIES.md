These example queries are for use with the official Firebase Extension
[_Stream Firestore to BigQuery_](https://github.com/firebase/extensions/tree/master/firestore-bigquery-export)
and its associated [`fs-bq-schema-views` script](https://github.com/firebase/extensions/blob/master/firestore-bigquery-export/guides/GENERATE_SCHEMA_VIEWS.md) (referred to as the "schema-views script").

The queries use the following parameter values from your installation of the extension:

- `${param:PROJECT_ID}`: the project ID for the Firebase project in
  which you installed the extension
- `${param:DATASET_ID}`: the ID that you specified for your dataset during
  extension installation
- `${param:TABLE_ID}`: the common prefix of BigQuery views to generate

**Note:** You can, at any time, run the schema-views script against additional schema files
to create different schema views over your raw changelog. When you settle on a fixed schema,
you can create a [scheduled query](https://cloud.google.com/bigquery/docs/scheduling-queries)
to transfer the columns reported by the schema view to a persistent backup table.

Assume that you have a schema view matching the following configuration from a
schema file:

```
{
  "fields": [
    {
      "name": "name",
      "type": "string"
    },
    {
      "name":"favorite_numbers",
      "type": "array"
    },
    {
      "name": "last_login",
      "type": "timestamp"
    },
    {
      "name": "last_location",
      "type": "geopoint"
    },
    {
      "fields": [
        {
          "name": "name",
          "type": "string"
        }
      ],
      "name": "friends",
      "type": "map"
    }
  ]
}
```

### Example query for a timestamp

You can generate a listing of users that have logged in to the app as follows:

```sql
SELECT name, last_login
FROM ${param:PROJECT_ID}.${param:DATASET_ID}.${param:TABLE_ID}_schema_${SCHEMA_FILE_NAME}_latest
ORDER BY last_login DESC
```

In this query, note the following:

- `${SCHEMA_FILE_NAME}` is the name of the schema file that you
  provided as an argument to run the schema-views script.

- The `last_login` column contains data that is stored in the `data`
  column of the raw changelog. The type conversion and view generation is
  performed for you by the
  [_Stream Firestore to BigQuery_](https://github.com/firebase/extensions/tree/master/firestore-bigquery-export)
  extension.

### Example queries for an array

The example schema configuration (see above) stores each user's favorite number
in a Cloud Firestore array called `favorite_numbers`. Here are some example
queries for that data:

- If you wanted to determine how many favorite numbers each user
  currently has, then you can run the following query:

  ```sql
  SELECT document_name, MAX(favorite_numbers_index)
  FROM ${param:PROJECT_ID}.users.users_schema_user_full_schema_latest
  GROUP BY document_name
  ```

- If you wanted to determine the what the current favorite numbers are
  of the app's users (assuming that number is stored in the first position of
  the `favorite_numbers` array), you can run the following query:

  ```sql
  SELECT document_name, favorite_numbers_member
  FROM ${param:PROJECT_ID}.users.users_schema_user_full_schema_latest
  WHERE favorite_numbers_index = 0
  ```

### Example query if you have multiple arrays

If you had multiple arrays in the schema configuration, you might have to select
all `DISTINCT` documents to eliminate the redundant rows introduced by the
cartesian product of `CROSS JOIN`.

```sql
SELECT DISTINCT document_name, favorite_numbers_member
FROM ${param:PROJECT_ID}.users.users_schema_user_full_schema_latest
WHERE favorite_numbers_index = 0
```

### Remove stale data from your changelog table

If you want to clean up data from your `changelog` table, use the following
`DELETE` query to delete all rows that fall within a certain time period,
e.g. greater than 1 month old.

#### Option 1: Remove stale changelog records but keep latest change per document (default)

If you want to remove all entries that are over one month old, regardless of whether they are the latest change for a document (e.g., including DELETE operations), use the following query:

```sql
/* The query below deletes any rows below that are over one month old. */
DELETE FROM `[PROJECT ID].[DATASET ID].[CHANGELOG TABLE ID]`
WHERE (document_name, timestamp) IN
(
  WITH latest AS (
    SELECT MAX(timestamp) as timestamp, document_name
    FROM `[PROJECT ID].[DATASET ID].[CHANGELOG TABLE ID]`
    GROUP BY document_name
  )
  SELECT (t.document_name, t.timestamp)
  FROM `[PROJECT ID].[DATASET ID].[CHANGELOG TABLE ID]` AS t
  JOIN latest  ON (t.document_name = latest.document_name )
  WHERE t.timestamp != latest.timestamp
  AND DATETIME(t.timestamp) < DATE_ADD(CURRENT_DATETIME(), INTERVAL -1 MONTH)
)
```

⚠️ Note: This query will remove all entries older than one month, including the most recent record for documents whose last change (e.g., a DELETE) happened more than a month ago. Use this only if you do not need to retain full historical state in your changelog table.

#### Option 2: Remove all changelog records older than one month — including latest DELETE operations

If you want to remove all entries that are over one month old, regardless of whether they are the latest change for a document (e.g., including DELETE operations), use the following query:

```sql
/* Deletes all changelog records older than one month, including latest DELETEs */
DELETE FROM `[PROJECT ID].[DATASET ID].[CHANGELOG TABLE ID]`
WHERE DATETIME(timestamp) < DATE_ADD(CURRENT_DATETIME(), INTERVAL -1 MONTH)
```

#### Option 3: Remove all changelog records older than one month, including latest DELETE operations only

This option removes all old records, and it will also delete DELETE operations even if they are the latest change for a document — as long as they are older than one month.

Use this if you want to aggressively clean up deleted documents from your changelog, even if that means latest views will no longer reflect that those documents were deleted.

```sql
/* Deletes any changelog records over one month old,
   including DELETEs that are the latest entry for a document */
DELETE FROM `[PROJECT ID].[DATASET ID].[CHANGELOG TABLE ID]`
WHERE (document_name, timestamp) IN (
  WITH latest AS (
    SELECT MAX(timestamp) AS timestamp, document_name
    FROM `[PROJECT ID].[DATASET ID].[CHANGELOG TABLE ID]`
    GROUP BY document_name
  )
  SELECT (t.document_name, t.timestamp)
  FROM `[PROJECT ID].[DATASET ID].[CHANGELOG TABLE ID]` AS t
  JOIN latest ON t.document_name = latest.document_name
  WHERE (t.timestamp != latest.timestamp OR t.operation = 'DELETE')
    AND DATETIME(t.timestamp) < DATE_ADD(CURRENT_DATETIME(), INTERVAL -1 MONTH)
)
```

⚠️ Note: This will remove DELETE records that are older than one month even if they are the most recent change. As a result, your \_latest view will no longer show that those documents were deleted — they may appear as if they never existed. Use this option only if that behavior is acceptable for your use case.
