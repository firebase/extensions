# @firebase/delete-user-data

Delete user data across Firestore, RTDB, and Storage on account deletion. This
is the Delete User Data Firebase Extension as an npm package you add to your own
Firebase Functions codebase and deploy.

It listens for Firebase Auth user deletions, discovers configured (and optional
auto-discovered) paths containing the user id, and clears matching data in
Firestorestore, Realtime Database, and Cloud Storage. The functions run in your own
Firebase project; there is no hosted version, so you deploy them yourself.

## Install

```sh
npm install @firebase/delete-user-data
```

## Required IAM

Deploy needs these Google Cloud roles on the function's service account.
Firebase CLI 15.23.0 or later creates that account, grants the roles below,
and attaches it to every function in this kit. Do not set a custom runtime
service account for this codebase — it conflicts with that automatic setup.

| Role | Why |
|---|---|
| `roles/datastore.owner` | discover and delete Firestore user data |
| `roles/firebasedatabase.admin` | delete Realtime Database user data |
| `roles/storage.admin` | delete Cloud Storage user objects |
| `roles/pubsub.admin` | publish/subscribe discovery and deletion topics |
| `roles/eventarc.eventReceiver` | receive Gen2 event triggers |
| `roles/run.invoker` | allow Eventarc to invoke the Gen2 Cloud Run service |

## Usage

Export the functions from your functions codebase entry:

```ts
// functions/src/index.ts
export {
  clearData,
  handleSearch,
  handleDeletion,
} from "@firebase/delete-user-data";
```

and configure with a `.env` (or `.env.<projectId>`).

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
      "kit": "delete-user-data",
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
deploy as `kit-default-clearData`, `kit-default-handleSearch`, and
`kit-default-handleDeletion`.

```sh
firebase experiments:enable kits
firebase deploy --only functions
```

Deploy a single instance with `firebase deploy --only functions:<instance id>`.

## Configuration

Set these values in a `.env` (or `.env.<projectId>`) file. The Firebase CLI
loads them at deploy time and prompts for any required values that are missing.

| Field | Env var | Required | Default | Description |
|---|---|---|---|---|
| `firestorePaths` | `FIRESTORE_PATHS` | no | (empty) | Comma-separated Firestore paths with `{UID}` |
| `firestoreDatabaseId` | `FIRESTORE_DATABASE_ID` | no | `(default)` | Firestore database id |
| `firestoreDeleteMode` | `FIRESTORE_DELETE_MODE` | no | `shallow` | `shallow` or `recursive` |
| `rtdbInstance` | `SELECTED_DATABASE_INSTANCE` | no | (empty) | RTDB instance id |
| `rtdbLocation` | `SELECTED_DATABASE_LOCATION` | no | `us-central1` | RTDB location |
| `rtdbPaths` | `RTDB_PATHS` | no | (empty) | Comma-separated RTDB paths with `{UID}` |
| `storageBucket` | `CLOUD_STORAGE_BUCKET` | no | default Storage bucket | Bucket to clear |
| `storagePaths` | `STORAGE_PATHS` | no | (empty) | Comma-separated Storage paths with `{UID}` |
| `enableAutoDiscovery` | `ENABLE_AUTO_DISCOVERY` | no | `false` | Auto-discover user-linked docs |
| `searchDepth` | `AUTO_DISCOVERY_SEARCH_DEPTH` | no | `3` | Discovery depth |
| `searchFields` | `AUTO_DISCOVERY_SEARCH_FIELDS` | no | `id,uid,userId` | Fields treated as user ids |
| `searchFunction` | `SEARCH_FUNCTION` | no | (empty) | Optional custom search function |
| `instanceId` | `INSTANCE_ID` | no | `delete-user-data` | Logical instance id |
| `discoveryTopicName` | `DISCOVERY_TOPIC_NAME` | no | `kit-delete-user-data-discovery` | Pub/Sub discovery topic |
| `deletionTopicName` | `DELETION_TOPIC_NAME` | no | `kit-delete-user-data-deletion` | Pub/Sub deletion topic |

## Multiple instances

To run several deletion pipelines, add one entry per instance to the `instances`
map, each pointing at its own config directory with its own `.env`:

```json
{
  "functions": [
    {
      "source": ".",
      "kit": "delete-user-data",
      "instances": {
        "app": "instances/app",
        "admin": "instances/admin"
      }
    }
  ]
}
```

Instance ids must be unique across all kit stanzas in the project, and every
instance's function names are namespaced by its `kit-<instance id>-` prefix, so
the instances cannot collide.

## Events

When `EVENTARC_CHANNEL` is configured, the functions publish deletion events
for each backend under `firebase.extensions.delete-user-data.v1.*`
(`firestore`, `database`, and `storage`).

## API surface

- **Main entry** (`@firebase/delete-user-data`): exports `clearData`,
  `handleSearch`, and `handleDeletion`. The main entry reads environment
  variables when the module loads, so use it from Firebase deploy/emulator/runtime.
  For your own triggers, import from `./lib` instead.
- **Library entry** (`./lib`): handlers (`handleClear`, `handleSearch`,
  `handleDeletion`), path helpers, search / batch-deletion utilities, and config
  types (`DeleteUserDataConfig`, `resolveDeleteUserDataConfig`) for owning
  trigger registration yourself.

## License

Apache-2.0
