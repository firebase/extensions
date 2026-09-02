# @firebase-function-kits/firestore-counter

Distributed, sharded counters for Firestore. This is the Distributed Counter
Firebase Extension as an npm package you add to your own Firebase Functions
codebase and deploy.

It maintains counter shards under watched documents, flushes them on a schedule
via a controller, and aggregates totals with workers. The functions run in your
own Firebase project; there is no hosted version, so you deploy them yourself.

## Install

```sh
npm install @firebase-function-kits/firestore-counter
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
export { controllerCore, onWrite, worker } from "@firebase-function-kits/firestore-counter";
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

## Differences from the Distributed Counter extension

This kit is the extension repackaged as an npm package. It is a very close port:
both settings keep their name, type and default, so an existing `.env` is a
lift-and-shift, and the counting itself is untouched. Shards still live in the
`_counter_shards_` subcollection, are aggregated by the same algorithm on the
same schedule, and your existing security rules and client code keep working
without changes. The differences below are worth knowing before you deploy.

### Your settings are no longer validated before deploy

`INTERNAL_STATE_PATH` must be a document path, meaning an even number of
segments such as `_firebase_ext_/sharded_counter`. The extension rejected
anything else at install time. Nothing checks it now, so a collection path such
as `_firebase_ext_` deploys happily and then throws on every controller run:

```
Value for argument "documentPath" must point to a document, but was
"_firebase_ext_". Your path does not contain an even number of components.
```

Counters silently stop aggregating, and the only sign is the error in your
function logs.

`SCHEDULE_FREQUENCY` is still a plain number of minutes, and the kit builds the
same `every N minutes` schedule from it. It is also unvalidated now, so a value
like `*/5 * * * *` or `5 minutes`, which the install prompt used to reject,
reaches your deploy instead.

### The worker function publishes no events

The extension published `onError` from all three of its functions. In the kit,
the worker function does not: the Eventarc channel is only configured on the
controller and shard-write functions. Failures that happen while a worker is
aggregating, which is the path that handles counters big enough to need workers,
now show up only in the logs. Events from the controller and shard-write
functions are unaffected.

### Events must be wired up by hand

Enabling events was part of the extension's install flow, which created the
channel and set the environment for you. The kit reads `EVENTARC_CHANNEL` and
`EXT_SELECTED_EVENTS` straight from the environment and the CLI never prompts
for them, so no events are published until you create a channel and put both
values in your `.env`. If you set `EVENTARC_CHANNEL` and leave
`EXT_SELECTED_EVENTS` unset, every event type is published.

### Your codebase's global options apply to these functions

The functions are exported from your own functions codebase, so a
`setGlobalOptions` call there applies to them: region, memory, and instance
limits. The extension deployed with fixed settings you could not influence, and
always in `us-central1`.

The controller and shard-write functions keep their own limit of one instance,
which a global setting does not override, so the single-writer behaviour is
safe. The worker function has no limit of its own and does pick up a global
`maxInstances`. The extension left workers unbounded, so a low global cap now
throttles aggregation exactly when the controller wants to spread the work over
many workers.

### Client samples and the stress test app are not in the package

The extension repo shipped counter clients for Web, Node, Android, iOS and Dart
plus a stress test app. The npm package contains only the functions. Nothing
about the shard layout changed, so the clients you already use keep working;
carry on getting them from the extension repo.

### Unchanged

- Both settings, with the same names and the same defaults
  (`_firebase_ext_/sharded_counter`, `1` minute).
- The `_counter_shards_` subcollection name, the shard document format, and
  therefore your security rules.
- The aggregation behaviour: inline aggregation up to 200 shards, workers above
  that, 45 second self-scheduling worker runs, partial shard cleanup, and
  deletion of shards once they are summed into the counter field.
- The three functions, the event types they publish and their payloads:
  `onStart` still carries `{change, context}` and `onCompletion` still carries
  `{context}`, with `context.eventId`, `context.timestamp`, `context.eventType`,
  `context.resource` and the trigger wildcards under `context.params`. Aside
  from the worker point above.

## API surface

- **Main entry** (`@firebase-function-kits/firestore-counter`): exports `controllerCore`,
  `onWrite`, and `worker`. The main entry reads environment variables when the
  module loads, so use it from Firebase deploy/emulator/runtime. For your own
  triggers, import from `./lib` instead.
- **Library entry** (`./lib`): handlers (`handleSchedule`, `handleShardWrite`,
  `handleWorker`), controller/worker types, and config helpers (`CounterConfig`,
  `resolveCounterConfig`) for owning trigger registration yourself.

## License

Apache-2.0
