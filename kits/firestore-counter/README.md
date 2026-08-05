# @firebase/firestore-counter

<!-- FIREBASE_EXTENSION_REPLACEMENT: extension=firebase/firestore-counter package=@firebase/firestore-counter -->

> **Deprecation Notice:** The Firebase Extension `firebase/firestore-counter` is deprecated. Please migrate to the [`@firebase/firestore-counter`](https://www.npmjs.com/package/@firebase/firestore-counter) package.

Distributed, sharded counters for Firestore

> **Status: skeleton — not yet implemented.**
> Migrated from the `firestore-counter` Firebase Extension to an npm-shared Firebase
> Function (v2). Track the reference implementation in
> [`packages/firestore-bigquery-export`](../firestore-bigquery-export) and the
> design in [`docs/rfc.md`](../../docs/rfc.md).

Set `"private": false` in `package.json` when ready to publish.

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
