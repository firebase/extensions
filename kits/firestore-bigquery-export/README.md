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

If you do not have a Functions codebase yet, the fastest start is to scaffold the
ready-made example instead (it uses this package):

```sh
npx degit FirebasePrivate/extensions/examples/firestore-bigquery-export#firestore-bigquery-export-npm my-export
```

## Required IAM (set this up first)

The functions run as a service account that must have the roles below **before
the first deploy**. If they are missing, the deploy still succeeds but every write
to BigQuery is denied, so do this first.

| Role | Why |
|---|---|
| `roles/bigquery.dataEditor` | create dataset/table/views; insert rows |
| `roles/bigquery.user` | run BigQuery jobs and materialized views |
| `roles/cloudtasks.enqueuer` | enqueue the post-deploy provisioning task |
| `roles/datastore.user` | write failed-row records back to Firestore (only if you configure a backup collection) |

Create a dedicated service account and deploy the
functions with it as their runtime service account:

```sh
PROJECT_ID=your-project

gcloud iam service-accounts create firestore-bigquery-export --project "$PROJECT_ID"
SA="firestore-bigquery-export@$PROJECT_ID.iam.gserviceaccount.com"

for ROLE in bigquery.dataEditor bigquery.user cloudtasks.enqueuer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA" --role="roles/$ROLE"
done
```

If the dataset lives in a different project (`bqProjectId`), grant the
`bigquery.*` roles on that project. Add `roles/datastore.user` only if you set a
backup collection. For a CMEK dataset, also grant the BigQuery service account
access to your KMS key.

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

```sh
firebase deploy --only functions
```

## Configuration

Configuration is via v2 function params: env vars named as the upper snake-case
of the fields below (see `.env.example` for the full list). `projectId` is
supplied by the CLI's built-in `PROJECT_ID` param; the runtime service account
is derived from it unless overridden.

| Field | Required | Default | Description |
|---|---|---|---|
| `collectionPath` | yes | | Collection or collection-group path |
| `datasetId` | yes | | BigQuery dataset |
| `tableId` | yes | | BigQuery changelog table |
| `projectId` | yes | | Firebase/GCP project id |
| `location` | no | `us-central1` | Region for the trigger and queue |
| `datasetLocation` | no | `us` | BigQuery dataset location |
| `databaseId` | no | `(default)` | Firestore database id |
| `bqProjectId` | no | function project | Dataset project, if different |
| `serviceAccount` | no | `firestore-bigquery-export@$PROJECT_ID.iam.gserviceaccount.com` | Runtime service account |
| `wildcardIds` | no | `false` | Store path-param values as columns |
| `excludeOldData` | no | `false` | Skip previous document state on updates |
| `viewType` | no | `view` | `view`, `materialized_incremental`, `materialized_non_incremental` |
| `partitioning` | no | none | Table partitioning strategy |
| `clustering` | no | none | Clustering columns (max 4) |
| `logLevel` | no | `info` | `debug`, `info`, `warn`, `error`, `silent` |

## Multiple instances

To export several collections, deploy the same source once per instance using
the Firebase CLI's codebase `prefix` and `configDir` options: each
`functions` entry in `firebase.json` points at the same source directory but
namespaces its function (and task queue) names with `prefix` and reads its
`.env` from its own `configDir`. See the
[multi-instance example](../../examples/firestore-bigquery-export-multi/) for a
complete project and the associated caveats (the options are recent and not yet
officially documented).

## Provisioning

The BigQuery dataset, table, and views are created by `initBigQuerySync`, a
lifecycle task queue deployed alongside the other functions (as in the
extension). Enqueue it once after deploy; Cloud Tasks retries a failed
initialization on its own schedule, so a transient BigQuery error cannot leave
the resources unprovisioned. It is idempotent.

```sh
node -e '
const { initializeApp } = require("firebase-admin/app");
const { getFunctions } = require("firebase-admin/functions");
initializeApp();
getFunctions()
  .taskQueue("locations/'"$DATABASE_REGION"'/functions/initBigQuerySync")
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
URL=$(gcloud functions describe initBigQuerySync \
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
