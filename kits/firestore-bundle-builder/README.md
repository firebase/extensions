# @firebase/firestore-bundle-builder

Build and serve Firestore data bundles. This is the Firestore Bundle Builder
Firebase Extension as an npm package you add to your own Firebase Functions
codebase and deploy.

It exposes an HTTPS function that reads bundle specs from Firestore, assembles
query results into a Firestore data bundle, caches the artifact in Cloud
Storage, and serves it to clients. The function runs in your own Firebase
project; there is no hosted version, so you deploy it yourself.

## Install

```sh
npm install @firebase/firestore-bundle-builder
```

## Required IAM

Deploy needs these Google Cloud roles on the function's service account.
Firebase CLI 15.23.0 or later creates that account, grants the roles below,
and attaches it to every function in this kit. Do not set a custom runtime
service account for this codebase — it conflicts with that automatic setup.

| Role | Why |
|---|---|
| `roles/datastore.user` | read bundle specs and query source data |
| `roles/storage.objectAdmin` | write and serve bundle artifacts |
| `roles/eventarc.eventReceiver` | receive Gen2 event triggers |
| `roles/run.invoker` | allow callers/Eventarc to invoke the Gen2 Cloud Run service |

## Usage

Export the function from your functions codebase entry:

```ts
// functions/src/index.ts
export { serve } from "@firebase/firestore-bundle-builder";
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

## Configuration

Set these values in a `.env` (or `.env.<projectId>`) file. The Firebase CLI
loads them at deploy time and prompts for any required values that are missing.

| Field | Env var | Required | Default | Description |
|---|---|---|---|---|
| `bundleSpecCollection` | `BUNDLESPEC_COLLECTION` | no | `bundles` | Collection of bundle specs |
| `bundleStorageBucket` | `BUNDLE_STORAGE_BUCKET` | no | default Storage bucket | Bundle artifact bucket |
| `storagePrefix` | `STORAGE_PREFIX` | no | `bundles` | Object prefix for artifacts |

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

## API surface

- **Main entry** (`@firebase/firestore-bundle-builder`): exports `serve`. The
  main entry reads environment variables when the module loads, so use it from
  Firebase deploy/emulator/runtime. For your own triggers, import from `./lib`
  instead.
- **Library entry** (`./lib`): `handleServe`, bundle assembly helpers (`build`,
  `buildQuery`), and config types (`BundleBuilderConfig`, `resolveConfig`) for
  owning trigger registration yourself.

## License

Apache-2.0
