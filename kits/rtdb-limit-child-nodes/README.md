# @firebase-function-kits/rtdb-limit-child-nodes

Limit the number of child nodes under a Realtime Database path. This is the
Limit Child Nodes Firebase Extension as an npm package you add to your own
Firebase Functions codebase and deploy.

It listens for child creates under a path, and when the parent exceeds the
configured max count it deletes the oldest children. The function runs in your
own Firebase project; there is no hosted version, so you deploy it yourself.

## Install

```sh
npm install @firebase-function-kits/rtdb-limit-child-nodes
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
export { rtdblimit } from "@firebase-function-kits/rtdb-limit-child-nodes";
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

## Differences from the Limit Child Nodes extension

This kit is the extension repackaged as an npm package. The trimming logic is
identical: it still watches direct children of one path, counts the parent's
children on every create, and deletes the oldest first until the maximum is met.
Your data is untouched by the move. What changes is the name of one setting, when
bad values are caught, and where the function runs.

### `NODE_PATH` is now `RTDB_NODE_PATH`

Node.js reserves `NODE_PATH` for its own module resolution and overwrites it in
the function runtime, so the setting had to be renamed. Copying `NODE_PATH` from
an installed instance's config has no effect: the kit ignores it and falls back
to its default of `messages`, so it watches the wrong path and silently trims
nothing you care about. Rename the key to `RTDB_NODE_PATH` in your `.env`.

Leading and trailing slashes are now trimmed, so `/rooms/messages/` and
`rooms/messages` are equivalent.

### `MAX_COUNT` now defaults to 100, and 0 is rejected

Both settings were required at install; both now have defaults
(`RTDB_NODE_PATH: messages`, `MAX_COUNT: 100`), so an incomplete config deploys
instead of stopping to ask you. `MAX_COUNT` is also a proper integer setting now.
The extension accepted `0`, which meant "delete every child on every write"; the
kit rejects it along with negative and non-integer values.

### Bad settings surface on the first write, not at install

The install prompts used to reject a path containing spaces, a non-numeric
`MAX_COUNT` and an invalid database instance id before anything was deployed.
Those checks now run when the function handles its first event, so a bad value
deploys cleanly and then throws on every write to the watched path:

```
maxCount must be a positive integer.
```

The parent node is not trimmed, and the only sign is the error in your function
logs.

### `SELECTED_DATABASE_INSTANCE` and the function's region

`SELECTED_DATABASE_INSTANCE` still defaults to your project's default database,
read from `FIREBASE_CONFIG` rather than injected by the install flow. If your
`FIREBASE_CONFIG` has no `databaseURL`, there is no default and the CLI prompts
for the instance at deploy time.

The function itself no longer has a location setting. It deploys to your
codebase's default region (`us-central1` unless you have changed it) rather than
the location you picked at install.

### The trigger is 2nd gen

`rtdblimit` is a 2nd gen Realtime Database function where the extension was 1st
gen. Its service account needs `roles/eventarc.eventReceiver` and
`roles/run.invoker` on top of `roles/firebasedatabase.admin`; the Firebase CLI
grants these for you. This otherwise only matters if you have alerting keyed to
function generation.

### Unchanged

- The trigger fires on creates of direct children of the watched path, and the
  parent is trimmed by deleting the oldest children first in a single update.
- Nothing is deleted while the child count is at or below `MAX_COUNT`.
- Errors are caught and logged rather than retried, and the log messages are
  the same.
- There are no events to subscribe to; the extension did not publish any either.

## API surface

- **Main entry** (`@firebase-function-kits/rtdb-limit-child-nodes`): exports `rtdblimit`. The
  main entry reads environment variables when the module loads, so use it from
  Firebase deploy/emulator/runtime. For your own triggers, import from `./lib`
  instead.
- **Library entry** (`./lib`): `handleChildCreated`, config types/helpers
  (`RtdbLimitConfig`, `resolveRtdbLimitConfig`), and related types for owning
  trigger registration yourself.

## License

Apache-2.0
