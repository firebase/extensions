## Version 0.1.10

feature - Added a new parameter that allows customization of the BigQuery dataset location (#462)

feature - Allowed renaming of column for `gen-schema-view` script schema (#445)

fixed - Updated "gen-schema-view" script to not hide data rows (#442)

feature - Added support for collectionGroup queries (#354)

## Version 0.1.9

feature - Add new Cloud Functions locations. For more information about locations and their pricing tiers, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).

## Version 0.1.8

feature - Update Cloud Functions runtime to Node.js 10.

feature - Add validation regex for collection path parameter. (#418)

## Version 0.1.7

fixed - Updated `@firebaseextensions/firestore-bigquery-change-tracker` dependency (fixes issues #235).

## Version 0.1.6

fixed - Fixed issue with timestamp values not showing up in the latest view (#357)

feature - Record document ID of changes tracked by firestore-bigquery-change-tracker package (#374)

feature - Add document ID column to changelog table and snapshot view (#376)

## Version 0.1.5

fixed - TypeError: Cannot read property 'constructor' of null. (Issue #284)

fixed - Filtered out blob (buffer) data types from being stored as strings in BigQuery.

## Version 0.1.4

fixed - Converted circular structure to JSON error. (Issue #236)

fixed - Fixed bug where modules were not sharing the same Cloud Firestore
DocumentReference. (Issue #265)

fixed - Updated @firebaseextensions/firestore-bigquery-change-tracker dependency. (Issues #250 and #196)

## Version 0.1.3

feature - Interpret data more easily with column descriptions in the exported BigQuery data. (PR #138)

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
