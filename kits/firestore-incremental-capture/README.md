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
curl -X POST https://<region>-<project>.cloudfunctions.net/kit-default-onHttpRunRestoration \
  -H 'Content-Type: application/json' \
  -d '{"timestamp": 1700000000}'
```

> **`onHttpRunRestoration` is unauthenticated**, matching the extension it was
> migrated from. Anyone who can reach the URL can start a Dataflow job that
> batch-writes over the backup database. Before deploying to production,
> restrict it: set Cloud Run ingress, apply an IAM invoker policy, or drop the
> endpoint and have your own authorized code enqueue `runRestorationTask`
> directly.

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
| `bucketName`         | `BUCKET_NAME`          | no       | default bucket   | Bucket the flex template was staged to                      |
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
  launching against a template that was never staged there.

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
unchanged, and it does not round trip everything the capture side records.
`FirestoreReconstructor.buildFirestoreMap` switches on each value's type tag and
silently drops any field whose tag it does not handle:

- **`binary` and `null` fields are dropped.** The pipeline has no case for
  either, so a restored document loses them.
- **Arrays of primitives do not survive.** `buildFirestoreList` rebuilds every
  element by passing it to `buildFirestoreMap`, which reads field names at the
  top level, so `[1, 2]` restores as a list of empty maps. Arrays of maps do
  round trip — see the note in `src/serializer.ts` on why array elements are
  encoded differently from map fields.
- **Changelog replay writes to a malformed path.**
  `IncrementalCaptureLog.convertToFirestoreValue` applies `createDocumentName`
  to a path that has already been through it, producing a doubled
  `projects/…/databases/…/documents/` prefix.
- **Documents sharing an id across collections collide.** The replay query ranks
  with `ROW_NUMBER() OVER(PARTITION BY documentId …)`, partitioning by document
  id rather than path, so only one of `users/x` and `orders/x` is replayed.

The PITR baseline half of a restoration is unaffected; these apply to the
changelog replay on top of it. Fixing them means changing the Java, which is out
of scope for this migration.

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
