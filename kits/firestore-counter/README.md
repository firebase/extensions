# @firebase/firestore-counter

Distributed, sharded counters for Firestore. This is the Distributed Counter
Firebase Extension as an npm package you add to your own Firebase Functions
codebase and deploy.

## Install

```sh
npm install @firebase/firestore-counter
```

## Required IAM

The package declares the roles below with `requiresRole(...)`. Firebase CLI
15.23.0 or later creates a managed runtime service account for the codebase,
grants it these roles, and attaches it to every function in the codebase.

| Role | Why |
|---|---|
| `roles/datastore.user` | read/write counter shards and aggregate docs |
| `roles/cloudscheduler.admin` | schedule the controller that flushes shards |
| `roles/eventarc.eventReceiver` | receive Gen2 Firestore trigger events |
| `roles/run.invoker` | allow Eventarc/Scheduler to invoke the Gen2 Cloud Run service |

## Configuration

Configuration is via v2 function params: env vars named as in the table below.

| Field | Env var | Required | Default | Description |
|---|---|---|---|---|
| `internalStatePath` | `INTERNAL_STATE_PATH` | no | `_firebase_ext_/sharded_counter` | Firestore path for controller state |
| `scheduleFrequencyMinutes` | `SCHEDULE_FREQUENCY` | no | `1` | Controller schedule frequency (minutes) |
| `region` | `LOCATION` | no | `us-central1` | Function region |

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
