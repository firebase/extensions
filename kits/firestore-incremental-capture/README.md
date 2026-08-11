# @firebase/firestore-incremental-capture

Incremental point-in-time capture of Firestore changes, as a deployable Firebase Function.

Migrated from the `firestore-incremental-capture` Firebase Extension. Every write to a watched
collection is serialized into a BigQuery changelog. A restoration then rebuilds a separate Firestore
database as it stood at a chosen second: a Dataflow pipeline reads a PITR snapshot of the source
database and replays the changelog on top of it.

## How it works

**Capture.** `syncData` fires on every document write, serializes the before/after data, and queues
it. `syncChangelogTask` inserts the queued row into BigQuery. The insert is a separate hop so a
BigQuery outage retries on the task queue's schedule instead of holding the Firestore trigger open.

**Restore.** `onHttpRunRestoration` validates a timestamp and queues the work. `runRestorationTask`
launches the Dataflow flex template in `pipeline/`, which writes the PITR baseline into the backup
database and then replays every changelog row up to the timestamp.

**Provisioning.** `initIncrementalCapture` runs after first deploy and after each redeploy, creating
the BigQuery dataset and changelog table. Everything restoration needs beyond that is provisioned by
`scripts/setup.sh` - see below.

## Security

`onHttpRunRestoration` is **unauthenticated**, matching the extension it was migrated from. Anyone
who can reach the URL can start a Dataflow job that batch-writes over the backup database. Before
deploying to production, restrict it: set Cloud Run ingress, apply an IAM invoker policy, or drop the
endpoint and have your own authorized code enqueue `runRestorationTask` directly.

## Setup

Restoration needs a PITR-enabled source database, an existing backup database, and a staged Dataflow
flex template. None can be provisioned from the functions runtime, which has neither gcloud nor
Maven. Run the setup script once, before deploying:

```bash
PROJECT_ID=my-project BACKUP_INSTANCE_ID=my-backup ./scripts/setup.sh
```

It enables the required APIs, turns on PITR, creates the backup database, creates an Artifact
Registry repository, grants the Dataflow roles, builds the pipeline jar from `pipeline/`, and stages
the flex template. Every step is idempotent. See the header of `scripts/setup.sh` for the optional
variables.

PITR only covers writes made after it is enabled, so restoration can only target a point in time
after setup ran.

## Configuration

Set these in `.env` or `.env.<projectId>`.

| Param                  | Default                         | Description                                                    |
| ---------------------- | ------------------------------- | -------------------------------------------------------------- |
| `LOCATION`             | `us-central1`                   | Region for the functions.                                       |
| `DATABASE`             | `(default)`                     | Firestore database to capture.                                  |
| `SYNC_COLLECTION_PATH` | `posts`                         | Collection to capture. `{document=**}` captures everything.     |
| `SYNC_DATASET`         | `backup_dataset`                | BigQuery dataset for the changelog.                             |
| `SYNC_TABLE`           | `backup_table`                  | BigQuery changelog table.                                       |
| `BACKUP_INSTANCE_ID`   | _required_                      | Firestore database to restore into. Must not be `DATABASE`.     |
| `DATASET_LOCATION`     | `us`                            | BigQuery dataset location.                                      |
| `DATAFLOW_REGION`      | `LOCATION`                      | Region for Dataflow jobs.                                       |
| `BUCKET_NAME`          | `<projectId>.firebasestorage.app` | Bucket holding the flex template.                             |
| `INSTANCE_ID`          | `firestore-incremental-capture` | Namespaces the queues, template, jobs and status documents.     |
| `LOG_LEVEL`            | `info`                          | `debug`, `info`, `warn`, `error` or `silent`.                   |

Projects created before September 2024 use `<projectId>.appspot.com` as their default bucket and must
set `BUCKET_NAME` explicitly.

## Usage

Re-export the functions from your own functions codebase entry:

```ts
export {
  initIncrementalCapture,
  onHttpRunRestoration,
  runRestorationTask,
  syncChangelogTask,
  syncData,
} from "@firebase/firestore-incremental-capture";
```

Trigger a restoration with a whole number of seconds since the Unix epoch:

```bash
curl -X POST https://<region>-<project>.cloudfunctions.net/onHttpRunRestoration \
  -H 'Content-Type: application/json' \
  -d '{"timestamp": 1700000000}'
```

To own trigger registration yourself, import the handlers from the side-effect-free surface:

```ts
import { handleDocumentWrite, resolveCaptureConfig } from "@firebase/firestore-incremental-capture/lib";
```

## Restoration gaps

The restoration pipeline in `pipeline/` is vendored from the original extension unchanged, and it
does not round trip everything the capture side records. `FirestoreReconstructor.buildFirestoreMap`
switches on each value's type tag and **silently drops any field whose tag it does not handle**:

- **`binary` and `null` fields are dropped.** The pipeline has no case for either, so a restored
  document loses them.
- **Arrays do not survive.** `buildFirestoreList` rebuilds every element as a map, so an array of
  primitives restores as a list of empty maps.
- **Changelog replay writes to a malformed path.** `IncrementalCaptureLog.convertToFirestoreValue`
  applies `createDocumentName` to a path that has already been through it, producing a doubled
  `projects/…/databases/…/documents/` prefix.

The PITR baseline half of a restoration is unaffected; these apply to the changelog replay on top of
it. Fixing them means changing the Java, which is out of scope for this migration.

## Development

```bash
npm install
npm run build
npm test
```

`pipeline/` is the Java/Beam restoration pipeline, built by `scripts/setup.sh`. To work on it
directly, see `pipeline/README.md`.
