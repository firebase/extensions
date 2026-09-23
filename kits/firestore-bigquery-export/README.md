# @firebase-function-kits/firestore-bigquery-export

Stream a Cloud Firestore collection to BigQuery. This is the Stream Firestore to
BigQuery Firebase Extension as an npm package you add to your own Firebase
Functions codebase and deploy.

It listens for document writes on a collection, serializes each change, and
writes it to a BigQuery changelog table. Failed writes buffer through a Cloud
Tasks queue (`syncBigQuery`), which retries them on its own throttled schedule.
The functions run in your own Firebase project; there is no hosted version, so
you deploy them yourself.

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

| Role / API                     | Why                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| `roles/bigquery.dataEditor`    | create dataset/table/views; insert rows                                                    |
| `roles/bigquery.user`          | run BigQuery jobs and materialized views                                                   |
| `roles/datastore.user`         | write failed-row records back to Firestore (only if you configure a backup collection)     |
| `roles/eventarc.eventReceiver` | receive Gen2 Firestore trigger events                                                      |
| `roles/run.invoker`            | allow Eventarc to invoke the Gen2 Cloud Run service, and Cloud Tasks to dispatch to the three task-queue functions, which have no function-level invoker binding |
| `roles/cloudtasks.enqueuer`    | enqueue failed writes onto the kit's own `syncBigQuery` task queue                         |
| `firestore.googleapis.com`     | receive document change events from Cloud Firestore                                        |
| `bigquery.googleapis.com`      | mirror Firestore collection changes in BigQuery                                            |

Only when `EVENTARC_CHANNEL` is set in `.env` (see Events), the deploy also
declares `roles/eventarc.publisher` and `eventarcpublishing.googleapis.com`,
which the Extensions platform granted implicitly to installs that opted into
events. A default install declares neither, so nothing prompts you to enable
the Eventarc Publishing API.

If the dataset lives in a different project (`BIGQUERY_PROJECT_ID`), grant the
managed runtime service account the `bigquery.*` roles on that project. For a
CMEK dataset, also grant the BigQuery service account access to your KMS key.

## Usage

Spread the kit's `defaultOptions` into your codebase's single
`setGlobalOptions` call, then export the four functions from your functions
codebase entry. `setGlobalOptions` must run before the kit module loads,
because the kit reads the global options when it defines its functions. A
TypeScript entry compiled to CommonJS runs its statements in order, so this
works:

```ts
// functions/src/index.ts
import { setGlobalOptions } from "firebase-functions";
import { defaultOptions } from "@firebase-function-kits/firestore-bigquery-export/default-options";

setGlobalOptions({ ...defaultOptions });

export {
  fsexportbigquery,
  syncBigQuery,
  initBigQuerySync,
  setupBigQuerySync,
} from "@firebase-function-kits/firestore-bigquery-export";
```

In an ES module entry (`"type": "module"`, or TypeScript emitting ES modules),
Node loads every `import` and `export ... from` before any statement in the
file runs, so the kit loads before `setGlobalOptions` and your functions
deploy at 1 vCPU and concurrency `80`. Call `setGlobalOptions` in its
own module and import that module first:

```js
// functions/options.js
import { setGlobalOptions } from "firebase-functions";
import { defaultOptions } from "@firebase-function-kits/firestore-bigquery-export/default-options";

setGlobalOptions({ ...defaultOptions });
```

```js
// functions/index.js
import "./options.js";
export * from "@firebase-function-kits/firestore-bigquery-export";
```

If the global options set no `cpu` when the kit loads, deploy logs a warning
that `defaultOptions` was not applied.

and configure them with a `.env` (or `.env.<projectId>`):

```sh
COLLECTION_PATH=users
DATASET_ID=analytics
TABLE_ID=users
DATABASE_REGION=europe-west2
```

- `fsexportbigquery` is the Firestore trigger.
- `syncBigQuery` is the write-buffer task queue that retries failed writes.
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
deploy as `kit-default-fsexportbigquery`, `kit-default-syncBigQuery`,
`kit-default-initBigQuerySync`, and `kit-default-setupBigQuerySync`.

Deploy with Firebase CLI 15.28.0 or later: it sets the
`FIREBASE_KIT_INSTANCE_ID` env var on the deployed functions, which the trigger
needs to address its own `syncBigQuery` queue. On functions deployed with an
older CLI, enqueues fail (logged at error level and published as an `onError`
event; the event is dropped, as in the extension) until you redeploy with a
newer CLI.

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
| `datasetLocation`                | `DATASET_LOCATION`                  | no       | `us`               | BigQuery dataset location, used only when the dataset is created   |
| `database`                       | `DATABASE`                          | no       | `(default)`        | Firestore database id                                              |
| `bigqueryProjectId`              | `BIGQUERY_PROJECT_ID`               | no       | project id         | Dataset project, if different                                      |
| `backupCollection`               | `BACKUP_COLLECTION`                 | no       | (empty)            | Strongly recommended: collection for rows whose BigQuery insert failed |
| `maxDispatchesPerSecond`         | `MAX_DISPATCHES_PER_SECOND`         | no       | `100`              | `syncBigQuery` queue dispatch rate (1-500)                         |
| `maxEnqueueAttempts`             | `MAX_ENQUEUE_ATTEMPTS`              | no       | `3`                | In-process enqueue attempts before giving up (1-10)                |
| `transformFunction`              | `TRANSFORM_FUNCTION`                | no       | (empty)            | Optional transform Cloud Function                                  |
| `tablePartitioning`              | `TABLE_PARTITIONING`                | no       | `NONE`             | Table partitioning strategy                                        |
| `timePartitioningField`          | `TIME_PARTITIONING_FIELD`           | no       | (empty)            | Time-partitioning column name                                      |
| `timePartitioningFieldType`      | `TIME_PARTITIONING_FIELD_TYPE`      | no       | `omit`             | Time-partitioning field type                                       |
| `timePartitioningFirestoreField` | `TIME_PARTITIONING_FIRESTORE_FIELD` | no       | (empty)            | Firestore field for partitioning                                   |
| `clustering`                     | `CLUSTERING`                        | no       | (empty)            | Clustering columns (max 4)                                         |
| `wildcardIds`                    | `WILDCARD_IDS`                      | no       | `false`            | Store path-param values as columns                                 |
| `useNewSnapshotQuerySyntax`      | `USE_NEW_SNAPSHOT_QUERY_SYNTAX`     | no       | `no`               | Use newer snapshot query syntax (`yes` / `no`)                     |
| `excludeOldData`                 | `EXCLUDE_OLD_DATA`                  | no       | `no`               | Skip previous document state on updates (`yes` / `no`)             |
| `viewType`                       | `VIEW_TYPE`                         | no       | `view`             | `view`, `materialized_incremental`, `materialized_non_incremental` |
| `maxStaleness`                   | `MAX_STALENESS`                     | no       | (empty)            | Materialized view max staleness                                    |
| `refreshIntervalMinutes`         | `REFRESH_INTERVAL_MINUTES`          | no       | (empty)            | Materialized view refresh interval                                 |
| `kmsKeyName`                     | `KMS_KEY_NAME`                      | no       | (empty)            | CMEK key for the dataset                                           |
| `logLevel`                       | `LOG_LEVEL`                         | no       | `info`             | `debug`, `info`, `warn`, `error`, `silent`                         |
| (env only)                       | `EVENTARC_CHANNEL`                  | no       | (empty)            | Eventarc channel to publish lifecycle events on; unset disables events |
| (env only)                       | `EXT_SELECTED_EVENTS`               | no       | (empty)            | Comma-separated allowlist of event types to publish (see Events)    |

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

When `EVENTARC_CHANNEL` is configured, the functions publish lifecycle events:
`onStart` and `onError` from the write path, and `onSuccess` from the
`syncBigQuery` task when a buffered write lands (matching the extension, which
only emitted `onSuccess` from its queue handler). A blank value is the same as
an unset one: no channel is opened and nothing is published.

Setting `EVENTARC_CHANNEL` also makes the deploy declare
`eventarcpublishing.googleapis.com` and `roles/eventarc.publisher`: the CLI
grants the role and prompts to enable the API, and declining that prompt
aborts the deploy. That needs firebase-tools 15.28.0 or later, which loads
`.env` during deploy discovery; on an older CLI the declarations are skipped
and every publish fails with `PERMISSION_DENIED`, logged as a warning while
the export itself continues. The API and role summary printed by
`firebase functions:kits:install` and `firebase ext:migrate` runs discovery
without your `.env`, so it does not list either even when `ext:migrate` has
just written `EVENTARC_CHANNEL`; the deploy declares them regardless.

Each event is published twice, exactly as the extension published it: once
under `firebase.extensions.firestore-bigquery-export.v1.*` and once under
`firebase.extensions.firestore-counter.v1.*`. The `firestore-counter` type is a
historical naming mistake the extension kept for backwards compatibility, and
the kit keeps it for the same reason: triggers listening on it survive the
migration. The two copies carry the same `data` and `subject`, and only differ
by `type`. Write new triggers against the `firestore-bigquery-export` types.

Publishing is filtered by `EXT_SELECTED_EVENTS`: the value is split on commas
and only exactly matching event types are published, silently. An empty value
suppresses every event, and a value carrying only another product's types
(the extension offered more than one namespace to tick) publishes nothing. A
config exported from the extension brings its `EXT_SELECTED_EVENTS` along, so
check it lists the types you expect, `onSuccess` included. It gates the legacy
`firestore-counter` copies too, so a trigger on a legacy type only fires when
that legacy type is listed.

## Provisioning

The BigQuery dataset, table, and views are created by `tracker.initialize()`
through the shared provisioning path used by both task functions. Both tasks
are idempotent and retry on transient BigQuery failures (up to 15 attempts,
60s minimum backoff).

Deploy wiring (declared in the package):

- First deploy runs `initBigQuerySync` automatically (`afterFirstDeploy`).
- Later deploys run `setupBigQuerySync` automatically (`afterRedeploy`).

The `afterRedeploy` hook only runs when the deploy actually updates the
functions. If nothing changed since the last deploy, the CLI skips the codebase
(`No resources modified for codebase: <id>. Skipping afterRedeploy lifecycle
hook.`) and `setupBigQuerySync` does not run. To force it, either change any
value in the instance's `.env` file and redeploy, or enqueue the task manually
as shown below, substituting `setupBigQuerySync` into the snippet.

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
missing when a write arrives, the inline write fails and the change buffers
through the `syncBigQuery` queue, which re-attempts the write on Cloud Tasks'
schedule. The queue handler does not provision, as in the extension: if the
resources are still missing the retries fail and the row lands in
`BACKUP_COLLECTION`; run the lifecycle task to recreate them, either by
enqueueing `setupBigQuerySync` manually (see above) or by redeploying with a
config change so the deploy is not skipped.

## Failure handling

The write path mirrors the extension's Cloud Tasks buffer:

1. The trigger attempts the BigQuery insert inline. On success, done.
2. On failure, it enqueues the serialized change onto the `syncBigQuery` queue
   (up to `MAX_ENQUEUE_ATTEMPTS` in-process attempts with backoff, keyed by
   event id so a retried enqueue cannot buffer the same event twice) and the
   execution succeeds. The trigger declares no retry policy, as in the
   extension: a failure _before_ the write is attempted (serializing the
   change, publishing the `onStart` event) fails the execution once and the
   event is not redelivered.
3. `syncBigQuery` re-attempts the write on the queue's schedule: 5 attempts,
   60 seconds minimum backoff, throttled to `MAX_DISPATCHES_PER_SECOND`
   dispatches per second (500 concurrent max).
4. On every terminal insert failure the tracker writes the row to
   `BACKUP_COLLECTION` (when configured), keyed by the event id, before the
   task fails. After the fifth attempt the task is dropped. **Without a backup collection, the row is dropped with the task** -
   configure `BACKUP_COLLECTION`. A task refused with a Cloud Run 429 at the
   instance ceiling on every attempt never ran the handler, so it is dropped
   with no backup row either way (see
   [Concurrency, CPU and timeouts](#concurrency-cpu-and-timeouts-match-the-extension)).
5. If the enqueue itself fails (BigQuery AND Cloud Tasks both failing), the
   trigger logs at error level, publishes an `onError` event, and the
   execution succeeds: the event is dropped, exactly as the extension did in
   this window.

### Recovering parked rows

Rows in `BACKUP_COLLECTION` are changelog-shaped documents, not plain document
snapshots, so `fs-bq-import-collection` cannot consume them. Treat them as
"possibly failed": a transient failure that later succeeded on retry also
leaves one behind, and nothing cleans them up. To recover after an outage,
load the backup docs into a temp table and `MERGE` them into the changelog
table with a `WHEN NOT MATCHED` condition on `event_id` (the anti-join is
mandatory because of those stale rows).

Each backup document is keyed by the event id and shaped like the streaming
insert row the tracker sent, plus the error:

```json
{
  "insertId": "<event id>",
  "json": {
    "timestamp": "...",
    "event_id": "<event id>",
    "document_name": "...",
    "document_id": "...",
    "operation": "CREATE",
    "data": "<JSON string>",
    "old_data": "<JSON string or null>",
    "path_params": "<JSON string, only with WILDCARD_IDS>"
  },
  "error_details": "..."
}
```

The changelog columns sit under `json`, not at the top level. Load the `json`
objects of the backup documents into a temp table with the changelog's schema
(for example by exporting the collection and running `bq load` on the `json`
field), then:

```sql
MERGE `<project>.<dataset>.<table>_raw_changelog` AS target
USING `<project>.<dataset>.<temp table>` AS backup
ON target.event_id = backup.event_id
WHEN NOT MATCHED THEN
  INSERT (timestamp, event_id, document_name, document_id, operation, data, old_data)
  VALUES (backup.timestamp, backup.event_id, backup.document_name,
          backup.document_id, backup.operation, backup.data, backup.old_data)
```

Add `path_params` and any partition column to both lists if your table has
them.

### Known limits

- A task queue is a project-level resource created for each task function.
  Deleting the functions (or moving them to another region) disables the old
  queue rather than removing it; it shows as `DISABLED` in the Cloud Tasks
  console until you delete it there.
- A row whose insert still fails on the last queue attempt with no
  `BACKUP_COLLECTION` configured is gone. This matches the extension; it is
  the reason the backup collection is strongly recommended.
- The changelog can carry a duplicate `event_id`. BigQuery's `insertId`
  dedupe on streaming inserts is best effort for about a minute and the
  queue's minimum backoff is 60 seconds, so an insert that landed but reported
  an error can be written again by the retry. The `_raw_latest` view keys on
  `document_name` and takes the newest change, so duplicates do not affect it;
  the `MERGE` above assumes them.
- `BACKUP_COLLECTION` captures rows whose BigQuery insert fails. A failure
  earlier in the tracker, such as a `TRANSFORM_FUNCTION` endpoint that is down
  or returns malformed JSON, throws before the insert and is not backed up.
  Same as the extension.
- A change whose serialized payload exceeds the Cloud Tasks task size limit
  (1 MB) cannot be enqueued: the row is logged and dropped, and never reaches
  `BACKUP_COLLECTION`. An update carries both `data` and `old_data`, so large
  documents get there first; `EXCLUDE_OLD_DATA=yes` halves the payload. Same as
  the extension.

## Migrating from the extension

### Avoiding the cutover gap

`firebase ext:migrate` deploys the kit and then uninstalls the extension. The
extension's trigger stops delivering as it is uninstalled, while the kit's
trigger is newly created and takes a few minutes to deliver reliably, so writes
made in between can reach neither exporter. Those writes are never seen by a
function, so they appear in neither the changelog nor `BACKUP_COLLECTION`, and
the command reports no error.

To migrate without that gap, keep both exporters running until the kit is
confirmed to be working.

Run `ext:migrate` without `--force` and answer no when it asks whether to
uninstall the extension. That question comes last, after the kit has deployed.
The prompts before it cover the migration and the kit installation, so
declining one of those aborts the migration instead.

Both exporters are now live, each logging under its own function name:
`ext-<instance-id>-fsexportbigquery` for the extension and
`kit-<instance-id>-fsexportbigquery` for the kit. Follow the kit's:

```shell
firebase functions:log --only kit-<instance-id>-fsexportbigquery --project <project-id>
```

At the default `LOG_LEVEL` of `info`, each delivered write logs `Firestore
event received by onDocumentWritten trigger` with the document name; `warn` and
above suppress that line. Write to the collection and confirm the kit records
every write rather than an intermittent few. A newly created trigger commonly
needs several minutes to reach that point. Then uninstall the extension:

```shell
firebase ext:uninstall <instance-id> --project <project-id> --immediate
```

Running both exporters together is safe. Both triggers receive the same event
id, and the changelog row carries it as its BigQuery insert id, so BigQuery
collapses the second copy. Deduplication is best effort, but a duplicate row
would not change the latest view, which reports one row per document.

### Recovering documents missed during the gap

If the cutover gap has already occurred, re-import the collection with
`fs-bq-import-collection` from the extension repository, pointed at the dataset
and table prefix the kit writes to. In non-interactive mode the script requires
the project, collection path, dataset, table prefix,
`--query-collection-group` and `--dataset-location`:

```shell
npx @firebaseextensions/fs-bq-import-collection \
  --non-interactive \
  --project <project-id> \
  --source-collection-path <COLLECTION_PATH> \
  --dataset <DATASET_ID> \
  --table-name-prefix <TABLE_ID> \
  --query-collection-group false \
  --dataset-location <DATASET_LOCATION> \
  --firestore-instance-id <DATABASE>
```

Import only once the kit is exporting, and pause writes to the collection while
it runs: the script reads each document and writes its row shortly afterwards,
so a write streamed mid-import can be superseded by the import row until that
document changes again.

Before importing, note what it does and does not restore:

- The script imports the entire collection; it cannot target a subset. Every
  document receives one `IMPORT` row holding its current value. Import rows
  carry no event id, so running the import again adds a further row per
  document rather than replacing the earlier one.
- Rows are stamped with the time the import runs, so afterwards every document
  reports operation `IMPORT` in the latest view. Current values remain correct
  and the preceding rows remain in the changelog, but the latest view no longer
  reflects the last real operation. (The extension's import guide describes
  these rows as carrying an epoch timestamp; version 0.1.27 uses the import
  time.)
- Deletes cannot be recovered, because the import reflects only what Firestore
  holds when it runs. A document deleted during the gap is no longer there to
  import, so the delete never reaches the changelog and the document stays
  visible in the latest view with its last exported value. An update that a
  later write superseded is likewise unavailable, since only the current value
  is imported.

## Differences from the Stream Firestore to BigQuery extension

This kit is the extension repackaged as an npm package, but a few things behave
differently. If you are moving from an installed extension instance, read this
section before you deploy.

### Failed writes: same buffer

The kit keeps the extension's write-path architecture: a failed BigQuery write
buffers through the `syncBigQuery` Cloud Tasks queue, with the same shape (5
attempts, 60s minimum backoff, `MAX_DISPATCHES_PER_SECOND` throttling) and the
same knobs (`MAX_DISPATCHES_PER_SECOND`, `MAX_ENQUEUE_ATTEMPTS`) - your
migrated `.env` values carry over unchanged.

When the enqueue itself fails, the kit does what the extension does: logs at
error level, publishes an `onError` event, and drops the event. The trigger
declares no retry policy, so nothing is redelivered through Eventarc.

Earlier release candidates of this kit had no queue: they retried every failed
write through Eventarc redelivery for up to 24 hours and never lost a row
inside that window. That property is gone by design - a row that exhausts the
queue without a configured `BACKUP_COLLECTION` is dropped, exactly as in the
extension. Set `BACKUP_COLLECTION`.

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
the no-region behavior below. Upgrading the CLI (or this kit, if your `.env` already carried
`DATABASE_REGION`) can itself trigger the region move described below on your
next deploy.

`firebase functions:kits:install` and `firebase ext:migrate` prompt for this
value and write it to `.env` before anything is deployed, so a single deploy
places the functions correctly. If you instead run `firebase deploy` with the
value still missing from `.env`, the prompt comes after discovery has already
chosen a region, so your answer only takes effect on the following deploy.

`firebase ext:migrate` also writes `FUNCTION_DEFAULT_REGION` to your `.env`,
recording where the extension's functions ran. Nothing reads it: placement
comes from `DATABASE_REGION` alone, so if the two disagree your next deploy
moves the functions.

With an explicit empty `DATABASE_REGION=` line in `.env`, the functions declare
no region and the Firebase CLI resolves one at deploy time: a function keeps
the region it is already deployed in, and on a first deploy all four land in
`us-central1`. The CLI would otherwise place `fsexportbigquery` next to the
database, but it resolves the default region before it resolves params, so the
`DATABASE` param this kit passes to the trigger is still an unresolved
expression when the database is looked up, and the lookup falls back
([firebase/firebase-tools#11020](https://github.com/firebase/firebase-tools/issues/11020)).
Setting the `FIREBASE_FUNCTIONS_DEFAULT_REGION` environment variable when
running `firebase deploy` puts all of them in that region instead. Careful
with that variable: it applies to every no-region function in the deploy, not
just this kit. Omitting the line is not the same as an empty one: a
non-interactive deploy fails with `In non-interactive mode but have no value
for the following environment variables: DATABASE_REGION`. Note that changing
an existing install's function region (via this variable or `DATABASE_REGION`)
deletes and recreates the functions in the new region - new URLs, a recreated
task queue, and any in-flight tasks are lost.

### Defaults

Two settings now have defaults rather than being passed through empty:
`DATASET_LOCATION` defaults to `us`, and `BIGQUERY_PROJECT_ID` defaults to the
project the functions are deployed to.

### DATASET_LOCATION is not immutable

The extension declared `DATASET_LOCATION` as immutable, so a reconfigure could
not change it; moving the dataset meant uninstalling and reinstalling. The kit
cannot enforce that: `firebase-functions/params` has no immutability, so a
redeploy accepts any new value. The value only reaches BigQuery when the
lifecycle task creates the dataset. On a redeploy the task finds the existing
dataset by id and skips creation, so the dataset stays where it is and the new
value is ignored, with no error and no warning. Nothing else reads it: writes,
views, and the `syncBigQuery` queue address the dataset by id and BigQuery
resolves the location itself, so a mismatched `.env` keeps working.

To export to a different location, point the kit at a new dataset: set a new
`DATASET_ID` together with the new `DATASET_LOCATION` and redeploy. The
redeploy lifecycle task creates the new dataset in the new location; the old
dataset is left behind with its table and view, as in the extension when the
dataset id changes. Existing documents do not follow. Backfill them with
`fs-bq-import-collection` from the extension repository (see "Tooling that is
not included" below).

### Tooling that is not included

The extension shipped companion scripts that this package does not:

- `fs-bq-import-collection`, for backfilling documents that already existed
  before the export started.
- `gen-schema-view`, for generating strongly typed BigQuery views over the
  changelog.
- The cross-project access grant scripts.

`IMPORT_COLLECTION_PATH` is not a setting here. If you rely on any of these,
keep using the versions from the extension repository. They operate on the same
BigQuery changelog table, so they still work against data this kit writes. See
"Migrating from the extension" for using `fs-bq-import-collection` to recover
documents missed during a migration.

### Concurrency, CPU and timeouts match the extension

The kit exports `defaultOptions` from
`@firebase-function-kits/firestore-bigquery-export/default-options`:
`cpu: "gcf_gen1"`, `concurrency: 1` and `maxInstances: 100`. The extension
deployed every function at 0.1666 vCPU with an instance handling one
invocation at a time. `maxInstances: 100` matches the extension's Firestore
trigger, a 2nd gen function that ran at the platform default of 100
instances; the extension's task-queue functions were 1st gen functions with no
declared cap. The 2nd gen defaults would be concurrency `80` and 1 vCPU at
256MiB. The module has no side effects, so you can import it before
`setGlobalOptions` runs.

Firebase Functions applies options in this order, field by field:

1. The object you pass to `setGlobalOptions`. Spread `defaultOptions` first
   and put your own keys after it, so your keys win:
   `setGlobalOptions({ ...defaultOptions, region: "europe-west1", maxInstances: 20 })`.
   A key you set to `undefined` also wins: `maxInstances: undefined` removes
   the default cap instead of keeping it.
2. The options each function declares, which override the globals. The kit
   declares only `ingressSettings` on `fsexportbigquery`, `timeoutSeconds` and
   `retryConfig` on the task-queue functions, `maxInstances` and `rateLimits`
   on `syncBigQuery`, and `region` from `DATABASE_REGION`.

A codebase calls `setGlobalOptions` once; a second call replaces the first
instead of merging with it. For that reason the kit does not call it. If you
write your own entry file and do not spread `defaultOptions`, or your ES
module entry loads the kit before `setGlobalOptions` runs (see
[Usage](#usage)), every function falls back to the 2nd gen defaults: 1 vCPU at
256MiB, concurrency `80` and no instance cap from the kit. You lose CPU parity
with the extension.

`concurrency` above `1` needs `cpu` of `1` or more. To raise concurrency,
override both keys:
`setGlobalOptions({ ...defaultOptions, cpu: 1, concurrency: 80 })`.

`fsexportbigquery` sets `ingressSettings: "ALLOW_INTERNAL_ONLY"`, so only
internal traffic reaches the Firestore trigger, as with the extension. This
option is not in `defaultOptions`: as a global it would also apply to the
task-queue functions and stop Cloud Tasks from invoking them. The task-queue
functions `syncBigQuery`, `initBigQuerySync` and
`setupBigQuerySync` set `timeoutSeconds: 540`, the extension's 1st gen task
timeout; `fsexportbigquery` keeps the 60 second default, which the deployed
trigger ran at.

The task-queue functions declare no `ingressSettings`, so they inherit the
default `ALLOW_ALL`, or whatever your codebase sets with
`setGlobalOptions({ ingressSettings })`. The deployed extension's task-queue
functions ran with open ingress, and the `curl` into `initBigQuerySync` under
[Provisioning](#provisioning) relies on it: setting `ALLOW_INTERNAL_ONLY`
globally makes that request fail.

At concurrency `1`, a function serves as many requests at once as it has
instances. `fsexportbigquery`, `initBigQuerySync` and `setupBigQuerySync` take
the `maxInstances: 100` from `defaultOptions` unless you override it after the
spread; the two lifecycle tasks receive one task per deploy, so the cap does
not matter for them. The trigger therefore handles 100
events at once, the same as the deployed extension trigger (100 instances,
concurrency `1`, no retry policy). An event above that ceiling waits up to
about 10 seconds for a free instance and is then refused before the handler
runs: no error log, no `onError` event, no enqueue and no backup row. Whether
Eventarc redelivers a refused push under the trigger's
`RETRY_POLICY_DO_NOT_RETRY` is not verified. Set a higher `maxInstances` after
the `defaultOptions` spread to lift the ceiling.

`syncBigQuery` sets `maxInstances: 500` to match its `maxConcurrentDispatches`
limit. A global `maxInstances`, from `defaultOptions` or from your own keys,
does not change it, because the per-function value wins: Cloud Tasks may
dispatch 500 tasks at once, and 100 instances would take only 100 of them. A
dispatch above the instance ceiling waits for a free instance for up to about
10 seconds, then gets a Cloud Run 429. Cloud Tasks counts that as a failed
attempt, retries it on the queue's schedule (5 attempts, 60 seconds minimum
backoff), and slows the queue while 429s continue. The handler never ran for
such a dispatch, so a task that exhausts its attempts that way writes no
`BACKUP_COLLECTION` row.

At 0.1666 vCPU, `maxInstances: 500` needs about 84 vCPU of Cloud Run CPU quota
in the function's region (Cloud Run caps a service's instances at the regional
CPU quota divided by the CPU per instance). Default quotas captured at the time
of writing were 500 vCPU in most regions and 343 in `europe-west10` and
`europe-west12`, so the default suffices everywhere captured. On a project
whose quota is lower, `firebase deploy` creates the other functions, exits with
an error on `syncBigQuery`, and skips the `afterFirstDeploy` lifecycle hook;
after raising the quota, run
`firebase functions:lifecycle:run afterFirstDeploy <codebase>` or redeploy. To
lower the cap instead, change `SYNC_MAX_CONCURRENT_DISPATCHES` in
`src/index.ts`, which sets both `maxInstances` and `maxConcurrentDispatches`,
and deploy from your modified copy: the kit exposes no parameter for it, and
lowering only `maxInstances` recreates the 429 loss above. The separate Cloud
Run Instances quota (100 per project per region in some regions, unlimited in
`us-central1` and `europe-west1`) also caps the instances running across all
services in the region.

## API surface

- **Main entry** (`@firebase-function-kits/firestore-bigquery-export`): exports
  `fsexportbigquery`, `syncBigQuery`, `initBigQuerySync`, and
  `setupBigQuerySync`, and registers the first-deploy / redeploy provisioning
  hooks. Runtime config is resolved lazily on first invocation. Use this entry
  from Firebase deploy/emulator/runtime. For your own triggers, import from
  `./lib` instead.
- **Library entry** (`./lib`): `handleDocumentWrite` and
  `handleSyncBigQueryTask`, the raw handlers for owning trigger registration
  yourself, plus the config types and helpers (`ExportConfig`,
  `resolveExportConfig`, `toTrackerConfig`, `SerializedDocumentChange`) for
  building their injected `HandlerContext`. Safe to import anywhere.
- **Default options entry** (`./default-options`): `defaultOptions`, the
  global options to spread into your `setGlobalOptions` call (see
  [Concurrency, CPU and timeouts](#concurrency-cpu-and-timeouts-match-the-extension)).
  Safe to import anywhere.

The change-tracker engine is an internal dependency and is not exported.

## License

Apache-2.0
