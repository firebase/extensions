## Version 0.1.32

feature - bump to node 16

## Version 0.1.31

fixed - Added support for callable transform functions

fixed - set env variables after initializing app in gen-schema-view

fixed - add checks for existing firebase apps in scripts

## Version 0.1.30

fixed - check if app already exists before init app when using events

chore - ts errors and updated packages

feature - upgrade extensions to the latest firebase-admin sdk

fixed - fixed partition data sync

## Version 0.1.29

feature - added events with an initial sync start event

feature - add flags for emulator and updated snapshot script in the import script

fixed - add optional chaining to forEach method calls, to prevent undefined errors

## Version 0.1.28

fixed - improve table update checks

fixed - Update to fix old_data bug, upgrade dependencies and fix broken tests

## Version 0.1.27

fixed - added fix for configuration setup

fixed - update snapshot script

feature - add oldData to the record

fixed - updating table metadata too often

## Version 0.1.26

docs - correct service account name

## Version 0.1.25

feature - add version to the bigquery import script

feature - add version to the bigquery gen-schema-view script

fixed - updated bigquery.googleapis.com api reference (#1022)

## Version 0.1.24

fixed - generate new lib folder

## Version 0.1.23

fixed - dataset initialization time (#980)

feature - update the import script to write path_params (#982)

fixed - added updates and tests for improving change tracker initialisation (#946)

feature - upgrade to the latest emulator updates (#995)

fixed - updated type check on partitioned date fields (#906)

fixed - updated the bq projectId to be required and to default as the current firebase project (#900)

fixed - removed lib files and updated local test suite (#894)

fixed - generate correct `package-lock.json` files after `lerna bootstrap` (#779)

feature - added merge partitioning, clustering, wildcard Ids & backup collections (#890) (#891)

fixed - added fields null check when generating schemas (#845)

fixed - import script date (#835)

fixed - update validate workflow to use node14

## Version 0.1.22

fixed - updated type check on partitioned date fields (#906)

fixed - updated the BigQuery projectId to be required and to default as the current firebase project (#900)

## Version 0.1.21

fixed - removed lib files and updated local test suite (#894)

fixed - generate correct `package-lock.json` files after `lerna bootstrap` (#779)

feature - added merge partitioning, clustering, wildcard Ids & backup collections (#890) (#891)

fixed - added fields null check when generating schemas (#845)

fixed - import script date (#835)

fixed - update validate workflow to use node14

fixed - update package lock file to match latest node type changes (#782)

## Version 0.1.20

fixed - Fixed installation error due to bad package-lock.json

## Version 0.1.19

docs - Renamed the extension to "Stream Collections to BigQuery"

feature - add Taiwan and Singapore Cloud Function locations (#729)

## Version 0.1.18

No change from last release

## Version 0.1.17

fixed - improved import script

## Version 0.1.16

feature - added Warsaw (europe-central2) location (#677)

feature - updated Cloud Functions runtime to Node.js 14 (#660)

## Version 0.1.15

fixed - rolled back version 0.1.14 to address issue #681

## Version 0.1.14

feature - added Warsaw (europe-central2) location (#677)

feature - updated Cloud Functions runtime to Node.js 14 (#660)

## Version 0.1.13

feature - Added the ability to optionally create partitioned tables to improve query performance and reduce the cost of querying large datasets (#581)

feature - Added us-central-1 as a dataset option (#603)

## Version 0.1.12

docs - Updated description for COLLECTION_GROUP_QUERY parameter.

## Version 0.1.11

feature - Add stringified_map schema type to gen-schema-view script (#518)

fixed - Switch from `console.log` to `functions.logger.log` for cleaner log outputs.

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
