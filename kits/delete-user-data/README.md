# @firebase-function-kits/delete-user-data

Delete user data across Firestore, RTDB, and Storage on account deletion. This
is the Delete User Data Firebase Extension as an npm package you add to your own
Firebase Functions codebase and deploy.

> **Pre-release:** this kit has not been released yet. The `latest` version
> on npm is a placeholder with no kit code. Pre-release builds are published
> under the `next` tag and may change between builds:
>
> ```sh
> npm install @firebase-function-kits/delete-user-data@next
> ```

It listens for Firebase Auth user deletions, discovers configured (and optional
auto-discovered) paths containing the user id, and clears matching data in
Firestore, Realtime Database, and Cloud Storage. The functions run in your own
Firebase project; there is no hosted version, so you deploy them yourself.

## Install

```sh
npm install @firebase-function-kits/delete-user-data
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
| `roles/eventarc.publisher` | publish the kit's custom Eventarc events (the Extensions platform granted this implicitly) |

## Usage

Export the functions from your functions codebase entry:

```ts
// functions/src/index.ts
export {
  clearData,
  handleSearch,
  handleDeletion,
} from "@firebase-function-kits/delete-user-data";
```

and configure with a `.env` (or `.env.<projectId>`).

Importing the package without exporting its functions deploys nothing — the CLI
only deploys what your entry file exports.

## Deploy

Add a `kit` stanza to your project's `firebase.json` (Firebase CLI 15.27.0 or
later, behind the `kits` experiment — earlier CLIs do not provide the
`FIREBASE_KIT_INSTANCE_ID` variable this kit reads its instance id from):

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

The instance id is not a setting: the CLI provides it to each instance as
`FIREBASE_KIT_INSTANCE_ID`, set to that instance's key in the `instances` map.
`FIREBASE_` is a reserved prefix in `.env` files, so it cannot be set or
overridden there.

| Field | Env var | Required | Default | Description |
|---|---|---|---|---|
| `firestorePaths` | `FIRESTORE_PATHS` | no | (empty) | Comma-separated Firestore paths with `{UID}` |
| `firestoreDatabaseId` | `FIRESTORE_DATABASE_ID` | no | `(default)` | Firestore database id |
| `firestoreDeleteMode` | `FIRESTORE_DELETE_MODE` | no | `shallow` | `shallow` or `recursive` |
| `rtdbInstance` | `SELECTED_DATABASE_INSTANCE` | no | (empty) | RTDB instance id; required for RTDB deletion — without it `rtdbPaths` are skipped |
| `rtdbLocation` | `SELECTED_DATABASE_LOCATION` | no | `us-central1` | RTDB location: `us-central1`, `europe-west1` or `asia-southeast1` |
| `rtdbPaths` | `RTDB_PATHS` | no | (empty) | Comma-separated RTDB paths with `{UID}` |
| `storageBucket` | `CLOUD_STORAGE_BUCKET` | no | default Storage bucket | Bucket to clear |
| `storagePaths` | `STORAGE_PATHS` | no | (empty) | Comma-separated Storage paths with `{UID}` |
| `enableAutoDiscovery` | `ENABLE_AUTO_DISCOVERY` | no | `no` | Auto-discover user-linked docs (`yes` or `no`) |
| `searchDepth` | `AUTO_DISCOVERY_SEARCH_DEPTH` | no | `3` | Discovery depth |
| `searchFields` | `AUTO_DISCOVERY_SEARCH_FIELDS` | no | `id,uid,userId` | Fields treated as user ids |
| `searchFunction` | `SEARCH_FUNCTION` | no | (empty) | URL of a custom search function that returns paths to delete |
| `discoveryTopicName` | `DISCOVERY_TOPIC_NAME` | no | `kit-<instance id>-discovery` | Pub/Sub discovery topic |
| `deletionTopicName` | `DELETION_TOPIC_NAME` | no | `kit-<instance id>-deletion` | Pub/Sub deletion topic |

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
the instances cannot collide. Each instance learns its own id from the
`FIREBASE_KIT_INSTANCE_ID` variable the CLI provides; there is nothing to keep
in sync by hand.

## Events

The functions can publish deletion events for each backend under
`firebase.extensions.delete-user-data.v1.*` (`firestore`, `database`, and
`storage`). Set both of these in `.env` to turn them on:

| Env var | Description |
|---|---|
| `EVENTARC_CHANNEL` | Full channel name, e.g. `projects/<project id>/locations/us-central1/channels/firebase` |
| `EXT_SELECTED_EVENTS` | Comma-separated event types to publish, e.g. `firebase.extensions.delete-user-data.v1.firestore,firebase.extensions.delete-user-data.v1.storage` |

Only the listed types are published. If `EXT_SELECTED_EVENTS` is unset or
empty, nothing is published, which matches an extension instance installed with
no event types selected.

The channel must already exist. Deploying the kit does not create it, and
publishing to a missing channel logs a warning without failing the function.

## Differences from the Delete User Data extension

This kit is the extension repackaged as an npm package, but a few things behave
differently. If you are moving from an installed extension instance, read this
section before you deploy.

### The instance id comes from `firebase.json`

The extension derived an instance id at install time and used it to name the
Pub/Sub topics. Here the CLI derives it from this instance's key in the
`instances` map in `firebase.json` and provides it to the functions as
`FIREBASE_KIT_INSTANCE_ID`. There is no `INSTANCE_ID` setting to configure.

### Pub/Sub topics are named differently

Discovery and deletion topics are now `kit-<instance id>-discovery` and
`kit-<instance id>-deletion`, where the extension used an `ext-` prefix. The
Firebase CLI creates them for you on deploy, so there is no manual setup step,
but the old topics from an extension install are not reused and can be deleted
once you have migrated.

You can also override both names with `DISCOVERY_TOPIC_NAME` and
`DELETION_TOPIC_NAME`, which the extension did not allow. Change them together,
since one function publishes to a topic the other is triggered by.

### Functions deploy to your default region

The extension deployed to the location you picked at install time. This kit
sets no region, so its functions deploy to your codebase's default
(`us-central1` unless you have changed it).

### All functions are 2nd gen

`clearData`, `handleSearch` and `handleDeletion` are all 2nd gen functions. Kits
do not support 1st gen endpoints, so `clearData` listens on the 2nd gen Firebase
Auth event `google.firebase.auth.user.v2.deleted` instead of the 1st gen
`user.delete` trigger. That event type is still beta in `firebase-functions`.
This mainly matters if you have infrastructure or alerting keyed to function
generation.

Each function still runs like the extension's: one event per instance
(`concurrency: 1`) with the 1st gen CPU for its memory (`cpu: "gcf_gen1"`,
0.1666 vCPU at the default 256MiB) and internal-only ingress, rather than the
2nd gen defaults of concurrency `80`, 1 vCPU and `ALLOW_ALL`. `setGlobalOptions`
can't change concurrency, CPU or ingress, so an ingress setting carried over by
`ext:migrate` doesn't apply to the kit. During a burst, Cloud Run may log
`no available instance` errors while it scales; Eventarc redelivers those
events.
One difference remains: 2nd gen caps each function at 100 instances by default,
where the extension's 1st gen functions could scale to 3000. To raise it, call
`setGlobalOptions({ maxInstances })` from `firebase-functions/v2` in your
codebase before you load the kit, since the kit's functions read the global
options when they are defined.

### Events need an existing channel, and their source has changed

The extension created its Eventarc channel when you installed it with events
turned on. The kit does not, so create the channel before you set
`EVENTARC_CHANNEL`.

Each event's CloudEvent `source` used to identify the extension instance
(`//firebaseextensions.googleapis.com/extensions/projects/<project id>/instances/<instance id>`).
The Firebase CLI now sets it to the function that published the event
(`projects/<project id>/locations/<region>/services/kit-<instance id>-<function>`),
so it differs between `clearData`, `handleSearch` and `handleDeletion`. If your
event triggers filter on `source`, filter on the event `type` instead.

### Unchanged

Event types and payloads are the same. The functions still publish
`firebase.extensions.delete-user-data.v1.firestore`, `.database` and
`.storage` with the same data, and only the types listed in
`EXT_SELECTED_EVENTS`, as the extension published only the types selected at
install. Path syntax (`{UID}` substitution, comma
separated lists, `{DEFAULT}` for the default Storage bucket), the shallow and
recursive Firestore delete modes, the search depth and field matching rules
(an empty `AUTO_DISCOVERY_SEARCH_FIELDS` falls back to the default
`id,uid,userId`, as it did on an installed extension), and the custom
`SEARCH_FUNCTION` contract all behave as they did. RTDB
deletion also keeps the extension's gate: paths are only cleared when a
database URL can be derived from `SELECTED_DATABASE_INSTANCE` and
`SELECTED_DATABASE_LOCATION`; otherwise they are skipped with a
`Realtime Database paths are not configured, skipping` log.

## API surface

- **Main entry** (`@firebase-function-kits/delete-user-data`): exports `clearData`,
  `handleSearch`, and `handleDeletion`. The main entry reads environment
  variables when the module loads, so use it from Firebase deploy/emulator/runtime.
  For your own triggers, import from `./lib` instead.
- **Library entry** (`./lib`): handlers (`handleClear`, `handleSearch`,
  `handleDeletion`), path helpers, search / batch-deletion utilities, and config
  types (`DeleteUserDataConfig`, `resolveDeleteUserDataConfig`) for owning
  trigger registration yourself.

## Reporting bugs

File bugs in the
[firebase/extensions issue tracker](https://github.com/firebase/extensions/issues/new?template=bug.md)
using the bug template, with `delete-user-data kit` in the title. Include:

- The kit version (run `npm ls @firebase-function-kits/delete-user-data` in the
  directory where you installed it), your `firebase-tools` version
  (`firebase --version`) and Node.js version.
- Your configuration from your `.env` (or `.env.<projectId>`) file, with
  secrets and project details redacted.
- Steps to reproduce, the result you expected, and the result you got.
- Logs from the kit's functions in Cloud Logging (with their
  `kit-<instance-id>-` prefix if you deploy instances).

If you migrated from the extension, say so and include the extension version
you migrated from.

## License

Apache-2.0
