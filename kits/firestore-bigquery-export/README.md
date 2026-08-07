# @firebase/firestore-bigquery-export

Stream a Cloud Firestore collection to BigQuery. This is the Stream Firestore to
BigQuery Firebase Extension as an npm package you add to your own Firebase
Functions codebase and deploy.

It listens for document writes on a collection, serializes each change, and
writes it to a BigQuery changelog table. Failed writes are retried through a
Firebase Functions runtime retry policy. The functions run in your own Firebase
project; there is no hosted version, so you deploy them yourself.

## Install

```sh
npm install @firebase/firestore-bigquery-export
```

## Required IAM

The package declares the roles below with `requiresRole(...)`. Firebase CLI
15.23.0 or later creates a managed runtime service account for the codebase,
grants it these roles, and attaches it to every function in the codebase.
Declarative security cannot be combined with a custom runtime service account.

| Role | Why |
|---|---|
| `roles/bigquery.dataEditor` | create dataset/table/views; insert rows |
| `roles/bigquery.user` | run BigQuery jobs and materialized views |
| `roles/datastore.user` | write failed-row records back to Firestore (only if you configure a backup collection) |
| `roles/eventarc.eventReceiver` | receive Gen2 Firestore trigger events |
| `roles/run.invoker` | allow Eventarc to invoke the Gen2 Cloud Run service |

If the dataset lives in a different project (`BIGQUERY_PROJECT_ID`), grant the
managed runtime service account the `bigquery.*` roles on that project. For a
CMEK dataset, also grant the BigQuery service account access to your KMS key.

## Usage

Re-export the three wired functions from your functions codebase entry:

```ts
// functions/src/index.ts
export {
  fsexportbigquery,
  initBigQuerySync,
} from "@firebase/firestore-bigquery-export";
```

and configure them with a `.env` (or `.env.<projectId>`), which the Firebase CLI
loads at deploy time, prompting for anything required that is unset:

```sh
COLLECTION_PATH=users
DATASET_ID=analytics
TABLE_ID=users
DATABASE_REGION=europe-west2
```

- `fsexportbigquery` is the Firestore trigger.
- `initBigQuerySync` is the provisioning lifecycle task, enqueued once after
  deploy (see Provisioning).

The re-export matters: the Firebase CLI discovers functions from the top-level
exports of your codebase entry, so a bare `import` of the package deploys
nothing.

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
deploy as `kit-default-fsexportbigquery` and `kit-default-initBigQuerySync`.

```sh
firebase experiments:enable kits
firebase deploy --only functions
```

Deploy a single instance with `firebase deploy --only functions:<instance id>`.

## Configuration

Configuration is via v2 function params: env vars named as in the table below.
`PROJECT_ID` is supplied by the CLI's built-in param.

| Field | Env var | Required | Default | Description |
|---|---|---|---|---|
| `collectionPath` | `COLLECTION_PATH` | no | `posts` | Collection or collection-group path |
| `datasetId` | `DATASET_ID` | no | `firestore_export` | BigQuery dataset |
| `tableId` | `TABLE_ID` | no | `posts` | BigQuery changelog table |
| `databaseRegion` | `DATABASE_REGION` | yes | — | Region for the trigger and queues |
| `datasetLocation` | `DATASET_LOCATION` | no | `us` | BigQuery dataset location |
| `database` | `DATABASE` | no | `(default)` | Firestore database id |
| `bigqueryProjectId` | `BIGQUERY_PROJECT_ID` | no | project id | Dataset project, if different |
| `backupCollection` | `BACKUP_COLLECTION` | no | (empty) | Firestore collection for failed rows |
| `transformFunction` | `TRANSFORM_FUNCTION` | no | (empty) | Optional transform Cloud Function |
| `tablePartitioning` | `TABLE_PARTITIONING` | no | `NONE` | Table partitioning strategy |
| `timePartitioningField` | `TIME_PARTITIONING_FIELD` | no | (empty) | Time-partitioning column name |
| `timePartitioningFieldType` | `TIME_PARTITIONING_FIELD_TYPE` | no | `omit` | Time-partitioning field type |
| `timePartitioningFirestoreField` | `TIME_PARTITIONING_FIRESTORE_FIELD` | no | (empty) | Firestore field for partitioning |
| `clustering` | `CLUSTERING` | no | (empty) | Clustering columns (max 4) |
| `wildcardIds` | `WILDCARD_IDS` | no | `false` | Store path-param values as columns |
| `useNewSnapshotQuerySyntax` | `USE_NEW_SNAPSHOT_QUERY_SYNTAX` | no | `false` | Use newer snapshot query syntax |
| `excludeOldData` | `EXCLUDE_OLD_DATA` | no | `false` | Skip previous document state on updates |
| `viewType` | `VIEW_TYPE` | no | `view` | `view`, `materialized_incremental`, `materialized_non_incremental` |
| `maxStaleness` | `MAX_STALENESS` | no | (empty) | Materialized view max staleness |
| `refreshIntervalMinutes` | `REFRESH_INTERVAL_MINUTES` | no | (empty) | Materialized view refresh interval |
| `kmsKeyName` | `KMS_KEY_NAME` | no | (empty) | CMEK key for the dataset |
| `logLevel` | `LOG_LEVEL` | no | `info` | `debug`, `info`, `warn`, `error`, `silent` |

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

When `EVENTARC_CHANNEL` is configured, the function publishes lifecycle events
such as `onStart`, `onError`, `onSuccess`, and `onCompletion` under
`firebase.extensions.firestore-bigquery-export.v1.*`.

## Provisioning

The BigQuery dataset, table, and views are created by `initBigQuerySync`, a
lifecycle task queue deployed alongside the other functions (as in the
extension). Enqueue it once after deploy; Cloud Tasks retries a failed
initialization on its own schedule, so a transient BigQuery error cannot leave
the resources unprovisioned. It is idempotent.

The snippets below use the `default` instance; substitute your instance id in
the `kit-<instance id>-` prefix if you named yours differently.

```sh
node -e '
const { initializeApp } = require("firebase-admin/app");
const { getFunctions } = require("firebase-admin/functions");
initializeApp();
getFunctions()
  .taskQueue("locations/'"$DATABASE_REGION"'/functions/kit-default-initBigQuerySync")
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
  --region "$DATABASE_REGION" --gen2 --format='value(url)')

curl -fsS -X POST -H "Content-Type: application/json" -d '{"data":{}}' \
  -H "Authorization: Bearer $(gcloud auth print-identity-token --audiences="$URL")" "$URL"
```

The write path never provisions, so there is no per-instance metadata check at
scale. If the resources are missing when a write arrives, the inline write fails,
the handler provisions once as a self-heal, and a remaining failure is replayed
by the function runtime retry policy. Re-run `initBigQuerySync` after any config
change that affects the table schema (`partitioning`, `clustering`,
`wildcardIds`, `viewType`).

## API surface

- **Main entry** (`@firebase/firestore-bigquery-export`): the two wired
  functions, configured from env params at load time. This is the path above and
  the one most consumers should use. Because it reads the environment at load
  time, it only runs cleanly inside the Firebase toolchain (deploy discovery,
  runtime, or the emulator).
- **Library entry** (`./lib`): `handleDocumentWrite`, the raw handler for owning
  trigger registration yourself, plus the config types and helpers
  (`ExportConfig`, `resolveExportConfig`, `toTrackerConfig`) for building its
  injected `HandlerContext`. No load-time side effects, safe to import anywhere.

The change-tracker engine is an internal dependency and is not exported.

## License

Apache-2.0
