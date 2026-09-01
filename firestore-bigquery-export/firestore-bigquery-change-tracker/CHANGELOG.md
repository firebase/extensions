# Changelog

## 2.1.0

Insert-failure semantics changed. Since 2020, the retry guard in `insertData` was broken (an un-awaited async check that was always truthy), so every failed insert was retried with `ignoreUnknownValues: true` and reported success while silently dropping any field BigQuery did not recognise.

- Failed inserts are now retried only for schema lag on the columns this package itself adds (`document_id`, `old_data`, `path_params`), stripping exactly those columns, and for transient BigQuery errors (`backendError`, `internalError`, `rateLimitExceeded`, `timeout`, `stopped`).
- Every other failure is terminal: the original, unmodified rows are written to the configured backup collection (`backupTableId`, keyed by `insertId`) and the insert error is rethrown to the caller.
- Fixed the backup path calling `db.settings()` more than once per Firestore instance, which made every backup after the first throw and replaced the insert error. A failed backup write is now logged and the original insert error is still the one thrown.
- Backup documents now include `error_details`.

Operators consuming this via the firestore-bigquery-export extension or kit will see failures that previously passed as success: new error logs, retries from their own queue or trigger policy, and rows in `BACKUP_COLLECTION` where fields were previously dropped silently. During a schema-lag window the stripped columns are written as null; the affected column names are logged at warn level.
