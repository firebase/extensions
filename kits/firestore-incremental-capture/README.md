# @firebase/firestore-incremental-capture

Incremental point-in-time capture of Firestore changes. This is the Firestore
Incremental Backup Stream Firebase Extension as an npm package you add to your
own Firebase Functions codebase and deploy.

Every write to a watched collection is serialized into a BigQuery changelog. A
restoration then rebuilds a separate Firestore database as it stood at a chosen
second: a Dataflow pipeline reads a point-in-time-recovery snapshot of the
source database and replays the changelog on top of it. The functions run in
your own Firebase project; there is no hosted version, so you deploy them
yourself.

## Install

```sh
npm install @firebase/firestore-incremental-capture
```

## Required IAM

Deploy needs these Google Cloud roles for the function's service account.
Firebase CLI 15.23.0 or later creates that account, grants the roles below, and
attaches the account to every function in this kit. Do not set a custom runtime
service account for this codebase — it conflicts with that automatic setup.

| Role                           | Why                                                       |
| ------------------------------ | --------------------------------------------------------- |
| `roles/bigquery.dataEditor`    | create the changelog dataset/table; insert rows            |
| `roles/bigquery.user`          | run BigQuery jobs                                         |
| `roles/datastore.user`         | write the restoration run-status document                 |
| `roles/dataflow.developer`     | launch the restoration job                                |
| `roles/eventarc.eventReceiver` | receive Firestore events on the `syncData` trigger        |
| `roles/run.invoker`            | invoke the gen2 functions from Eventarc and Cloud Tasks   |
| `roles/cloudtasks.enqueuer`    | enqueue onto the kit's own task queues                    |
| `roles/iam.serviceAccountUser` | act as the Dataflow worker service account when launching |
| `roles/storage.objectViewer`   | read the staged flex template spec                        |

`scripts/setup.sh` cannot grant these, because the managed account does not
exist until the first deploy. What the script grants instead is the separate set
of roles the **Dataflow worker** service account needs (`dataflow.worker`,
`datastore.user`, BigQuery read, staging bucket access).

## Usage

Re-export the five wired functions from your functions codebase entry:

```ts
export {
  initIncrementalCapture,
  onHttpRunRestoration,
  runRestorationTask,
  syncChangelogTask,
  syncData,
} from "@firebase/firestore-incremental-capture";
```

- `syncData` is the Firestore trigger. It serializes each write and queues it.
- `syncChangelogTask` inserts a queued row into BigQuery. It is a separate hop so
  a BigQuery outage retries on the queue's schedule rather than holding the
  trigger open.
- `onHttpRunRestoration` validates a timestamp and queues a restoration.
- `runRestorationTask` launches the Dataflow pipeline.
- `initIncrementalCapture` is the first-deploy and redeploy provisioning
  lifecycle task.

Importing the package without exporting its functions deploys nothing — the CLI
only deploys what your entry file exports.

Trigger a restoration with a whole number of seconds since the Unix epoch:

```sh
curl -X POST https://<onHttpRunRestoration URL printed by firebase deploy> \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  -H 'Content-Type: application/json' \
  -d '{"timestamp": 1700000000}'
```

> **`onHttpRunRestoration` requires an authenticated caller.** Unlike the
> extension it was migrated from, a kit deploy does not grant `allUsers` the
> invoker role, so the URL rejects anonymous calls with a 403. Grant
> `roles/run.invoker` on the function to the principals allowed to start a
> restoration - a restoration batch-writes over the backup database, so keep
> that set small. Making it public re-creates the extension's exposure; don't.

## Deploy

Restoration depends on setup the functions runtime cannot do for itself: it has
neither gcloud nor Maven. Run the setup script once, before deploying:

```sh
PROJECT_ID=my-project BACKUP_INSTANCE_ID=my-backup ./scripts/setup.sh
```

It enables the required APIs, turns on PITR for the source database, creates the
backup database, creates an Artifact Registry repository, grants the Dataflow
worker roles, builds the pipeline jar from `pipeline/`, and stages the Dataflow
flex template. Every step is idempotent, so re-running after a partial failure
is safe. The script prints the config values to use below.

PITR only covers writes made after it is enabled, so a restoration can only
target a point in time after setup ran.

The package's `firebase.json` declares a `kit` stanza (Firebase CLI 15.25.1 or
later, behind the `kits` experiment):

```json
{
  "functions": [
    {
      "source": ".",
      "kit": "firestore-incremental-capture",
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
deploy as `kit-default-syncData`, `kit-default-syncChangelogTask`,
`kit-default-onHttpRunRestoration`, `kit-default-runRestorationTask`, and
`kit-default-initIncrementalCapture`.

```sh
firebase experiments:enable kits
firebase deploy --only functions
```

Deploy a single instance with `firebase deploy --only functions:<instance id>`.

## Configuration

Set these values in a `.env` (or `.env.<projectId>`) file. The Firebase CLI
loads them at deploy time and prompts for any required values that are missing.
`PROJECT_ID` is supplied by the Firebase CLI.

| Field                | Env var                | Required | Default          | Description                                                 |
| -------------------- | ---------------------- | -------- | ---------------- | ----------------------------------------------------------- |
| `instanceId`         | `INSTANCE_ID`          | yes      | —                | Must match this instance's key in the `instances` map        |
| `backupInstanceId`   | `BACKUP_INSTANCE_ID`   | yes      | —                | Firestore database to restore into; must not be `(default)`  |
| `syncCollectionPath` | `SYNC_COLLECTION_PATH` | no       | `posts`          | Collection to capture                                       |
| `datasetId`          | `SYNC_DATASET`         | no       | `backup_dataset` | BigQuery dataset for the changelog                          |
| `tableId`            | `SYNC_TABLE`           | no       | `backup_table`   | BigQuery changelog table                                    |
| `location`           | `LOCATION`             | no       | `us-central1`    | Region for the functions and task queues                    |
| `datasetLocation`    | `DATASET_LOCATION`     | no       | `us`             | BigQuery dataset location                                   |
| `dataflowRegion`     | `DATAFLOW_REGION`      | no       | `LOCATION`       | Region for Dataflow jobs                                    |
| `bucketName`         | `BUCKET_NAME`          | no       | default bucket   | Bucket the flex template was staged to; restoration only    |
| `logLevel`           | `LOG_LEVEL`            | no       | `info`           | `debug`, `info`, `warn`, `error`, `silent`                   |

Three constraints are worth stating outright, because each one fails silently if
you assume otherwise:

- **Only the `(default)` database can be captured.** The pipeline reads its PITR
  baseline from `FirestoreOptions.getDefaultInstance()`
  (`RestorationPipeline.java`), so a non-default source would be captured to the
  changelog but absent from the restored baseline. There is deliberately no
  param for it.
- **Only a single collection can be captured.** A Firestore trigger accepts a
  multi-segment wildcard only as its final path segment, so
  `SYNC_COLLECTION_PATH={document=**}` produces the undeployable pattern
  `{document=**}/{documentId}`. Whole-database capture is not available.
- **`BUCKET_NAME` is read from the project's default bucket when unset**, rather
  than guessed from the project id. The default bucket is
  `<projectId>.firebasestorage.app` for projects created after September 2024
  and `<projectId>.appspot.com` for older ones, and a wrong guess means
  launching against a template that was never staged there. Only restoration
  reads it, so capture works on a project with no Storage bucket at all; the
  error surfaces when a restoration is launched.

## Multiple instances

To capture several collections, add one entry per instance to the `instances`
map, each pointing at its own config directory with its own `.env`:

```json
{
  "functions": [
    {
      "source": ".",
      "kit": "firestore-incremental-capture",
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
the instances cannot collide. Set `INSTANCE_ID` in each config directory to that
instance's key — the kit uses it to address its own task queues, and a mismatch
enqueues onto a queue that does not exist.

Give each instance its own `SYNC_DATASET`/`SYNC_TABLE` or its own
`BACKUP_INSTANCE_ID`. Two instances sharing a changelog table would replay each
other's documents on restore.

## Provisioning

`initIncrementalCapture` runs after first deploy and after each redeploy. It
creates the BigQuery dataset and changelog table if they are missing, running in
the function's own identity so it has the runtime service account the creation
needs. It is idempotent, and Cloud Tasks retries it on a transient BigQuery
error so a blip does not leave the changelog unprovisioned.

It does not provision the restoration prerequisites — PITR, the backup database
and the flex template all need gcloud. That is what `scripts/setup.sh` is for.

## Restoration gaps

The restoration pipeline in `pipeline/` is vendored from the original extension
with one fix: the extension doubled the `projects/…/databases/…/documents/`
prefix on every changelog replay write, which Firestore rejects - failing the
whole restoration job whenever the replay window contained any changelog rows.
The pipeline still does not round trip everything the capture side records.
`FirestoreReconstructor.buildFirestoreMap` switches on each value's type tag and
silently drops any field whose tag it does not handle:

- **`binary` and `null` fields are dropped.** The pipeline has no case for
  either, so a restored document loses them.
- **Arrays of primitives do not survive.** `buildFirestoreList` rebuilds every
  element by passing it to `buildFirestoreMap`, which reads field names at the
  top level, so `[1, 2]` restores as a list of empty maps. Arrays of maps do
  round trip — see the note in `src/serializer.ts` on why array elements are
  encoded differently from map fields.
- **A Timestamp, GeoPoint, DocumentReference or Buffer sitting _directly_ in an
  array does not survive either**, for the same reason: its `{type, value}`
  envelope is not a field map. The extension happened to preserve these as maps
  of their internals (`_seconds`/`_nanoseconds` for a Timestamp), so they
  restored with the wrong type but with the data present; here they restore as
  empty maps. The same values nested inside a map element round trip correctly.
- **Documents sharing an id across collections collide.** The replay query ranks
  with `ROW_NUMBER() OVER(PARTITION BY documentId …)`, partitioning by document
  id rather than path, so only one of `users/x` and `orders/x` is replayed.

The PITR baseline half of a restoration is unaffected; these apply to the
changelog replay on top of it. Fixing them means changing the Java, which is out
of scope for this migration.

## Changes from the legacy extension

This kit replaces the Firestore Incremental Backup Stream extension
(`firestore-incremental-capture`, last published as 0.0.12). The changelog wire
format is carried over - `CHANGELOG_SCHEMA` is field-for-field the extension's
BigQuery schema, and `tests/wire-format.test.ts` pins the value encoding to the
extension's own serializer tests - so the kit can point at the extension's
existing dataset and table and the accumulated history stays replayable. The
one deliberate encoding change: DocumentReference values are tagged
`reference`, not `documentReference`, because the pipeline switches on
`REFERENCE` and silently dropped the extension's spelling on restore.
Everything around the format moved:

- **Distribution.** An npm package you re-export from your own functions
  codebase instead of `firebase ext:install`. Functions deploy as
  `kit-<instance id>-<name>` rather than `ext-<instance id>-<name>`.
- **Function names.** `syncData` and `onHttpRunRestoration` keep their names.
  `syncDataTask` is now `syncChangelogTask`, `onBackupRestore` is now
  `runRestorationTask`, and the `runInitialSetup` lifecycle function is now the
  `initIncrementalCapture` lifecycle task.
- **Dropped functions.** `buildFlexTemplate`, `onCloudBuildComplete` and
  `onFirestoreBackupInit` are gone. The extension staged the Dataflow flex
  template through Cloud Build jobs launched from functions; the kit builds the
  jar and stages the template in `scripts/setup.sh`, which also absorbs the
  extension's POSTINSTALL gcloud checklist (PITR, backup database, Artifact
  Registry, worker roles) into one idempotent script.
- **Template path.** The template is staged to
  `gs://<bucket>/<instance id>-dataflow-restore`, not the extension's
  `gs://<bucket>/<instance id>/templates/myTemplate`, so an extension-staged
  template is not reused - run `scripts/setup.sh` before the first restoration.
- **Configuration.** `INSTANCE_ID` is new and required (the extension injected
  `EXT_INSTANCE_ID` itself). `LOCATION` is free-form and mutable instead of an
  immutable install-time select. `SYNC_COLLECTION_PATH` is optional with a
  default, and no longer advertises `{document=**}` whole-database capture -
  that pattern never produced a deployable trigger (see Configuration).
  `DATASET_LOCATION` is configurable instead of hardcoded to `us`.
  `DATAFLOW_REGION` and `BUCKET_NAME` are documented params instead of
  undocumented env vars, and an unset `BUCKET_NAME` reads the project's actual
  default bucket rather than guessing `<projectId>.appspot.com`.
  `BACKUP_INSTANCE_ID=(default)` is rejected at startup instead of letting a
  restoration write over its own source.
- **Serializer.** BigInt field values are stringified instead of throwing.
- **Status documents.** Restoration run status lives at
  `_<instance id>/runs/restorations`, not the extension's `_ext-<instance id>`
  documents.
- **Pipeline.** The Java pipeline is vendored with Beam bumped to 2.75.0 for
  CVE fixes and one logic fix: the doubled document-path prefix that failed
  every restoration whose replay window contained changelog rows (see
  Restoration gaps for what still does not round trip).

To migrate: run `scripts/setup.sh`, set the kit's `.env` to the extension's
param values (same `SYNC_DATASET`/`SYNC_TABLE` to keep the history), deploy,
then uninstall the extension. A brief overlap writes duplicate changelog rows
for the same writes; replay ranks one row per document, so restores are
unaffected.

## API surface

- **Main entry** (`@firebase/firestore-incremental-capture`): exports the five
  wired functions listed under Usage, and registers the first-deploy / redeploy
  provisioning hooks. Runtime config is resolved lazily on first invocation. Use
  this entry from Firebase deploy/emulator/runtime. For your own triggers,
  import from `./lib` instead.
- **Library entry** (`./lib`): the raw handlers for owning trigger registration
  yourself (`handleDocumentWrite`, `handleChangelogTask`,
  `handleRestorationRequest`, `handleRestorationTask`), the config types and
  helpers (`CaptureConfig`, `resolveCaptureConfig`) for building their injected
  `HandlerContext`, and the changelog wire format (`CHANGELOG_SCHEMA`,
  `ChangelogRow`, `serializeDocument`) for reading the changelog or
  reimplementing the restoration side. Safe to import anywhere.

`pipeline/` is the Java/Beam restoration pipeline, built by `scripts/setup.sh`.
To work on it directly, see `pipeline/README.md`.

## License

Apache-2.0
