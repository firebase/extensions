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
| `roles/storage.objectAdmin` | save built bundles in Cloud Storage when `fileCache` is set |
| `roles/eventarc.eventReceiver` | receive Gen2 event triggers |
| `roles/run.invoker` | allow callers/Eventarc to invoke the Gen2 Cloud Run service |

## Usage

Export the function from your functions codebase entry:

```ts
// functions/src/index.ts
export { serve } from "@firebase/firestore-bundle-builder";
```

and configure with a `.env` (or `.env.<projectId>`).

Call `serve` with the bundle ID as the last URL path segment. Query params fill
bundle-spec parameters (for example `?name=david&limit=10`), not the id:

```
https://us-central1-<project>.cloudfunctions.net/kit-<instance>-serve/:bundleId
https://us-central1-<project>.cloudfunctions.net/kit-<instance>-serve/:bundleId?name=david&limit=10
```

A Hosting rewrite to `/bundles/*` serves the same way: `/bundles/:bundleId`.

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

## Differences from the Firestore Bundle Builder extension

This kit is the extension repackaged as an npm package. Config is a
lift-and-shift (`BUNDLESPEC_COLLECTION`, `BUNDLE_STORAGE_BUCKET` and
`STORAGE_PREFIX` keep their names, defaults and meanings), but several
behaviours changed. If you are moving from an installed extension instance,
read this section before you deploy.

### Bundle specs are read per request

The extension opened a snapshot listener on the whole spec collection at
startup and served every request from an in-memory copy. This kit reads the
spec document directly on each request.

Three consequences:

- Spec edits take effect immediately, with no dependence on listener delivery,
  and there is no cold-start window where a request waits for the first
  snapshot.
- A deleted spec now returns 404. The extension kept serving it, because
  entries were only ever added to the in-memory map, never removed.
- Each request costs one document read. If you serve high volumes of
  uncacheable bundles, budget for that.

### The Cloud Storage cache behaves differently on a miss

When a spec sets `fileCache`, the extension asked Cloud Storage for a read
stream without first checking the object existed. A missing object failed
asynchronously, after the response was already being written. This kit confirms
the object exists before streaming, and falls through to rebuilding the bundle
when it does not.

Failures writing the built bundle back to Cloud Storage are now logged rather
than left unhandled. The response is still served from the freshly built
bundle.

### `fileCache` is not a time-to-live

Worth stating plainly, since the name suggests otherwise: a cached bundle is
served regardless of age. `fileCache` controls *whether* a bundle is cached,
not for how long. This matches the extension, which accepted a `ttlSec` value
and never enforced it. Use `clientCache` and `serverCache` for cache-control
headers if you need expiry.

### Path parameters are validated

Parameter values substituted into a bundle spec's document or collection path
are now rejected if they contain a `/`, or if they resolve to an empty value.
Both cases return an invalid-argument error and are logged. The extension
substituted them as-is, which allowed a caller to reach a path the spec author
did not intend.

If a spec legitimately relies on a parameter expanding to a multi-segment path,
it will now fail. Split it into separate parameters, one per path segment.

### Requests without a bundle ID return 404

A request to the function root, or with a trailing slash, returns 404 with the
usual "could not find bundle" message. The extension returned a 500 in that
case. Note the ID is the last path segment, not a query parameter, so `?id=x`
has never selected a bundle.

### Comma-separated values for `in` queries

A query condition using `in` or `not-in` accepts a comma-separated string and
splits it. Non-string values are now passed through unchanged rather than
being forced through string splitting, which used to throw.

### Region

`serve` deploys to `us-central1`, the same region the extension pinned. This is
fixed by the package rather than chosen at install time.

### Disabling the Storage cache

Setting `BUNDLE_STORAGE_BUCKET` to an empty value disables the Storage cache
outright, and specs with `fileCache` are built fresh on every request. The
default is your project's default Storage bucket, as before.

### The admin dashboard is not included

The extension shipped a separate Remix admin dashboard for authoring bundle
specs. It is not part of this package. Bundle spec documents are ordinary
Firestore documents, so you can keep using the dashboard from the extension
repository against the same collection, or write the documents yourself.

### Runtime

The functions run on Node 22 with 2nd gen Cloud Functions, where the extension
was on Node 14 with 1st gen. Bundle format and the client-side APIs for loading
bundles are unaffected.

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
