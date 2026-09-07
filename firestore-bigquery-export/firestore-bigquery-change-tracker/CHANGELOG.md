# Changelog

## 2.1.2

- Works on `firebase-admin` 14. 2.1.1 widened the range but the package still used the namespaced API (`admin.apps`, `admin.firestore.Timestamp`), which firebase-admin 14 removes, so it threw at import wherever it was resolved against admin 14. Every use is now the modular API from `firebase-admin/app` and `firebase-admin/firestore`, which works on 13 and 14 alike.
- `firebase-functions` 7 is accepted alongside 6. This package only uses its `logger`, but the firebase-functions 6 peer range for `firebase-admin` stops at 13, so on a consumer running firebase-admin 14 npm nested a second admin copy under this package however wide this package's own range was, and that nested copy has no default app.
- Consumers that pin neither `firebase-admin` nor `firebase-functions` themselves and resolve fresh now get firebase-admin 14 and firebase-functions 7, which need Node 22 and Node 18 respectively. Pin firebase-admin `^13` to stay on Node 18 or 20.

## 2.1.1

- `firebase-admin` 14 is accepted alongside 13. With the previous `^13.2.0` range a consumer on 14 installed a second copy of the SDK under this package, and that copy never sees the consumer's `initializeApp()`, so every backup write to `backupTableId` failed with "The default Firebase app does not exist" and the rows were lost.

## 2.1.0

Insert-failure semantics changed. Since 2020, the retry guard in `insertData` was broken (an un-awaited async check that was always truthy), so every failed insert was retried with `ignoreUnknownValues: true` and reported success while silently dropping any field BigQuery did not recognise.

- Failed inserts are now retried once for schema lag on the columns this package itself adds (`document_id`, `old_data`, and - when wildcard ids are enabled - `path_params`), stripping exactly those columns for the retry, and once for transient failures: per-row reasons `backendError`, `internalError`, `rateLimitExceeded`, `timeout`, `stopped`, plus any error carrying no per-row detail at all (network failures, request-level errors), which also gets one full retry.
- Every other failure is terminal: the original, unmodified rows are written to the configured backup collection (`backupTableId`, keyed by `insertId`) and the insert error is rethrown to the caller.
- Fixed the backup path calling `db.settings()` more than once per Firestore instance, which made every backup after the first throw and replaced the insert error. A failed backup write is now logged and the original insert error is still the one thrown.
- Backup documents now populate `error_details` (the field previously existed but was always empty).
- Stopped the spurious table update on every cold start: a broken comparison made `tableRequiresUpdate` return true for default installs (null clustering compared against `[]`, and a truthiness bug in the wildcard-column check), so `setMetadata` ran on every initialize. Both comparisons are fixed; this reduces, not eliminates, repeat updates. Pre-existing configurations that still re-fire the update on every cold start: wildcards toggled off with `path_params` still present; partitioning configured against a pre-existing unpartitioned table (the update never applies the partitioning to the table itself, so the check keeps firing); and an invalid clustering config, including `CLUSTERING=a, b`, where the untrimmed ` b` is never applied and the mismatch persists.
- Restored clustering synchronisation on existing tables: the desired clustering was applied to the in-memory metadata before the update check read it, so adding, changing, reordering, or removing clustering on an existing table never reached BigQuery except via the (now removed) spurious update. Clustering changes now apply exactly when the config and table disagree.
- A custom partition column absent from an existing table's schema now fires its own `tableRequiresUpdate` trigger and is added by a real metadata update; previously it was only ever added as a side effect of the spurious update. Inserts that race the column's propagation fail terminally (the column is deliberately not stripped for a lag retry, since a null there misfiles the row into the wrong partition permanently) and the rows are written to the backup collection intact.

Operators consuming this via the firestore-bigquery-export extension or kit will see failures that previously passed as success: new error logs, retries from their own queue or trigger policy, and rows in `BACKUP_COLLECTION` where fields were previously dropped silently. During a schema-lag window the stripped columns are written as null; the affected column names are logged at warn level. A row written with a null `document_id` during such a window is permanently duplicated in the legacy `_latest` view (it groups by `document_name, document_id`); installs using the standard latest query are unaffected.
