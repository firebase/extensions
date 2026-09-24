# @firebase-function-kits/firestore-bigquery-export

Stream a Cloud Firestore collection to BigQuery. This is the Stream Firestore to
BigQuery Firebase Extension as an npm package you add to your own Firebase
Functions codebase and deploy.

Each document write is serialized and inserted into a BigQuery changelog table.
Failed writes buffer through a Cloud Tasks queue (`syncBigQuery`) and are
retried.

Terms used below: a **codebase** is a directory of Cloud Functions source the
Firebase CLI deploys as a unit. A **kit** is this package declared by a `kit`
entry in `firebase.json`. An **instance** is one configured copy of the kit,
with its own `.env` and four functions; the CLI deploys each instance as a
codebase named after its instance id.

## Install

You need a Firebase project on the Blaze plan with Cloud Firestore, Node.js 24
(22 or later is supported), and the latest Firebase CLI (15.28.0 at minimum)
with the `kits` experiment:

```sh
npm install -g firebase-tools@latest
firebase login
firebase experiments:enable kits
echo '{}' > firebase.json   # firebase use needs a firebase.json
firebase use --add <project-id> --alias default
```

> Until the first stable release, install from the `next` tag. `latest` points
> at 0.0.1, an empty placeholder.

**Guided installer.** This creates the codebase under `function-kits/<kit-name>/`,
adds the `kit` entry to `firebase.json`, and prompts for each setting, writing
the answers to `function-kits/<kit-name>/config-<instance-id>/.env.<project-id>`:

```sh
firebase functions:kits:install --package @firebase-function-kits/firestore-bigquery-export@next
```

It also asks for `FUNCTION_DEFAULT_REGION`. Enter the region your functions
will run in (`us-central1` for `nam5`; see [Region](#region)).

**Your own codebase.** Install the kit plus `firebase-functions` and
`firebase-admin` as direct dependencies, on the major versions the kit uses
(currently 7 and 14). The kit's shrinkwrap nests its own copies, which the CLI
can't see: without them the deploy fails with `Couldn't find firebase-functions
package in your source code`.

```sh
npm install @firebase-function-kits/firestore-bigquery-export@next firebase-functions@latest firebase-admin@latest
npm install --save-dev typescript@latest
```

## Required IAM

Nothing to do by hand. On the first deploy the CLI asks you to confirm these
roles (`This codebase uses declarative security … Continue? (y/N)`), then
creates a service account for the kit, grants them, and enables the APIs. Don't
set a custom runtime service account.

| Role / API                     | Why                                                          |
| ------------------------------ | ------------------------------------------------------------ |
| `roles/bigquery.dataEditor`    | create the dataset, table and views; insert rows             |
| `roles/bigquery.user`          | run BigQuery jobs and materialized views                     |
| `roles/datastore.user`         | write failed rows to `BACKUP_COLLECTION` (always granted)    |
| `roles/eventarc.eventReceiver` | receive Firestore trigger events                             |
| `roles/run.invoker`            | let Eventarc and Cloud Tasks invoke the functions            |
| `roles/cloudtasks.enqueuer`    | enqueue failed writes onto `syncBigQuery`                    |
| `firestore.googleapis.com`     | receive document change events                               |
| `bigquery.googleapis.com`      | write to BigQuery                                            |

Setting `EVENTARC_CHANNEL` also adds `roles/eventarc.publisher` and
`eventarcpublishing.googleapis.com`. For a dataset in another project, grant
the kit's service account the `bigquery.*` roles there. For a CMEK dataset,
grant the BigQuery service account access to your KMS key.

## Usage

With your own codebase, this layout keeps the codebase and the instance's
`.env` at the project root:

```text
my-project/
  .firebaserc
  firebase.json
  package.json      # "main": "lib/index.js", "engines": { "node": "24" }, "scripts": { "build": "tsc" }
  tsconfig.json     # compiles src/ to lib/
  .env
  src/index.ts
```

```ts
// src/index.ts
export {
  fsexportbigquery, // Firestore trigger
  syncBigQuery, // retries failed writes from the queue
  initBigQuerySync, // creates BigQuery resources after the first deploy
  setupBigQuerySync, // updates them after later deploys
} from "@firebase-function-kits/firestore-bigquery-export";
```

```sh
# .env — set these before the first deploy
COLLECTION_PATH=users
TABLE_ID=users
DATABASE_REGION=europe-west2
BACKUP_COLLECTION=users_bigquery_failures
```

`COLLECTION_PATH` and `TABLE_ID` otherwise default to `posts`. Without
`BACKUP_COLLECTION`, rows that fail every retry are lost.

## Deploy

```json
{
  "functions": [
    {
      "source": ".",
      "kit": "firestore-bigquery-export",
      "instances": { "default": "." },
      "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"]
    }
  ]
}
```

`kit` is any name you choose (up to 40 lowercase letters, digits, `_`, `-`).
`instances` maps each instance id to the directory holding its `.env`. Function
names get a `kit-<instance-id>-` prefix, so this deploys
`kit-default-fsexportbigquery` and so on. Commands that take a codebase take
the instance id.

```sh
firebase deploy --only functions                 # all instances
firebase deploy --only functions:<instance-id>   # one instance
```

Deploy with Firebase CLI 15.28.0 or later: older versions don't set
`FIREBASE_KIT_INSTANCE_ID`, so enqueues fail, and don't read `.env` early enough
to place the functions.

**Check that it works.** The first deploy runs `initBigQuerySync`, which creates
the dataset with a `<TABLE_ID>_raw_changelog` table (one row per change) and a
`<TABLE_ID>_raw_latest` view (current state per document). Write a document,
then:

```sql
SELECT document_id, operation, data, timestamp
FROM `<project-id>.<DATASET_ID>.<TABLE_ID>_raw_changelog`
ORDER BY timestamp DESC LIMIT 10
```

At `LOG_LEVEL=info`, each write logs `Firestore event received by
onDocumentWritten trigger` (`firebase functions:log --only
kit-<instance-id>-fsexportbigquery`).

## Configuration

Settings go in the instance's `.env` (or `.env.<project-id>`). A deploy prompts
for every unset setting and saves the answers to `.env.<project-id>`. Settings
marked † fail the deploy if present but blank: omit the line to get the
default.

| Env var                             | Default            | Description                                                         |
| ----------------------------------- | ------------------ | ------------------------------------------------------------------- |
| `DATABASE_REGION` (required)        | (prompted)         | Firestore database location; also places the functions             |
| `COLLECTION_PATH` †                 | `posts`            | Collection or collection-group path to export                      |
| `DATASET_ID` †                      | `firestore_export` | BigQuery dataset                                                    |
| `TABLE_ID` †                        | `posts`            | Prefix of the changelog table and view                              |
| `DATASET_LOCATION` †                | `us`               | Dataset location; used only when the dataset is created            |
| `DATABASE` †                        | `(default)`        | Firestore database id                                               |
| `BIGQUERY_PROJECT_ID` †             | project id         | Dataset project, if different                                       |
| `BACKUP_COLLECTION`                 | (empty)            | Firestore collection for rows whose insert failed. Recommended.     |
| `MAX_DISPATCHES_PER_SECOND`         | `100`              | `syncBigQuery` dispatch rate (1-500)                                |
| `MAX_ENQUEUE_ATTEMPTS`              | `3`                | Enqueue attempts before giving up (1-10)                            |
| `TRANSFORM_FUNCTION`                | (empty)            | URL of an HTTP function that transforms rows before insert          |
| `TABLE_PARTITIONING`                | `NONE`             | `HOUR`, `DAY`, `MONTH`, `YEAR` or `NONE`                            |
| `TIME_PARTITIONING_FIELD`           | (empty)            | Partitioning column name                                            |
| `TIME_PARTITIONING_FIELD_TYPE`      | `omit`             | `TIMESTAMP`, `DATETIME`, `DATE` or `omit`                           |
| `TIME_PARTITIONING_FIRESTORE_FIELD` | (empty)            | Firestore field to partition on                                     |
| `CLUSTERING`                        | (empty)            | Up to 4 comma-separated columns, e.g. `data,document_id,timestamp`  |
| `WILDCARD_IDS`                      | `false`            | Store path-param values as columns                                  |
| `USE_NEW_SNAPSHOT_QUERY_SYNTAX` †   | `no`               | `yes` / `no`                                                        |
| `EXCLUDE_OLD_DATA`                  | `no`               | Skip the previous document state on updates (`yes` / `no`)          |
| `VIEW_TYPE` †                       | `view`             | `view`, `materialized_incremental`, `materialized_non_incremental`  |
| `MAX_STALENESS`                     | (empty)            | Materialized views: e.g. `INTERVAL "8:0:0" HOUR TO SECOND`          |
| `REFRESH_INTERVAL_MINUTES`          | (empty)            | Materialized views: refresh interval in minutes                     |
| `KMS_KEY_NAME`                      | (empty)            | `projects/<p>/locations/<l>/keyRings/<r>/cryptoKeys/<k>`            |
| `LOG_LEVEL` †                       | `info`             | `debug`, `info`, `warn`, `error`, `silent`                          |
| `EVENTARC_CHANNEL`                  | (unset)            | Channel for lifecycle events; unset or blank disables events        |
| `EXT_SELECTED_EVENTS`               | (unset)            | Event types to publish; unset publishes all, blank publishes none   |

## Multiple instances

Add one entry per instance, each with its own config directory and `.env`.
Instance ids must be unique across the project.

```json
"instances": { "users": "instances/users", "orders": "instances/orders" }
```

## Events

With `EVENTARC_CHANNEL` set, the functions publish `onStart` and `onError` from
the trigger and `onSuccess` from `syncBigQuery`. Each event is published under
both `firebase.extensions.firestore-bigquery-export.v1.*` and the extension's
legacy `firebase.extensions.firestore-counter.v1.*`; write new triggers against
the first. `EXT_SELECTED_EVENTS` filters by exact type, legacy copies included.
A config exported from the extension carries its `EXT_SELECTED_EVENTS` over, so
check it lists what you expect.

## Provisioning

`initBigQuerySync` runs after the first deploy and `setupBigQuerySync` after
later ones, creating or updating the dataset, table and view (15 attempts, 60s
backoff). A redeploy with no changes is skipped, and so is
`setupBigQuerySync`. Writes never create resources: if they're missing, writes
fail into the queue and backup collection until a lifecycle task runs.

To run one by hand, from your codebase directory with `firebase-admin`
installed, application-default credentials (`gcloud auth
application-default login`) and `roles/cloudtasks.enqueuer`:

```sh
export GOOGLE_CLOUD_PROJECT=<project-id> FUNCTION_REGION=us-central1
node -e '
const { initializeApp } = require("firebase-admin/app");
const { getFunctions } = require("firebase-admin/functions");
initializeApp();
getFunctions()
  .taskQueue("locations/'"$FUNCTION_REGION"'/functions/kit-<instance-id>-setupBigQuerySync")
  .enqueue({})
  .then(() => console.log("enqueued"));
'
```

## Failure handling

1. The trigger inserts the row inline. If that fails, the row is written to
   `BACKUP_COLLECTION` (when set) and the change is enqueued on `syncBigQuery`.
2. `syncBigQuery` retries 5 times with 60s minimum backoff, writing to
   `BACKUP_COLLECTION` after each failure. Then the task is dropped.
3. If the enqueue also fails, the trigger logs an error, publishes `onError`
   and gives up. The event isn't redelivered.

Backup documents are keyed by event id, with the changelog columns under
`json`. Some are left by failures that later succeeded, so merge them back with
an anti-join on `event_id`:

```sql
MERGE `<project-id>.<dataset>.<table>_raw_changelog` AS target
USING `<project-id>.<dataset>.<backup-temp-table>` AS backup
ON target.event_id = backup.event_id
WHEN NOT MATCHED THEN
  INSERT (timestamp, event_id, document_name, document_id, operation, data, old_data)
  VALUES (backup.timestamp, backup.event_id, backup.document_name,
          backup.document_id, backup.operation, backup.data, backup.old_data)
```

Limits, all shared with the extension:

- Failures before the insert (for example a broken `TRANSFORM_FUNCTION`) aren't
  backed up.
- Changes over 1 MB can't be enqueued. `EXCLUDE_OLD_DATA=yes` halves update
  payloads.
- The changelog can contain duplicate `event_id`s; the latest view is
  unaffected.
- Deleting or moving the functions leaves their Cloud Tasks queues behind as
  `DISABLED`.

## Migrating from the extension

`firebase ext:migrate` deploys the kit, then uninstalls the extension. Writes
made while the new trigger warms up can reach neither exporter. To avoid the
gap, answer no to the final uninstall prompt, confirm the kit logs every write
(see [Check that it works](#deploy)), then uninstall:

```sh
firebase ext:uninstall <instance-id> --project <project-id> --immediate
```

Running both at once is safe: BigQuery deduplicates on the shared event id
(best effort), and the latest view is unaffected by any duplicate.

To recover writes already missed, re-import with
[`fs-bq-import-collection`](https://github.com/firebase/extensions/blob/master/firestore-bigquery-export/guides/IMPORT_EXISTING_DOCUMENTS.md),
pointed at the kit's dataset and table prefix, while writes are paused. It
imports every document's current value as an `IMPORT` row; deletes and
superseded updates can't be recovered.

## Differences from the Stream Firestore to BigQuery extension

- **Region.** The extension's install-time Cloud Functions location is gone.
  See [Region](#region).
- **`DATASET_LOCATION` can change**, but only takes effect when a dataset is
  created. To move, set a new `DATASET_ID` too, then backfill.
- **No companion tools.** `fs-bq-import-collection`, `gen-schema-view` and the
  cross-project grant scripts stay in the extension repository and work on the
  kit's tables.
- **A failed `onStart` publish** only logs a warning; the extension failed the
  execution.
- **Same runtime settings.** Concurrency 1, extension-sized CPU, internal-only
  trigger ingress, 540s task timeouts, 100 trigger instances and 500 for
  `syncBigQuery` (about 84 vCPU of regional Cloud Run quota). Raise
  `setGlobalOptions({ maxInstances })` for more trigger throughput.
- **`ext:migrate` carries global options.** Its generated entry file applies the
  extension's memory, timeout, ingress and instance limits through
  `setGlobalOptions`, wherever a function doesn't set its own. Check the
  `EXT_MIGRATED_SYSTEM_*` values in `.env`.

### Region

Functions deploy to the region derived from `DATABASE_REGION`: regional
locations as-is, `nam5` and `nam7` to `us-central1`, `eur3` to `europe-west1`.
The trigger still fires in the database's region. Set `DATABASE_REGION` in
`.env` before the first deploy; a value given at the deploy prompt only applies
from the next deploy.

With `DATABASE_REGION=` left blank, functions go to `FUNCTION_DEFAULT_REGION`
in installer- or migrate-generated codebases, and otherwise to `us-central1`
(or their current region). Changing region deletes and recreates the functions
and their queue.

## API surface

- **Main entry** (`@firebase-function-kits/firestore-bigquery-export`): the
  four functions, the lifecycle hooks, and everything from the library entry.
- **Library entry** (`@firebase-function-kits/firestore-bigquery-export/lib`):
  `handleDocumentWrite` and `handleSyncBigQueryTask` for registering triggers
  yourself, plus `ExportConfig`, `ResolvedExportConfig`, `resolveExportConfig`,
  `toTrackerConfig`, `ViewType`, `DocumentWriteEvent`, `HandlerContext`,
  `SerializedDocumentChange` and `ChangeType`.

## License

Apache-2.0
