# @firebase/storage-resize-images

Resize images uploaded to Cloud Storage

> **Status: skeleton — not yet implemented.**
> Migrated from the `storage-resize-images` Firebase Extension to an npm-shared Firebase
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
      "kit": "storage-resize-images",
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
deploys as `kit-default-generateResizedImage`.

```sh
firebase experiments:enable kits
firebase deploy --only functions
```

Deploy a single instance with `firebase deploy --only functions:<instance id>`.

## Multiple instances

To resize images from several buckets or pipelines, add one entry per instance
to the `instances` map, each pointing at its own config directory with its own
`.env`:

```json
{
  "functions": [
    {
      "source": ".",
      "kit": "storage-resize-images",
      "instances": {
        "avatars": "instances/avatars",
        "uploads": "instances/uploads"
      }
    }
  ]
}
```

Instance ids must be unique across all kit stanzas in the project, and every
instance's function names are namespaced by its `kit-<instance id>-` prefix, so
the instances cannot collide.
