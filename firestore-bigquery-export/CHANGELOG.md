## Version 0.1.58

feat - move to Node.js 20 runtimes

## Version 0.1.57

feat - add basic materialized views support, incremental and non-incremental.

fix - do not add/update clustering if an invalid clustering field is present.

docs - improve cross-project IAM documentation

fix - emit correct events to extension, backwardly compatible.

docs - add documentation on workarounds to mitigate data loss during extension updates

## Version 0.1.56

feat - improve sync strategy by immediately writing to BQ, and using cloud tasks only as a last resort

refactor - improve observability/logging of events

chore - remove legacy backfill code

fix - improved usage of the types from change tracker package

feat - remove log failed exports param

## Version 0.1.55

feat - log failed queued tasks

## Version 0.1.54

fixed - bump changetracker and fix more vulnerabilities

## Version 0.1.53

fixed - bump changetracker to fix npm vulnerabilities

## Version 0.1.52

fixed - bump changetracker to fix npm vulnerabilities

## Version 0.1.51

fixed - medium npm vulnerabilities

fixed - rollback broken multiple database parameter option

## Version 0.1.50

fixed - fixed timestamp as a fieldname partitioning

fixed - bump dependencies, fix vulnerabilities (#2061)

fixed - separate tsconfigs (#2065)

fixed - resolve npm vulnerabilities (#2050)

## Version 0.1.49

fix - fix the issue "not creating table on install"

## Version 0.1.48

fix - fix the error "no resource found for `fsimportexistingdocs`"

## Version 0.1.47

fix - temporarily disable backfill feature

## Version 0.1.46

feature - add the ability to select Firestore database instance

fix - specify Cloud Task task retry config in `extension.yaml`

fix - specify the location in the `fsimportexistingdocs` Cloud Task

docs - fix typos, remove mention of BigQuery updating on import

## Version 0.1.45

feature - bring back the backfill parameter `DO_BACKFILL`

feature - add a new parameter `EXCLUDE_OLD_DATA` to reduce payload size by excluding old snapshot data

feature - update Firebase dependencies

feature - optimize partitioning validation flow

feature - support cross-project import with the `BIGQUERY_PROJECT_ID` parameter

fix (import script) - incorrect parsing of the `batchSize` parameter

## Version 0.1.44

fix - apply the task queue configurations in `syncBigQuery` and set max attempts to 5
fix - MAX_DISPATCHES_PER_SECOND is now set to take effect based on user's configuration

## Version 0.1.43

fix - correctly partition when only "timestamp" is selected for partition options

## Version 0.1.42

fix - correctly extract timestamps from firestore fields to partition columns

## Version 0.1.41

fix - rollback backfill feature

## Version 0.1.40

fix - correct default value for use collection group query param

## Version 0.1.39

fix - rollback timestamp serialization

## Version 0.1.38

fix - backfill value mismatch

## Version 0.1.37

fix - serialize timestamps to date string

## Version 0.1.36

build - updated depenencies

## Version 0.1.35

fixed - add missing locations back in

fixed - use module instead namespace

fixed - added e2e testing, upgraded dependencies

## Version 0.1.34

feat - added failure policy

fixed - use module instead namespace

fixed - ensure data is correctly serialized before queuing

## Version 0.1.33

feature - improved startup initialization and data synchronization

feature - bump to node 18

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

feature - add lifecycle event to export existing documents to Bigquery

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
