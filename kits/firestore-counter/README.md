# @firebase/firestore-counter

Distributed, sharded counters for Firestore. This is the Distributed Counter
Firebase Extension as an npm package you add to your own Firebase Functions
codebase and deploy.

It maintains counter shards under watched documents, flushes them on a schedule
via a controller, and aggregates totals with workers. The functions run in your
own Firebase project; there is no hosted version, so you deploy them yourself.

## Install

```sh
npm install @firebase/firestore-counter
```

## Required IAM

Deploy needs these Google Cloud roles on the function's service account.
Firebase CLI 15.23.0 or later creates that account, grants the roles below,
and attaches it to every function in this kit. Do not set a custom runtime
service account for this codebase — it conflicts with that automatic setup.

| Role | Why |
|---|---|
| `roles/datastore.user` | read/write counter shards and aggregate docs |
| `roles/cloudscheduler.admin` | schedule the controller that flushes shards |
| `roles/eventarc.eventReceiver` | receive Gen2 Firestore trigger events |
| `roles/run.invoker` | allow Eventarc/Scheduler to invoke the Gen2 Cloud Run service |

## Usage

Export the functions from your functions codebase entry:

```ts
// functions/src/index.ts
export { controllerCore, onWrite, worker } from "@firebase/firestore-counter";
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
      "kit": "firestore-counter",
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
deploy as `kit-default-controllerCore`, `kit-default-onWrite`, and
`kit-default-worker`.

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
| `internalStatePath` | `INTERNAL_STATE_PATH` | no | `_firebase_ext_/sharded_counter` | Firestore path for controller state |
| `scheduleFrequencyMinutes` | `SCHEDULE_FREQUENCY` | no | `1` | Controller schedule frequency (minutes) |

## Multiple instances

To run several counter deployments, add one entry per instance to the
`instances` map, each pointing at its own config directory with its own `.env`:

```json
{
  "functions": [
    {
      "source": ".",
      "kit": "firestore-counter",
      "instances": {
        "likes": "instances/likes",
        "views": "instances/views"
      }
    }
  ]
}
```

Instance ids must be unique across all kit stanzas in the project, and every
instance's function names are namespaced by its `kit-<instance id>-` prefix, so
the instances cannot collide.

## Events

When `EVENTARC_CHANNEL` is configured, the functions publish lifecycle events
such as `onStart`, `onError`, `onSuccess`, and `onCompletion` under
`firebase.extensions.firestore-counter.v1.*`.

## API surface

- **Main entry** (`@firebase/firestore-counter`): exports `controllerCore`,
  `onWrite`, and `worker`. The main entry reads environment variables when the
  module loads, so use it from Firebase deploy/emulator/runtime. For your own
  triggers, import from `./lib` instead.
- **Library entry** (`./lib`): handlers (`handleSchedule`, `handleShardWrite`,
  `handleWorker`), controller/worker types, and config helpers (`CounterConfig`,
  `resolveCounterConfig`) for owning trigger registration yourself.

## License

Apache-2.0
