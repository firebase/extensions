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
| `includePathList` | `INCLUDE_PATH_LIST` | no | (empty) | Comma-separated absolute paths to include (for example, `/users/avatars,/design/pictures`) |
| `excludePathList` | `EXCLUDE_PATH_LIST` | no | (empty) | Comma-separated absolute paths to exclude (for example, `/users/avatars/thumbs`) |
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

## Differences from the Resize Images extension

This kit is the extension repackaged as an npm package. It is a close port: every
setting keeps its name, type, default and meaning, so an existing `.env` is a
lift-and-shift, and the resizing behaviour, output naming, metadata handling,
download-token regeneration and Eventarc events are unchanged. The differences
below are worth knowing before you deploy.

### Content filtering runs in the function's region

When `CONTENT_FILTER_LEVEL` is set (or you supply a `CUSTOM_FILTER_PROMPT`),
the Vertex AI call now uses the region the function is deployed to. The
extension used the region you picked at install time, falling back to
`us-central1`.

Gemini is not available in every region. If you deploy to a region it does not
serve, filtering fails and the image is treated as a filter error: it is not
resized, and the original is written to your `FAILED_IMAGES_PATH`. Deploy to a
region with Vertex AI support if you use content filtering, or leave
`CONTENT_FILTER_LEVEL` at `OFF`, in which case no Vertex call is made at all.

### The trigger is 2nd gen

`generateResizedImage` is a 2nd gen Cloud Storage function, where the extension
was 1st gen. `FUNCTION_MEMORY` still accepts the same values (512 through 8192)
and maps onto the equivalent 2nd gen memory setting.

The function's service account needs `roles/eventarc.eventReceiver` and
`roles/run.invoker` on top of the roles the extension asked for. The Firebase
CLI grants these for you.

### Region

The function deploys to your codebase's default region (`us-central1` unless
you have changed it), rather than a region chosen at install time. See the
content filtering note above, since the two are now linked.

### Path lists are validated at deploy time

`INCLUDE_PATH_LIST` and `EXCLUDE_PATH_LIST` must still be comma-separated
absolute paths, but the check now runs when the function loads rather than when
the extension is installed. A malformed value fails the deploy with
`Invalid includePathList: must be a comma-separated list of absolute path
values.` rather than being rejected by an install prompt.

### No backfill

There is no function to resize images that already exist in the bucket. The
extension carried the same limitation (its backfill function was disabled), so
this is not a regression, but it is worth stating: only objects uploaded after
you deploy are resized.

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
