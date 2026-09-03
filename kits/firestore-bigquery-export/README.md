# @firebase-function-kits/firestore-bigquery-export

Stream a Cloud Firestore collection to BigQuery. This is the Stream Firestore to
BigQuery Firebase Extension as an npm package you add to your own Firebase
Functions codebase and deploy.

It listens for document writes on a collection, serializes each change, and
writes it to a BigQuery changelog table. Failed writes are retried through a
Firebase Functions runtime retry policy. The functions run in your own Firebase
project; there is no hosted version, so you deploy them yourself.

## Install

```sh
npm install @firebase-function-kits/firestore-bigquery-export
```

## Required IAM

Deploy needs these Google Cloud roles and APIs for the function's service
account. Firebase CLI 15.23.0 or later creates that account, grants the roles
below, enables the listed APIs, and attaches the account to every function in
this kit. Do not set a custom runtime service account for this codebase — it
conflicts with that automatic setup.

| Role / API                     | Why                                                                                    |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| `roles/bigquery.dataEditor`    | create dataset/table/views; insert rows                                                |
| `roles/bigquery.user`          | run BigQuery jobs and materialized views                                               |
| `roles/datastore.user`         | write failed-row records back to Firestore (only if you configure a backup collection) |
| `roles/eventarc.eventReceiver` | receive Gen2 Firestore trigger events                                                  |
| `roles/run.invoker`            | allow Eventarc to invoke the Gen2 Cloud Run service                                    |
| `bigquery.googleapis.com`      | mirror Firestore collection changes in BigQuery                                        |

If the dataset lives in a different project (`BIGQUERY_PROJECT_ID`), grant the
managed runtime service account the `bigquery.*` roles on that project. For a
CMEK dataset, also grant the BigQuery service account access to your KMS key.

## Usage

Export the three functions from your functions codebase entry:

```ts
// functions/src/index.ts
export {
  fsexportbigquery,
  initBigQuerySync,
  setupBigQuerySync,
} from "@firebase-function-kits/firestore-bigquery-export";
```

and configure them with a `.env` (or `.env.<projectId>`):

```sh
COLLECTION_PATH=users
DATASET_ID=analytics
TABLE_ID=users
DATABASE_REGION=europe-west2
```

- `fsexportbigquery` is the Firestore trigger.
- `initBigQuerySync` is the first-deploy provisioning lifecycle task.
- `setupBigQuerySync` is the reconfigure provisioning lifecycle task.

Importing the package without exporting its functions deploys nothing — the CLI
only deploys what your entry file exports.

## Deploy

The package's `firebase.json` declares a `kit` stanza (Firebase CLI 15.25.1 or
later, behind the `kits` experiment):

```json
{
  "functions": [
    {
      "source": ".",
      "kit": "firestore-bigquery-export",
      "instances": {
        "default": "."
      }
    }
  ]
}
```

`instances` maps each instance id to the directory (relative to
`firebase.json`) holding that instance's `.env`. The CLI prefixes every
function and task queue name with `kit-<instance id>-`, so the functions above
deploy as `kit-default-fsexportbigquery`, `kit-default-initBigQuerySync`, and
`kit-default-setupBigQuerySync`.

```sh
firebase experiments:enable kits
firebase deploy --only functions
```

Deploy a single instance with `firebase deploy --only functions:<instance id>`.

## Configuration

Set these values in a `.env` (or `.env.<projectId>`) file. The Firebase CLI
loads them at deploy time and prompts for any required values that are missing.
`PROJECT_ID` is supplied by the Firebase CLI.

| Field                            | Env var                             | Required | Default            | Description                                                        |
| -------------------------------- | ----------------------------------- | -------- | ------------------ | ------------------------------------------------------------------ |
| `collectionPath`                 | `COLLECTION_PATH`                   | no       | `posts`            | Collection or collection-group path                                |
| `datasetId`                      | `DATASET_ID`                        | no       | `firestore_export` | BigQuery dataset                                                   |
| `tableId`                        | `TABLE_ID`                          | no       | `posts`            | BigQuery changelog table                                           |
| `databaseRegion`                 | `DATABASE_REGION`                   | yes      | (prompted)         | Firestore database location; also places the functions             |
| `datasetLocation`                | `DATASET_LOCATION`                  | no       | `us`               | BigQuery dataset location                                          |
| `database`                       | `DATABASE`                          | no       | `(default)`        | Firestore database id                                              |
| `bigqueryProjectId`              | `BIGQUERY_PROJECT_ID`               | no       | project id         | Dataset project, if different                                      |
| `backupCollection`               | `BACKUP_COLLECTION`                 | no       | (empty)            | Firestore collection for failed rows                               |
| `transformFunction`              | `TRANSFORM_FUNCTION`                | no       | (empty)            | Optional transform Cloud Function                                  |
| `tablePartitioning`              | `TABLE_PARTITIONING`                | no       | `NONE`             | Table partitioning strategy                                        |
| `timePartitioningField`          | `TIME_PARTITIONING_FIELD`           | no       | (empty)            | Time-partitioning column name                                      |
| `timePartitioningFieldType`      | `TIME_PARTITIONING_FIELD_TYPE`      | no       | `omit`             | Time-partitioning field type                                       |
| `timePartitioningFirestoreField` | `TIME_PARTITIONING_FIRESTORE_FIELD` | no       | (empty)            | Firestore field for partitioning                                   |
| `clustering`                     | `CLUSTERING`                        | no       | (empty)            | Clustering columns (max 4)                                         |
| `wildcardIds`                    | `WILDCARD_IDS`                      | no       | `false`            | Store path-param values as columns                                 |
| `useNewSnapshotQuerySyntax`      | `USE_NEW_SNAPSHOT_QUERY_SYNTAX`     | no       | `false`            | Use newer snapshot query syntax                                    |
| `excludeOldData`                 | `EXCLUDE_OLD_DATA`                  | no       | `false`            | Skip previous document state on updates                            |
| `viewType`                       | `VIEW_TYPE`                         | no       | `view`             | `view`, `materialized_incremental`, `materialized_non_incremental` |
| `maxStaleness`                   | `MAX_STALENESS`                     | no       | (empty)            | Materialized view max staleness                                    |
| `refreshIntervalMinutes`         | `REFRESH_INTERVAL_MINUTES`          | no       | (empty)            | Materialized view refresh interval                                 |
| `kmsKeyName`                     | `KMS_KEY_NAME`                      | no       | (empty)            | CMEK key for the dataset                                           |
| `logLevel`                       | `LOG_LEVEL`                         | no       | `info`             | `debug`, `info`, `warn`, `error`, `silent`                         |

## Multiple instances

To export several collections, add one entry per instance to the `instances`
map, each pointing at its own config directory with its own `.env`:

```json
{
  "functions": [
    {
      "source": ".",
      "kit": "firestore-bigquery-export",
      "instances": {
        "users": "instances/users",
        "orders": "instances/orders"
      }
    }
  ]
}
```

Instance ids must be unique across all kit stanzas in the project, and every
instance's function names are namespaced by its `kit-<instance id>-` prefix, so
the instances cannot collide.

## Events

When `EVENTARC_CHANNEL` is configured, the function publishes `onStart` and
`onError` lifecycle events. Each one is published twice, under
`firebase.extensions.firestore-bigquery-export.v1.*` and under the legacy
`firebase.extensions.firestore-counter.v1.*` type the extension also used, so
triggers written against either type keep firing. The extension's `onSuccess`
event is not published; see the events entry under "Differences from the Stream
Firestore to BigQuery extension" below.

## Provisioning

The BigQuery dataset, table, and views are created by `tracker.initialize()`
through the shared provisioning path used by both task functions. Both tasks
are idempotent and retry on transient BigQuery failures (up to 15 attempts,
60s minimum backoff).

Deploy wiring (declared in the package):

- First deploy runs `initBigQuerySync` automatically (`afterFirstDeploy`).
- Later deploys run `setupBigQuerySync` automatically (`afterRedeploy`).

`initBigQuerySync` and `setupBigQuerySync` call the same handler; they exist as
separate task functions so first-deploy and redeploy can target different
queues, matching the extension's install vs update/configure split.

If automatic post-deploy enqueue did not run, enqueue a task yourself. The
snippets below use the `default` instance; substitute your instance id in the
`kit-<instance id>-` prefix if you named yours differently, and set
`FUNCTION_REGION` to the task functions' region: your `DATABASE_REGION`, with
`nam5`/`nam7` mapped to `us-central1` and `eur3` to `europe-west1`, or
`us-central1` if `DATABASE_REGION` is unset and you did not override the
deploy region. Prefer
`initBigQuerySync` after a first deploy and `setupBigQuerySync` after a
redeploy or schema-related config change (`TABLE_PARTITIONING`, `CLUSTERING`,
`WILDCARD_IDS`, `VIEW_TYPE`, and related fields).

```sh
node -e '
const { initializeApp } = require("firebase-admin/app");
const { getFunctions } = require("firebase-admin/functions");
initializeApp();
getFunctions()
  .taskQueue("locations/'"$FUNCTION_REGION"'/functions/kit-default-initBigQuerySync")
  .enqueue({})
  .then(() => console.log("init task enqueued"));
'
```

Run it from your functions directory (it uses the installed `firebase-admin`)
with application-default credentials and `GOOGLE_CLOUD_PROJECT` set. The caller
needs `roles/cloudtasks.enqueuer`.

Under the hood the task queue is an authenticated HTTP endpoint, so for a quick
manual run you can also POST to it directly — note this skips the queue, so a
failure is not retried:

```sh
URL=$(gcloud functions describe kit-default-initBigQuerySync \
  --region "$FUNCTION_REGION" --gen2 --format='value(url)')

curl -fsS -X POST -H "Content-Type: application/json" -d '{"data":{}}' \
  -H "Authorization: Bearer $(gcloud auth print-identity-token --audiences="$URL")" "$URL"
```

The Firestore write path never provisions on the hot path. If resources are
missing when a write arrives, the inline write fails, the handler calls
`ensureInitialized()` once as a self-heal and retries the write, and a remaining
failure is surfaced to the function runtime retry policy (`retry: true` on
`fsexportbigquery`).

## Differences from the Stream Firestore to BigQuery extension

This kit is the extension repackaged as an npm package, but a few things behave
differently. If you are moving from an installed extension instance, read this
section before you deploy.

### Boolean settings use `true` / `false`

`WILDCARD_IDS`, `USE_NEW_SNAPSHOT_QUERY_SYNTAX` and `EXCLUDE_OLD_DATA` are
boolean params, and only the literal string `true` enables them. The extension
used `yes` / `no` for the last two, so copying an old config across leaves them
silently disabled. Change any `yes` to `true` in your `.env`.

### Failed writes retry differently

The extension pushed a failed BigQuery write onto a Cloud Tasks queue
(`syncBigQuery`) and retried it from there. This kit has no task queue on the
write path. A failed write is retried once in place, and anything still failing
is handed to the Cloud Functions runtime retry policy, which redelivers the
Firestore event.

The practical effects: retries no longer show up as a separate function or
queue in the console, and the two knobs that tuned that queue,
`MAX_DISPATCHES_PER_SECOND` and `MAX_ENQUEUE_ATTEMPTS`, no longer exist.

### Events

`onSuccess` is no longer published. The extension emitted it from the task
queue handler, which is gone, so the kit publishes `onStart` and `onError`
only.

Every event is still published twice, once under
`firebase.extensions.firestore-bigquery-export.v1.*` and once under
`firebase.extensions.firestore-counter.v1.*`. The `firestore-counter` type is a
historical naming mistake the extension kept for backwards compatibility, and
the kit keeps it for the same reason: triggers listening on it survive the
migration. Write new triggers against the `firestore-bigquery-export` types.

### Wildcard columns include the document ID

With `WILDCARD_IDS=true`, the wildcard column now contains a `documentId` key
alongside the path parameters from your collection path. The extension wrote
the path parameters only.

### DATABASE_REGION places the functions

The extension's `LOCATION` parameter is gone. Instead, the kit deploys its
functions to the region derived from `DATABASE_REGION`: regional Firestore
locations (`europe-west2`, `us-east1`, ...) are used as-is, and the
multi-region locations map to a Cloud Run region inside them - `nam5` and
`nam7` to `us-central1`, `eur3` to `europe-west1`. Multi-region values are
never used directly: they are not Cloud Run regions and would fail the deploy.
The Firestore trigger itself always fires in the database's own region,
whatever region the function runs in.

If you copied `DATABASE_REGION` into your `.env` from an extension install,
it is honored: the functions deploy near your database.

Placement needs firebase-tools 15.28.0 or later - older CLIs do not load
`.env` values during deploy discovery, so the functions silently fall back to
the no-region behavior below. Two consequences worth knowing before you
deploy. Upgrading the CLI (or this kit, if your `.env` already carried
`DATABASE_REGION`) can itself trigger the region move described below on your
next deploy. And on a fresh interactive install the value you enter at the
prompt only takes effect from the second deploy: the first deploy computes
regions before the prompt runs, so it lands in `us-central1` and the next
deploy moves the functions.

With `DATABASE_REGION` unset or empty, the functions declare no region and the
Firebase CLI resolves one at deploy time: a function keeps the region it is
already deployed in, and on a first deploy lands in `us-central1` unless you
set the `FIREBASE_FUNCTIONS_DEFAULT_REGION` environment variable when running
`firebase deploy`. Careful with that variable: it applies to every no-region
function in the deploy, not just this kit. Note that changing an existing
install's function region (via this variable or `DATABASE_REGION`) deletes and
recreates the functions in the new region - new URLs, a recreated task queue,
and any in-flight tasks are lost.

### Defaults

Two settings now have defaults rather than being passed through empty:
`DATASET_LOCATION` defaults to `us`, and `BIGQUERY_PROJECT_ID` defaults to the
project the functions are deployed to.

### Tooling that is not included

The extension shipped companion scripts that this package does not:

- `fs-bq-import-collection`, for backfilling documents that already existed
  before the export started.
- `gen-schema-view`, for generating strongly typed BigQuery views over the
  changelog.
- The cross-project access grant scripts.

`IMPORT_COLLECTION_PATH` is not a setting here. If you rely on any of these,
keep using the versions from the extension repository. They operate on the same
BigQuery changelog table, so they still work against data this kit writes.

## API surface

- **Main entry** (`@firebase-function-kits/firestore-bigquery-export`): exports
  `fsexportbigquery`, `initBigQuerySync`, and `setupBigQuerySync`, and
  registers the first-deploy / redeploy provisioning hooks. Runtime config is
  resolved lazily on first invocation. Use this entry from Firebase
  deploy/emulator/runtime. For your own triggers, import from `./lib` instead.
- **Library entry** (`./lib`): `handleDocumentWrite`, the raw handler for owning
  trigger registration yourself, plus the config types and helpers
  (`ExportConfig`, `resolveExportConfig`, `toTrackerConfig`) for building its
  injected `HandlerContext`. Safe to import anywhere.

The change-tracker engine is an internal dependency and is not exported.

## License

Apache-2.0
