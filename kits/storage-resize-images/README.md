# @firebase/storage-resize-images

Resize images uploaded to Cloud Storage. This is the Resize Images Firebase
Extension as an npm package you add to your own Firebase Functions codebase and
deploy.

It listens for image objects finalized in a Cloud Storage bucket, optionally
filters content, generates configured sizes/formats, and writes the resized
outputs back to Storage. The function runs in your own Firebase project; there
is no hosted version, so you deploy it yourself.

## Install

```sh
npm install @firebase/storage-resize-images
```

## Required IAM

Deploy needs these Google Cloud roles and APIs for the function's service
account. Firebase CLI 15.23.0 or later creates that account, grants the roles
below, enables the listed APIs, and attaches the account to every function in
this kit. Do not set a custom runtime service account for this codebase — it
conflicts with that automatic setup.

| Role / API | Why |
|---|---|
| `roles/storage.admin` | read originals and write resized objects |
| `roles/aiplatform.user` | optional content filtering via Vertex AI |
| `roles/eventarc.eventReceiver` | receive Gen2 Storage trigger events |
| `roles/run.invoker` | allow Eventarc to invoke the Gen2 Cloud Run service |
| `storage-component.googleapis.com` | use Cloud Storage |

## Usage

Export the function from your functions codebase entry:

```ts
// functions/src/index.ts
export { generateResizedImage } from "@firebase/storage-resize-images";
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

## Configuration

Set these values in a `.env` (or `.env.<projectId>`) file. The Firebase CLI
loads them at deploy time and prompts for any required values that are missing.

| Field | Env var | Required | Default | Description |
|---|---|---|---|---|
| `bucket` | `IMG_BUCKET` | no | default Storage bucket | Bucket to watch |
| `sizes` | `IMG_SIZES` | no | `200x200` | Comma-separated resize sizes |
| `deleteOriginal` | `DELETE_ORIGINAL_FILE` | no | `false` | Delete original after resize |
| `makePublic` | `MAKE_PUBLIC` | no | `false` | Make resized objects public |
| `resizedImagesPath` | `RESIZED_IMAGES_PATH` | no | (empty) | Output path prefix |
| `includePathList` | `INCLUDE_PATH_LIST` | no | (empty) | Paths to include |
| `excludePathList` | `EXCLUDE_PATH_LIST` | no | (empty) | Paths to exclude |
| `failedImagesPath` | `FAILED_IMAGES_PATH` | no | (empty) | Failed-image output path |
| `cacheControlHeader` | `CACHE_CONTROL_HEADER` | no | (empty) | Cache-Control for outputs |
| `imageTypes` | `IMAGE_TYPE` | no | `["false"]` | Output image types list |
| `outputOptions` | `OUTPUT_OPTIONS` | no | (empty) | JSON output options |
| `sharpOptions` | `SHARP_OPTIONS` | no | `{}` | JSON Sharp options |
| `isAnimated` | `IS_ANIMATED` | no | `true` | Preserve animation |
| `memory` | `FUNCTION_MEMORY` | no | `1024` | Function memory (MiB) |
| `regenerateToken` | `REGENERATE_TOKEN` | no | `true` | Regenerate download tokens |
| `contentFilterLevel` | `CONTENT_FILTER_LEVEL` | no | `OFF` | Content filter level |
| `customFilterPrompt` | `CUSTOM_FILTER_PROMPT` | no | (empty) | Custom filter prompt |
| `placeholderImagePath` | `PLACEHOLDER_IMAGE_PATH` | no | (empty) | Placeholder for filtered images |
| `region` | `LOCATION` | no | `us-central1` | Function region |

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

## Events

When `EVENTARC_CHANNEL` is configured, the function publishes lifecycle events
such as `onStart`, `onStartResize`, `onSuccess`, `onError`, and `onCompletion`
under `firebase.extensions.storage-resize-images.v1.*`.

## API surface

- **Main entry** (`@firebase/storage-resize-images`): exports
  `generateResizedImage`. The main entry reads environment variables when the
  module loads, so use it from Firebase deploy/emulator/runtime. For your own
  triggers, import from `./lib` instead.
- **Library entry** (`./lib`): `handleObjectFinalized` / resize helpers,
  content-filter utilities, and config types (`ResizeImagesConfig`,
  `resolveResizeImagesConfig`) for owning trigger registration yourself.

## License

Apache-2.0
