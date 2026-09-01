# Changelog

## 2.1.0

Insert-failure semantics changed. Since 2020, the retry guard in `insertData` was broken (an un-awaited async check that was always truthy), so every failed insert was retried with `ignoreUnknownValues: true` and reported success while silently dropping any field BigQuery did not recognise.

- Failed inserts are now retried once for schema lag on the columns this package itself adds (`document_id`, `old_data`, and - when wildcard ids are enabled - `path_params`), stripping exactly those columns for the retry, and once for transient failures: per-row reasons `backendError`, `internalError`, `rateLimitExceeded`, `timeout`, `stopped`, plus any error carrying no per-row detail at all (network failures, request-level errors), which also gets one full retry.
- Every other failure is terminal: the original, unmodified rows are written to the configured backup collection (`backupTableId`, keyed by `insertId`) and the insert error is rethrown to the caller.
- Fixed the backup path calling `db.settings()` more than once per Firestore instance, which made every backup after the first throw and replaced the insert error. A failed backup write is now logged and the original insert error is still the one thrown.
- Backup documents now populate `error_details` (the field previously existed but was always empty).

Operators consuming this via the firestore-bigquery-export extension or kit will see failures that previously passed as success: new error logs, retries from their own queue or trigger policy, and rows in `BACKUP_COLLECTION` where fields were previously dropped silently. During a schema-lag window the stripped columns are written as null; the affected column names are logged at warn level. A row written with a null `document_id` during such a window is permanently duplicated in the legacy `_latest` view (it groups by `document_name, document_id`); installs using the standard latest query are unaffected.
