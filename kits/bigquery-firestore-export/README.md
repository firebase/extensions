# @firebase/bigquery-firestore-export

Schedule a BigQuery query and write each run's rows and metadata to Firestore.
This is the Export BigQuery to Firestore Firebase Extension as an npm package
you add to your own Firebase Functions codebase and deploy.

The kit creates or reconciles a BigQuery Data Transfer scheduled query, listens
for its Pub/Sub completion notifications, reads the destination table, and
writes the rows to Firestore. The functions run in your own Firebase project;
there is no hosted version, so you deploy them yourself.

## Install

```sh
npm install @firebase/bigquery-firestore-export
```

## Required IAM

Deploy needs these Google Cloud roles and APIs for the function's service
account. Firebase CLI 15.23.0 or later creates that account, grants the roles
below, enables the listed APIs, and attaches the account to every function in
this kit. Do not set a custom runtime service account for this codebase—it
conflicts with that automatic setup.

| Role / API                            | Why                                                                 |
| ------------------------------------- | ------------------------------------------------------------------- |
| `roles/datastore.user`                | store transfer configs, run metadata, and query output in Firestore |
| `roles/bigquery.admin`                | create scheduled queries and read their destination tables          |
| `roles/pubsub.admin`                  | create the transfer-notification topic                              |
| `roles/eventarc.eventReceiver`        | receive Gen2 Pub/Sub trigger events                                 |
| `roles/run.invoker`                   | allow Eventarc/Tasks to invoke the Gen2 Cloud Run services          |
| `bigquery.googleapis.com`             | run queries and read destination tables                             |
| `bigquerydatatransfer.googleapis.com` | create and reconcile scheduled-query transfer configs               |
| `pubsub.googleapis.com`               | deliver transfer-completion notifications                           |

## Usage

Export both functions from your functions codebase entry:

```ts
// functions/src/index.ts
export {
  processMessages,
  upsertTransferConfig,
} from "@firebase/bigquery-firestore-export";
```

and configure them with a `.env` (or `.env.<projectId>`):

```sh
INSTANCE_ID=analytics-export
BIGQUERY_DATASET_LOCATION=US
DATASET_ID=analytics
TABLE_NAME=users
QUERY_STRING=SELECT * FROM `my-project.source.users`
DISPLAY_NAME=Export users to Firestore
SCHEDULE=every 24 hours
```

- `processMessages` consumes BigQuery Data Transfer completion messages.
- `upsertTransferConfig` is the idempotent lifecycle task that creates, links,
  or updates the scheduled query and its notification topic.

Importing the package without exporting its functions deploys nothing—the CLI
only deploys what your entry file exports.

## Deploy

The package's `firebase.json` declares a `kit` stanza (Firebase CLI 15.25.1 or
later, behind the `kits` experiment):

```json
{
  "functions": [
    {
      "source": ".",
      "kit": "bigquery-firestore-export",
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
deploy as `kit-default-processMessages` and
`kit-default-upsertTransferConfig`.

```sh
firebase experiments:enable kits
firebase deploy --only functions
```

Deploy a single instance with `firebase deploy --only functions:<instance id>`.

## Configuration

Set these values in a `.env` (or `.env.<projectId>`) file. The Firebase CLI
loads them at deploy time and prompts for required values that are missing.
`PROJECT_ID` is supplied by the Firebase CLI.

| Field                     | Env var                     | Required | Default           | Description                                                  |
| ------------------------- | --------------------------- | -------- | ----------------- | ------------------------------------------------------------ |
| `instanceId`              | `INSTANCE_ID`               | yes      | —                 | Must match this instance's key in the `instances` map        |
| `bigqueryDatasetLocation` | `BIGQUERY_DATASET_LOCATION` | no       | `US`              | BigQuery destination dataset location                        |
| `transferConfigName`      | `TRANSFER_CONFIG_NAME`      | no       | (empty)           | Existing DTS config resource to link instead of creating one |
| `datasetId`               | `DATASET_ID`                | yes      | —                 | BigQuery destination dataset id                              |
| `tableName`               | `TABLE_NAME`                | yes      | —                 | Prefix for per-run destination tables                        |
| `queryString`             | `QUERY_STRING`              | yes      | —                 | Scheduled Standard SQL query                                 |
| `displayName`             | `DISPLAY_NAME`              | yes      | —                 | Human-readable scheduled-query name                          |
| `partitioningField`       | `PARTITIONING_FIELD`        | no       | (empty)           | Destination-table partitioning field                         |
| `schedule`                | `SCHEDULE`                  | yes      | —                 | DTS schedule, such as `every 24 hours`                       |
| `firestoreCollection`     | `COLLECTION_PATH`           | no       | `transferConfigs` | Root Firestore collection for configs and output             |
| `logLevel`                | `LOG_LEVEL`                 | no       | `info`            | `debug`, `info`, `warn`, `error`, or `silent`                |

## Multiple instances

To run several reverse-sync instances, add one entry per instance to the
`instances` map, each pointing at its own config directory with its own `.env`:

```json
{
  "functions": [
    {
      "source": ".",
      "kit": "bigquery-firestore-export",
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
the instances cannot collide. Set `INSTANCE_ID` in each config directory to the
same value as that directory's key in the `instances` map; it also namespaces
the Pub/Sub notification topic and associates the deployment with its transfer
config.

## Provisioning

The kit wires `upsertTransferConfig` to both `afterFirstDeploy` and
`afterRedeploy`. The lifecycle task creates the Pub/Sub topic and scheduled
query on first deploy, then reconciles supported query, table, schedule,
dataset, partitioning, and topic changes on later deploys. It retries transient
failures up to five times with at least 30 seconds of backoff.

Set `TRANSFER_CONFIG_NAME` to link an existing scheduled-query config. The kit
points that config's completion notifications at this instance's topic, which
it needs to read the run output, and changes nothing else: the query, schedule,
destination, and display name stay as they are. Otherwise the kit stores
`extInstanceId` on the Firestore config document and uses that value to find
the config on later deploys. BigQuery DTS does not support clearing a
partitioning field once set; create a new transfer config to remove
partitioning.

## Firestore layout

For a transfer config `{configId}` and run `{runId}`, the kit writes:

```text
transferConfigs/{configId}
transferConfigs/{configId}/runs/{runId}
transferConfigs/{configId}/runs/{runId}/output/{rowId}
transferConfigs/{configId}/runs/latest
```

The run document stores DTS metadata and row counts. Its `output` subcollection
contains converted query rows. The `latest` document is updated transactionally
so an older completion message cannot replace a newer run.

## API surface

- **Main entry** (`@firebase/bigquery-firestore-export`): exports
  `processMessages` and `upsertTransferConfig`, registers first-deploy and
  redeploy lifecycle hooks, and resolves runtime dependencies lazily. Use this
  entry from Firebase deploy/emulator/runtime.
- **Library entry** (`./lib`): side-effect-free config helpers, DTS helpers,
  injectable handlers, BigQuery-to-Firestore conversion helpers, and public
  message/config types for consumers that own trigger registration.

## License

Apache-2.0
