# @firebase/rtdb-limit-child-nodes

Limit the number of child nodes under a Realtime Database path. This is the
Limit Child Nodes Firebase Extension as an npm package you add to your own
Firebase Functions codebase and deploy.

It listens for child creates under a path, and when the parent exceeds the
configured max count it deletes the oldest children. The function runs in your
own Firebase project; there is no hosted version, so you deploy it yourself.

## Install

```sh
npm install @firebase/rtdb-limit-child-nodes
```

## Required IAM

Deploy needs these Google Cloud roles on the function's service account.
Firebase CLI 15.23.0 or later creates that account, grants the roles below,
and attaches it to every function in this kit. Do not set a custom runtime
service account for this codebase — it conflicts with that automatic setup.

| Role | Why |
|---|---|
| `roles/firebasedatabase.admin` | read and trim child nodes under the watched path |
| `roles/eventarc.eventReceiver` | receive Gen2 Realtime Database trigger events |
| `roles/run.invoker` | allow Eventarc to invoke the Gen2 Cloud Run service |

## Usage

Export the function from your functions codebase entry:

```ts
// functions/src/index.ts
export { rtdblimit } from "@firebase/rtdb-limit-child-nodes";
```

and configure it with a `.env` (or `.env.<projectId>`).

Importing the package without exporting its functions deploys nothing — the CLI
only deploys what your entry file exports.

Put `RTDB_NODE_PATH` and `SELECTED_DATABASE_INSTANCE` in `.env` so
the trigger binds to the right database path and instance.

## Deploy

The package's `firebase.json` declares a `kit` stanza (Firebase CLI 15.25.1 or
later, behind the `kits` experiment):

```json
{
  "functions": [
    {
      "source": ".",
      "kit": "rtdb-limit-child-nodes",
      "instances": {
        "default": "."
      }
    }
  ]
}
```

`instances` maps each instance id to the directory (relative to
`firebase.json`) holding that instance's `.env`. The CLI prefixes every
function and task queue name with `kit-<instance id>-`, so the function above
deploys as `kit-default-rtdblimit`.

```sh
firebase experiments:enable kits
firebase deploy --only functions
```

Deploy a single instance with `firebase deploy --only functions:<instance id>`.

## Configuration

Set these values in a `.env` (or `.env.<projectId>`) file. The Firebase CLI
loads them at deploy time and prompts for any required values that are missing.
`SELECTED_DATABASE_INSTANCE` should be set so the trigger binds to the intended
Realtime Database instance.

| Field | Env var | Required | Default | Description |
|---|---|---|---|---|
| `nodePath` | `RTDB_NODE_PATH` | no | `messages` | Parent path whose children are limited |
| `maxCount` | `MAX_COUNT` | no | `100` | Maximum child nodes to retain |
| `databaseInstance` | `SELECTED_DATABASE_INSTANCE` | yes* | from `FIREBASE_CONFIG` when present | RTDB instance id |

\* Required when `FIREBASE_CONFIG` does not already imply a database instance.

## Multiple instances

To limit several Realtime Database paths, add one entry per instance to the
`instances` map, each pointing at its own config directory with its own `.env`:

```json
{
  "functions": [
    {
      "source": ".",
      "kit": "rtdb-limit-child-nodes",
      "instances": {
        "messages": "instances/messages",
        "events": "instances/events"
      }
    }
  ]
}
```

Instance ids must be unique across all kit stanzas in the project, and every
instance's function names are namespaced by its `kit-<instance id>-` prefix, so
the instances cannot collide.

## API surface

- **Main entry** (`@firebase/rtdb-limit-child-nodes`): exports `rtdblimit`. The
  main entry reads environment variables when the module loads, so use it from
  Firebase deploy/emulator/runtime. For your own triggers, import from `./lib`
  instead.
- **Library entry** (`./lib`): `handleChildCreated`, config types/helpers
  (`RtdbLimitConfig`, `resolveRtdbLimitConfig`), and related types for owning
  trigger registration yourself.

## License

Apache-2.0
