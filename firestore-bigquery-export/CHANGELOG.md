## Version 0.1.3

feature - Interpret data more easily with column descriptions in the exported BigQuery data (#138).

- The raw changelog now includes column descriptions.
- The schema-views script allows you to specify custom column descriptions.

fixed - Updated `@firebaseextensions/firestore-bigquery-change-tracker` dependency (fixes issues #235 and #225).

## Version 0.1.2

fixed - Added "IF NOT EXISTS" to safely run `fs-bq-schema-views` script multiple times (PR #193).
fixed - Updated BigQuery dependency in `package.json` for the `fs-bq-import-collection` script (issue #192 and PR #197).

## Version 0.1.1

fixed - Fixed occasional duplicate rows created in the BigQuery backup table (issue #101).

## Version 0.1.0

Initial release of the _Export Collections to BigQuery_ extension.
