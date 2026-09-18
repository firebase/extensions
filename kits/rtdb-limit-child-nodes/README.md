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

Put `DATABASE_REGION`, `RTDB_NODE_PATH`, `MAX_COUNT` and
`SELECTED_DATABASE_INSTANCE` in `.env` so the function lands in the same region
as the database, the trigger binds to the right database path and instance, and
the kit knows how many children to keep. `DATABASE_REGION`, `RTDB_NODE_PATH` and
`MAX_COUNT` have no default, so the CLI prompts for any you leave out.

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
| `databaseRegion` | `DATABASE_REGION` | yes | none | Realtime Database instance location; also places the function |
| `nodePath` | `RTDB_NODE_PATH` | yes | none | Parent path whose children are limited |
| `maxCount` | `MAX_COUNT` | yes | none | Maximum child nodes to retain |
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
an installed instance's config has no effect: the kit ignores it, which leaves
`RTDB_NODE_PATH` unset, and a param with no default is prompted for, so the CLI
asks you for the path at deploy time. A deploy that cannot prompt, such as one
from CI, fails on the missing value instead. Rename the key to `RTDB_NODE_PATH`
in your `.env`.

Leading and trailing slashes are now trimmed, so `/rooms/messages/` and
`rooms/messages` are equivalent.

### `MAX_COUNT` is now an integer setting, and `0` is rejected at runtime

`MAX_COUNT` is a proper integer setting now, but the extension's `^\d+$`
validation regex is kept verbatim, so `0` still passes validation. The extension
took a `MAX_COUNT` of `0` to mean "delete every child on every write"; the kit
rejects it, along with negative and non-numeric values, with
`maxCount must be a positive integer.` on the first write to the watched path. A
fractional value is truncated rather than rejected, so `10.7` keeps 10.

### Values set in `.env` skip the install prompt's validation

The install prompts reject a path containing spaces, a non-numeric `MAX_COUNT`
and an invalid database instance id before anything is deployed, the same as the
extension did. Those checks only run when the CLI prompts you, though: a value
you write into `.env` is used as-is, and only a required param left empty is
caught at deploy, by `assertRequiredParams`.

`MAX_COUNT` of `0` reaches the handler either way, since the extension's `^\d+$`
regex accepts it, and throws on every write to the watched path:

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

The extension's install-time location is replaced by `DATABASE_REGION`, which
describes where your database instance lives rather than where you want the
function. A 2nd gen database trigger cannot cross regions. The Firebase CLI
does not check this itself, it copies the function's region onto the trigger, so
a value that disagrees with the instance is rejected when the backend creates
the function. That rejection is read from the CLI's trigger handling rather than
reproduced against a live deploy.

### The trigger is 2nd gen

`rtdblimit` is a 2nd gen Realtime Database function where the extension was 1st
gen. Its service account needs `roles/eventarc.eventReceiver` and
`roles/run.invoker` on top of `roles/firebasedatabase.admin`; the Firebase CLI
grants these for you. This otherwise only matters if you have alerting keyed to
function generation.

### DATABASE_REGION decides where the function runs

`DATABASE_REGION` tells the kit where your Realtime Database instance lives, and
the function is deployed to that region. A 2nd gen database trigger only fires
for a function in the same region as its instance, so this has to agree with the
instance you set. Database locations are Cloud Run regions already, so there is
nothing to map: the function declares the parameter itself and the Firebase CLI
substitutes your value, whether you answer the prompt or write `.env` yourself.

The value is required, and it applies to the deploy that sets it. A
non-interactive deploy with the key missing from `.env` fails with `In
non-interactive mode but have no value for the following environment variables:
DATABASE_REGION`. Give it one of the offered regions exactly as listed: a
misspelled value reaches Cloud Run as written and fails the deploy, and a blank
one is rejected at discovery before anything ships.
Note that changing the region on an existing instance deletes and recreates the
function.

`firebase ext:migrate` also writes `FUNCTION_DEFAULT_REGION` to your `.env`,
recording where the extension's function ran. Nothing reads it: placement comes
from `DATABASE_REGION` alone, so if the two disagree your next deploy moves the
function.

### Concurrency and ingress match the extension

`rtdblimit` sets `concurrency: 1` and `ingressSettings: "ALLOW_INTERNAL_ONLY"`,
overriding the 2nd gen defaults of concurrency `80` and `ALLOW_ALL`. The
extension ran on 1st gen, where an instance handled one event at a time and only
internal traffic reached the function. Existing kit deployments adopt the
restrictions on their next deploy.

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
