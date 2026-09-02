# @firebase-function-kits/bigquery-firestore-export

Schedule a BigQuery query and write each run's rows and metadata to Firestore.
This is the Export BigQuery to Firestore Firebase Extension as an npm package
you add to your own Firebase Functions codebase and deploy.

The kit creates or reconciles a BigQuery Data Transfer scheduled query, listens
for its Pub/Sub completion notifications, reads the destination table, and
writes the rows to Firestore. The functions run in your own Firebase project;
there is no hosted version, so you deploy them yourself.

## Install

```sh
npm install @firebase-function-kits/bigquery-firestore-export
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
} from "@firebase-function-kits/bigquery-firestore-export";
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

Without `TRANSFER_CONFIG_NAME` the kit stores `extInstanceId` on the Firestore
config document and uses that value to find its own config on later deploys.
BigQuery DTS does not support clearing a partitioning field once set; create a
new transfer config to remove partitioning.

### Linking an existing scheduled query

Set `TRANSFER_CONFIG_NAME` to link an existing scheduled-query config. The kit
needs that config's completion notifications to read its run output, so it
repoints them at this instance's topic. The update is masked to
`notification_pubsub_topic` alone, so the query, schedule, destination, and
display name stay exactly as the config's owner set them.

Repointing the topic is a takeover, though. A config notifies one topic, so
whatever consumed the previous one stops receiving runs: no error on either
side, and nothing in the config's run history looks different. Removing this
instance does not put the old topic back either. The deploy that changes it logs
the previous value at warn, which is the only record of what to restore. Two
instances linking the same config fail the same way, with the last deploy
winning and the earlier instance going quiet.

Linking also assumes the config is shaped the way the kit builds its own:

- Its destination table template is `<name>_{run_time|"%H%M%S"}`. `processMessages`
  substitutes that exact placeholder to work out which table a finished run
  wrote to.
- It lives in this project. The results query is built from `PROJECT_ID`, not
  from the run notification.
- Its destination dataset is in `BIGQUERY_DATASET_LOCATION`.

A config outside that shape surfaces as a BigQuery table-not-found inside
`processMessages` rather than as anything naming the mismatch, and
`processMessages` retries, so it repeats instead of failing once. That shape is
the only supported one.

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

## Differences from the Export BigQuery to Firestore extension

This kit is version 0.2.2 of the extension repackaged as an npm package. It is a
close port: the same two functions, the same BigQuery Data Transfer scheduled
query, the same `transferConfigs/{configId}/runs/{runId}` and `runs/latest`
documents, the same `WRITE_TRUNCATE` destination table naming and the same
row-by-row copy into Firestore. Every setting keeps its extension environment
variable name and default, so a `.env` copied from your installed instance needs
no value changes. What changes is the instance id, the Pub/Sub topic, the identity
the scheduled query runs as, and how repeated BigQuery columns land in Firestore.

### You set `INSTANCE_ID` yourself, and the Pub/Sub topic is renamed

The extension derived an instance id at install and used it to name its
notification topic (`ext-<instance id>-processMessages`) and to tag its transfer
config document with `extInstanceId`. Here `INSTANCE_ID` is a setting you
provide, and it must match this instance's key in the `instances` map in
`firebase.json`.

The topic becomes `kit-<INSTANCE_ID>-processMessages`, and the kit creates it on
first run if it does not already exist. Set `INSTANCE_ID` to your installed
instance's id if you want the kit to adopt the scheduled query that instance
created, because the lookup is by `extInstanceId` on the documents in
`COLLECTION_PATH`. With a different id the kit finds nothing, creates a second
scheduled query, and you end up with two writing into the same collection.

The existing transfer config still points its notifications at the old `ext-`
topic; the kit's update path rewrites `notification_pubsub_topic` to the new one
on the first deploy, so the old topic can be deleted afterwards.

### Repeated BigQuery columns are now written as arrays

A repeated (`ARRAY`) column used to arrive in Firestore as a map keyed by
position, `{ "0": ..., "1": ... }`, because the conversion treated every
non-scalar value as an object. The kit writes a real Firestore array instead.
Anything reading those fields by numeric string key needs updating, and rows
written before and after the change are not the same shape. Scalars, timestamps,
dates, times, datetimes, bytes and geography values convert exactly as before.

### The scheduled query runs as a different service account

The extension created the transfer config with
`serviceAccountName: ext-<instance id>@<project>.iam.gserviceaccount.com`, so the
query ran as the extension's own service account. The kit creates it without a
service account name, so BigQuery Data Transfer runs it as the identity that
created it, which is your function's runtime service account (the default compute
service account unless you have set one).

That account needs to be able to read whatever `QUERY_STRING` touches and write
to `DATASET_ID`. `roles/bigquery.admin` on the function covers this for datasets
in the same project; a cross-project query needs the grant made explicitly. This
was not exercised against a live deploy.

Note also that a service account cannot be changed on an existing transfer config,
so a scheduled query originally created by an installed extension instance keeps
running as the extension's service account even after the kit adopts it. Delete
and recreate the scheduled query if you want it moved.

### The setup step runs on every deploy

The install, update and configure hooks are replaced by an `upsertTransferConfig`
task that the CLI runs after your first deploy and after every redeploy. It does
the same work: create the scheduled query if this instance has none, otherwise
reconcile the existing one against your current `QUERY_STRING`, `DATASET_ID`,
`TABLE_NAME`, `PARTITIONING_FIELD` and `SCHEDULE`.

Two consequences of it now being an ordinary task rather than a lifecycle event.
There is no install UI to report progress into, so failures show up in the task's
function logs, and the task retries up to five times with a 30 second minimum
backoff. And `DISPLAY_NAME` is no longer immutable, but changing it does not
rename an existing scheduled query, because display name is not part of the
update; it only applies to a config the kit creates.

Removing `PARTITIONING_FIELD` once it has been set still fails, with the same
explanation, because the BigQuery Data Transfer API cannot clear it.

### You can link an existing scheduled query

`TRANSFER_CONFIG_NAME` is a new setting. Point it at the full resource name of a
scheduled query you already have
(`projects/<project>/locations/<location>/transferConfigs/<id>`) and the kit
records that config in Firestore and consumes its notifications instead of
creating one of its own. The extension carried the code for this but no setting to
reach it. Leave it empty for the create-or-reconcile behaviour described above.

### Region, and no location setting

`LOCATION` is gone. Both functions deploy to your codebase's default region
(`us-central1` unless you have changed it) rather than the immutable location you
picked at install. `BIGQUERY_DATASET_LOCATION` is unchanged and still tells the
result query where your dataset lives.

### Failed notifications are retried

`processMessages` is a 2nd gen Pub/Sub function with retries enabled, where the
extension's 1st gen trigger did not retry. A run whose results fail to copy, for
example because BigQuery or Firestore is briefly unavailable, is now retried
rather than dropped. A notification that keeps failing, such as one for a transfer
config not tagged with this `INSTANCE_ID`, is also retried until Pub/Sub gives up.

Both functions' service accounts need `roles/eventarc.eventReceiver` and
`roles/run.invoker` on top of the three roles the extension asked for, and the
Pub/Sub API is now requested explicitly. The Firebase CLI handles all of this.

### Unchanged

- `COLLECTION_PATH` still defaults to `transferConfigs`, and the document layout
  under it is identical: the transfer config document keyed by config id, a `runs`
  subcollection keyed by run id holding `runMetadata`, `totalRowCount` and
  `failedRowCount`, a `latest` document, and an `output` collection of rows per
  run.
- The destination table is still `TABLE_NAME_{run_time|"%H%M%S"}` with
  `WRITE_TRUNCATE`, and results are still read with `SELECT *` in
  `BIGQUERY_DATASET_LOCATION`.
- Runs that do not succeed still write a run document with zeroed counts and still
  update `latest`, and `latest` is still only moved forward by a newer run.
- Rows are still written one document at a time in chunks of 10,000, with
  per-row failures logged and counted rather than aborting the run.
- `LOG_LEVEL` still accepts `debug`, `info`, `warn`, `error` and `silent`.

## API surface

- **Main entry** (`@firebase-function-kits/bigquery-firestore-export`): exports
  `processMessages` and `upsertTransferConfig`, registers first-deploy and
  redeploy lifecycle hooks, and resolves runtime dependencies lazily. Use this
  entry from Firebase deploy/emulator/runtime.
- **Library entry** (`./lib`): side-effect-free config helpers, DTS helpers,
  injectable handlers, BigQuery-to-Firestore conversion helpers, and public
  message/config types for consumers that own trigger registration.

## License

Apache-2.0
