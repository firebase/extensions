# @firebase/bigquery-firestore-export

Schedule BigQuery queries and export the results to Firestore. This is the
Export BigQuery to Firestore Firebase Extension as an npm package you add to
your own Firebase Functions codebase and deploy.

A BigQuery Data Transfer Service scheduled query runs your SQL on your
schedule; when a run completes, DTS publishes a notification to a Pub/Sub
topic, and the `processMessages` function copies the run's result table into
Firestore. The functions run in your own Firebase project; there is no hosted
version, so you deploy them yourself.

## Install

```sh
npm install @firebase/bigquery-firestore-export
```

## Required IAM and APIs

The package declares the roles below with `requiresRole(...)`. Firebase CLI
15.23.0 or later creates a managed runtime service account for the codebase,
grants it these roles, and attaches it to every function in the codebase.
Declarative security cannot be combined with a custom runtime service account.

| Role | Why |
|---|---|
| `roles/bigquery.admin` | create/update the DTS transfer config; query destination tables |
| `roles/datastore.user` | write run results and metadata to Firestore |
| `roles/pubsub.admin` | create the notification topic; let DTS grant its service agent publish rights on it |

Enable these APIs in the project before deploying (prerequisite, not
automated): `bigquery.googleapis.com`, `bigquerydatatransfer.googleapis.com`.

## Usage

Re-export the two wired functions from your functions codebase entry:

```ts
// functions/src/index.ts
export {
  processMessages,
  upsertTransferConfig,
} from "@firebase/bigquery-firestore-export";
```

and configure them with a `.env` (or `.env.<projectId>`), which the Firebase
CLI loads at deploy time, prompting for anything required that is unset:

```sh
DISPLAY_NAME="Daily Rollup - Customer Transactions"
DATASET_ID=destination_dataset
TABLE_NAME=rollup
QUERY_STRING="SELECT * FROM \`my-project.transactions.raw\`"
SCHEDULE="every 15 minutes"
COLLECTION_PATH=transferConfigs
```

- `processMessages` receives the DTS run-completion notifications and writes
  results to Firestore.
- `upsertTransferConfig` is the provisioning lifecycle task: it creates the
  notification Pub/Sub topic and creates or updates the DTS scheduled query.
  The CLI enqueues it automatically after the first deploy and after
  redeploys; it is idempotent.

The re-export matters: the Firebase CLI discovers functions from the top-level
exports of your codebase entry, so a bare `import` of the package deploys
nothing.

## Deploy

```sh
firebase deploy --only functions
```

## Configuration

Configuration is via v2 function params: env vars named as in the table (see
SPEC.md for the full param-to-field mapping). `projectId` is supplied by the
CLI's built-in `PROJECT_ID` param.

| Env var | Required | Default | Description |
|---|---|---|---|
| `DISPLAY_NAME` | yes | | DTS scheduled-query display name (creation-only) |
| `DATASET_ID` | yes | | BigQuery destination dataset |
| `TABLE_NAME` | yes | | Destination table prefix; runs write `${TABLE_NAME}_HHMMSS` |
| `QUERY_STRING` | yes | | The scheduled SQL query |
| `SCHEDULE` | yes | | DTS schedule, e.g. `every 15 minutes` |
| `LOCATION` | no | `us-central1` | Function region |
| `BIGQUERY_DATASET_LOCATION` | no | `US` | BigQuery dataset location |
| `PARTITIONING_FIELD` | no | none | Creation-time partition field; cannot be cleared later |
| `COLLECTION_PATH` | no | `transferConfigs` | Root Firestore collection |
| `INSTANCE_ID` | no | `bigquery-firestore-export` | Instance tag; see Migrating |
| `PUBSUB_TOPIC` | no | `ext-<INSTANCE_ID>-processMessages` | Notification topic name |
| `LOG_LEVEL` | no | `info` | `debug`, `info`, `warn`, `error`, `silent` |

## Migrating from the extension

Set `INSTANCE_ID` to your extension instance id (the default matches a
default-named install). The provisioning task then finds your existing
transfer-config document (tagged `extInstanceId`) and updates the existing DTS
scheduled query instead of creating a duplicate, and the default topic name
reproduces the extension's `ext-<instanceId>-processMessages`, so the existing
DTS notification wiring keeps working. The Firestore document layout
(`{COLLECTION_PATH}/{configId}`, `runs/{runId}`, `runs/latest`,
`runs/{runId}/output`) is unchanged.

Note: the DTS transfer config previously ran as the extension's service
account (`ext-<instanceId>@...`). Existing configs keep that identity
(`serviceAccountName` cannot be updated); keep that account and its BigQuery
grants, or recreate the transfer config to switch it to the managed runtime
service account.

## First deploy and the notification topic

The Pub/Sub topic is created by the provisioning task, which runs after
functions deploy. If the very first deploy fails because the trigger's topic
does not exist yet, pre-create it and redeploy:

```sh
gcloud pubsub topics create ext-bigquery-firestore-export-processMessages
```

## API surface

- **Main entry** (`@firebase/bigquery-firestore-export`): the two wired
  functions, configured from env params at load time. Because it reads the
  environment at load time, it only runs cleanly inside the Firebase toolchain
  (deploy discovery, runtime, or the emulator).
- **Library entry** (`./lib`): `handleProcessMessage` and
  `handleUpsertTransferConfig`, the raw handlers for owning trigger
  registration yourself, plus the config types and helpers
  (`ExportConfig`, `resolveExportConfig`, `topicResourceName`), the DTS
  request builders/parsers, and `convertUnsupportedDataTypes`. No load-time
  side effects, safe to import anywhere.

## License

Apache-2.0
