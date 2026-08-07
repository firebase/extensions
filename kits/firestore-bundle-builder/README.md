# @firebase/firestore-bundle-builder

Build and serve Firestore data bundles. This is the Firestore Bundle Builder
Firebase Extension as an npm package you add to your own Firebase Functions
codebase and deploy.

## Install

```sh
npm install @firebase/firestore-bundle-builder
```

## Required IAM

The package declares the roles below with `requiresRole(...)`. Firebase CLI
15.23.0 or later creates a managed runtime service account for the codebase,
grants it these roles, and attaches it to every function in the codebase.

| Role | Why |
|---|---|
| `roles/datastore.user` | read bundle specs and query source data |
| `roles/storage.objectAdmin` | write and serve bundle artifacts |
| `roles/eventarc.eventReceiver` | receive Gen2 event triggers |
| `roles/run.invoker` | allow callers/Eventarc to invoke the Gen2 Cloud Run service |

## Configuration

Configuration is via v2 function params: env vars named as in the table below.

| Field | Env var | Required | Default | Description |
|---|---|---|---|---|
| `bundleSpecCollection` | `BUNDLESPEC_COLLECTION` | no | `bundles` | Collection of bundle specs |
| `bundleStorageBucket` | `BUNDLE_STORAGE_BUCKET` | no | default Storage bucket | Bundle artifact bucket |
| `storagePrefix` | `STORAGE_PREFIX` | no | `bundles` | Object prefix for artifacts |
| `location` | `LOCATION` | no | `us-central1` | Function region |

## Deploy

The package's `firebase.json` declares a `kit` stanza (Firebase CLI 15.25.1 or
later, behind the `kits` experiment):

```json
{
  "functions": [
    {
      "source": ".",
      "kit": "firestore-bundle-builder",
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
deploys as `kit-default-serve`.

```sh
firebase experiments:enable kits
firebase deploy --only functions
```

Deploy a single instance with `firebase deploy --only functions:<instance id>`.

## Multiple instances

To serve several bundle configurations, add one entry per instance to the
`instances` map, each pointing at its own config directory with its own `.env`:

```json
{
  "functions": [
    {
      "source": ".",
      "kit": "firestore-bundle-builder",
      "instances": {
        "web": "instances/web",
        "mobile": "instances/mobile"
      }
    }
  ]
}
```

Instance ids must be unique across all kit stanzas in the project, and every
instance's function names are namespaced by its `kit-<instance id>-` prefix, so
the instances cannot collide.
