# @firebase/rtdb-limit-child-nodes

<!-- FIREBASE_EXTENSION_REPLACEMENT: extension=firebase/rtdb-limit-child-nodes package=@firebase/rtdb-limit-child-nodes -->

> **Deprecation Notice:** The Firebase Extension `firebase/rtdb-limit-child-nodes` is deprecated. Please migrate to the [`@firebase/rtdb-limit-child-nodes`](https://www.npmjs.com/package/@firebase/rtdb-limit-child-nodes) package.

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

The package declares the roles below with `requiresRole(...)`. Firebase CLI
15.23.0 or later creates a managed runtime service account for the codebase,
grants it these roles, and attaches it to every function in the codebase.

| Role | Why |
|---|---|
| `roles/firebasedatabase.admin` | read and trim child nodes under the watched path |
| `roles/eventarc.eventReceiver` | receive Gen2 Realtime Database trigger events |

## Usage

Re-export the wired function from your functions codebase entry:

```ts
// functions/src/index.ts
export { rtdblimit } from "@firebase/rtdb-limit-child-nodes";
```

and configure it with a `.env` (or `.env.<projectId>`), which the Firebase CLI
loads at deploy time, prompting for anything required that is unset.

The re-export matters: the Firebase CLI discovers functions from the top-level
exports of your codebase entry, so a bare `import` of the package deploys
nothing.

The root entry keeps trigger-bound fields deploy-time safe: `NODE_PATH`,
`SELECTED_DATABASE_INSTANCE`, and `LOCATION` are passed to Firebase Functions as
param expressions/objects for trigger discovery, while `configFromEnv()` is
deferred until the first invocation.

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

Configuration is via v2 function params: env vars named as in the table below.
`SELECTED_DATABASE_INSTANCE` is explicit in the params workflow — set it in
`.env`, `.env.<projectId>`, or via the Firebase CLI prompt so the trigger always
binds to the intended Realtime Database instance.

| Field | Env var | Required | Default | Description |
|---|---|---|---|---|
| `nodePath` | `NODE_PATH` | no | `messages` | Parent path whose children are limited |
| `maxCount` | `MAX_COUNT` | no | `100` | Maximum child nodes to retain |
| `databaseInstance` | `SELECTED_DATABASE_INSTANCE` | yes* | from `FIREBASE_CONFIG` when present | RTDB instance id |
| `region` | `LOCATION` | no | `us-central1` | Function region |

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

- **Main entry** (`@firebase/rtdb-limit-child-nodes`): the wired `rtdblimit`
  function, configured from env params at load time. Because it reads the
  environment at load time, it only runs cleanly inside the Firebase toolchain
  (deploy discovery, runtime, or the emulator).
- **Library entry** (`./lib`): side-effect-free typed library surface —
  `handleChildCreated`, config types/helpers (`RtdbLimitConfig`,
  `resolveRtdbLimitConfig`), and related types for owning trigger registration
  yourself.

## License

Apache-2.0
