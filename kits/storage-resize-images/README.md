# @firebase-function-kits/storage-resize-images

Resize images uploaded to Cloud Storage. This is the Resize Images Firebase
Extension as an npm package you add to your own Firebase Functions codebase and
deploy.

Each image finalized in the watched bucket is optionally checked by a Vertex AI
content filter, resized to the configured sizes and formats, and written back
to Storage.

> **Pre-release:** this kit has not been released yet. The `latest` version
> on npm is a placeholder with no kit code. Pre-release builds are published
> under the `next` tag and may change between builds, so the commands below
> install `@next`.

Terms used below: a **codebase** is a directory of Cloud Functions source the
Firebase CLI deploys as a unit. A **kit** is this package declared by a `kit`
entry in `firebase.json`. An **instance** is one configured copy of the kit,
with its own `.env` and function; the CLI deploys each instance as a codebase
named after its instance id.

## Install

This assumes the latest Firebase CLI is installed and signed in, and that you
run the commands from your Firebase project directory (the one containing
`firebase.json`; `firebase init` creates it), linked to your project
(`firebase use <project-id>`). You also need Cloud Storage on the Blaze plan
and Node.js 24 (22 or later is supported).

**Guided installer.** This creates the codebase under `function-kits/<kit-name>/`,
adds the `kit` entry to `firebase.json`, and prompts for each setting, writing
the answers to `function-kits/<kit-name>/config-<instance-id>/.env.<project-id>`:

```sh
firebase functions:kits:install --package @firebase-function-kits/storage-resize-images@next
```

It also asks for `BUCKET_REGION` and `FUNCTION_DEFAULT_REGION`. Enter your
bucket's location (see [Region](#region)).

**Your own codebase.** From the `functions/` directory that `firebase init
functions` creates, install the kit plus `firebase-functions` and
`firebase-admin` as direct dependencies, on the major versions the kit uses
(currently 7 and 13). The kit's shrinkwrap nests its own copies, which the CLI
can't see.

```sh
npm install @firebase-function-kits/storage-resize-images@next firebase-functions@7 firebase-admin@13
npm install --save-dev typescript@5
```

## Required IAM

Nothing to do by hand. Firebase CLI 15.23.0 or later creates a service account
for the kit, grants it these roles, enables the APIs, and attaches the account
to the function. Don't set a custom runtime service account: it conflicts with
that setup.

| Role / API                          | Why                                                                |
| ----------------------------------- | ------------------------------------------------------------------ |
| `roles/storage.admin`               | read originals and write resized objects                           |
| `roles/aiplatform.user`             | optional content filtering via Vertex AI                           |
| `roles/eventarc.eventReceiver`      | receive Storage trigger events                                     |
| `roles/run.invoker`                 | let Eventarc invoke the function                                   |
| `roles/eventarc.publisher`          | publish the kit's [events](#events) (the extension got this implicitly) |
| `aiplatform.googleapis.com`         | Vertex AI content filtering, if enabled                            |
| `storage-component.googleapis.com`  | use Cloud Storage                                                  |
| `eventarcpublishing.googleapis.com` | publish the kit's events                                           |

## Usage

With your own codebase, this layout keeps the codebase and the instance's
`.env` in the `functions/` directory that `firebase init functions` creates:

```text
my-project/
  .firebaserc
  firebase.json
  functions/
    package.json    # "main": "lib/index.js", "engines": { "node": "24" }, "scripts": { "build": "tsc" }
    tsconfig.json   # compiles src/ to lib/
    .env
    src/index.ts
```

```ts
// functions/src/index.ts
export { generateResizedImage } from "@firebase-function-kits/storage-resize-images";
```

```sh
# functions/.env
BUCKET_REGION=us-central1     # your bucket's location
IMG_BUCKET=<project-id>.firebasestorage.app
IMG_SIZES=200x200
RESIZED_IMAGES_PATH=thumbnails
FAILED_IMAGES_PATH=failed
```

Any setting you leave out is asked for at deploy (see
[Configuration](#configuration)). Importing the package without exporting
`generateResizedImage` deploys nothing: the CLI only deploys what your entry
file exports.

## Deploy

In the `functions` entry `firebase init` created, add `kit` and `instances` and
remove `codebase` (a `kit` entry can't have one). This needs Firebase CLI
15.27.0 or later, behind the `kits` experiment:

```json
{
  "functions": [
    {
      "source": "functions",
      "kit": "storage-resize-images",
      "instances": { "default": "functions" },
      "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"]
    }
  ]
}
```

`instances` maps each instance id to the directory (relative to
`firebase.json`) holding its `.env`. Function names get a `kit-<instance-id>-`
prefix, so this deploys `kit-default-generateResizedImage`. Commands that take
a codebase take the instance id.

```sh
firebase experiments:enable kits
firebase deploy --only functions                 # all instances
firebase deploy --only functions:<instance-id>   # one instance
```

**Check that it works.** Upload a JPEG or PNG, for example `cat.jpg`, to the
root of `IMG_BUCKET` in the
[Firebase console](https://console.firebase.google.com/). With the `.env` from
[Usage](#usage), `thumbnails/cat_200x200.jpg` appears next to it within a few
seconds. If it doesn't, check `firebase functions:log --only
kit-<instance-id>-generateResizedImage` for `Completed execution of extension`
or an error (see [Failure handling](#failure-handling)).

Only images uploaded after the deploy are resized. There is no backfill, as
with the extension.

## Configuration

Settings go in the instance's `.env` (or `.env.<project-id>`). If a setting
isn't there, the deploy asks you for it, optional ones included, and saves your
answer to `.env.<project-id>`. A non-interactive deploy fails instead, so set
every variable.

A setting with **No** under "Can be blank" fails the deploy on a line like
`IMG_SIZES=`. Give it a value, or remove the line and answer the prompt.

| Field                  | Env var                   | Can be blank | Default                | Description                                                                                |
| ---------------------- | ------------------------- | ------------ | ---------------------- | ------------------------------------------------------------------------------------------ |
| `bucketRegion`         | `BUCKET_REGION`           | Yes          | (prompted)             | Cloud Storage bucket location; also places the function ([Region](#region))                |
| (none)                 | `FUNCTION_DEFAULT_REGION` | Yes          | (prompted)             | Function region when `BUCKET_REGION` is empty ([Region](#region))                          |
| `bucket`               | `IMG_BUCKET`              | No           | default Storage bucket | Bucket to watch                                                                            |
| `sizes`                | `IMG_SIZES`               | No           | `200x200`              | Comma-separated resize sizes                                                               |
| `deleteOriginal`       | `DELETE_ORIGINAL_FILE`    | No           | `false`                | Delete original after resize; omitted in code means `on_success` (see note below)          |
| `makePublic`           | `MAKE_PUBLIC`             | Yes          | `false`                | Make resized objects public                                                                |
| `resizedImagesPath`    | `RESIZED_IMAGES_PATH`     | Yes          | (empty)                | Output path prefix                                                                         |
| `includePathList`      | `INCLUDE_PATH_LIST`       | Yes          | (empty)                | Comma-separated absolute paths to include (for example, `/users/avatars,/design/pictures`) |
| `excludePathList`      | `EXCLUDE_PATH_LIST`       | Yes          | (empty)                | Comma-separated absolute paths to exclude (for example, `/users/avatars/thumbs`)           |
| `failedImagesPath`     | `FAILED_IMAGES_PATH`      | Yes          | (empty)                | Where to copy originals that failed ([Failure handling](#failure-handling))                |
| `cacheControlHeader`   | `CACHE_CONTROL_HEADER`    | Yes          | (empty)                | Cache-Control for outputs                                                                  |
| `imageTypes`           | `IMAGE_TYPE`              | No           | `["false"]`            | Output image types list                                                                    |
| `outputOptions`        | `OUTPUT_OPTIONS`          | Yes          | (empty)                | JSON output options                                                                        |
| `sharpOptions`         | `SHARP_OPTIONS`           | Yes          | `{}`                   | JSON Sharp options                                                                         |
| `isAnimated`           | `IS_ANIMATED`             | Yes          | `true`                 | Preserve animation; an empty value means `false` (see note below)                          |
| `memory`               | `FUNCTION_MEMORY`         | No           | `1024`                 | Function memory (MiB)                                                                      |
| `regenerateToken`      | `REGENERATE_TOKEN`        | Yes          | `true`                 | Regenerate download tokens                                                                 |
| `contentFilterLevel`   | `CONTENT_FILTER_LEVEL`    | No           | `OFF`                  | Content filter level                                                                       |
| `customFilterPrompt`   | `CUSTOM_FILTER_PROMPT`    | Yes          | (empty)                | Custom filter prompt                                                                       |
| `placeholderImagePath` | `PLACEHOLDER_IMAGE_PATH`  | Yes          | (empty)                | Placeholder for filtered images                                                            |
| (none)                 | `EVENTARC_CHANNEL`        | Yes          | (unset)                | Channel for the kit's [events](#events); unset or blank disables                           |
| (none)                 | `EXT_SELECTED_EVENTS`     | Yes          | (unset)                | Event types to publish; unset publishes all, blank publishes none                          |

Single-quote JSON values such as `SHARP_OPTIONS` and `OUTPUT_OPTIONS`. In an
unquoted value, `#` starts a comment and cuts the rest of the value off:

```sh
SHARP_OPTIONS='{"fit":"contain","background":"#ff0000"}'
```

The deploy fails, naming the variable, if `IMG_SIZES` is not a list of
`WIDTHxHEIGHT` values, if `SHARP_OPTIONS` is not a JSON object, if
`OUTPUT_OPTIONS` is not wrapped in `{}`, or if `INCLUDE_PATH_LIST` or
`EXCLUDE_PATH_LIST` is not a comma-separated list of absolute paths.

The `deleteOriginal` default above is what the CLI proposes at the deploy
prompt. Omitting `deleteOriginal` in a direct call to
`resolveResizeImagesConfig` deletes the original on a successful resize, as the
extension did for an unset `DELETE_ORIGINAL_FILE`; pass `"false"` to keep
originals.

An empty `IS_ANIMATED=` line is treated as `false`, not as the `true` default:
the deploy accepts it without a prompt, and animated GIF and WebP images are
resized to their first frame only.

## Multiple instances

Add one entry per instance, each with its own config directory and `.env`.
Instance ids must be unique across the project. In a project set up by
`firebase functions:kits:install`, add them to the entry it wrote. Running the
install again adds an instance with a generated id; to choose the id, copy an
existing config directory and add it to `instances` yourself.

```json
"instances": {
  "storage-resize-images": "function-kits/storage-resize-images/config-storage-resize-images",
  "avatars": "function-kits/storage-resize-images/config-avatars"
}
```

Each instance's `.env` must be complete, including `FUNCTION_DEFAULT_REGION`.
Remove one instance with `firebase functions:kits:uninstall --instance <id>`;
the others keep running.

## Events

With `EVENTARC_CHANNEL` set, the function publishes `onStart`, `onStartResize`,
`onSuccess`, `onError` and `onCompletion` under
`firebase.extensions.storage-resize-images.v1.*`. `EXT_SELECTED_EVENTS` filters
by exact type. A config exported from the extension carries its
`EXT_SELECTED_EVENTS` over, so check it lists what you expect.

The events' `source` differs from the extension's; see
[Differences](#differences-from-the-resize-images-extension).

## Failure handling

The trigger never retries, and 2nd gen records every event as HTTP 200, so
alert on the function's logs rather than its request status.

1. **A size fails to resize, or content filtering errors** (after 3 attempts).
   The function logs `Failed execution of extension` at ERROR and copies the
   original to `FAILED_IMAGES_PATH` (when set), relative to the original's
   directory, with `resizeFailed: true` in its metadata. The original isn't
   deleted under `DELETE_ORIGINAL_FILE=on_success`. When filtering succeeded,
   `onSuccess` is still published, with each size's result in `outputs`.
2. **The content filter blocks the image.** The original is copied to
   `FAILED_IMAGES_PATH` with `contentFilterFailed: true` as well, and the
   placeholder is resized in its place.
3. **Any other error** (for example a failed download or upload). The function
   logs `Error when resizing image` at ERROR and publishes `onError`.
4. **A timeout or out-of-memory kill** stops the function before it can log an
   error. An out-of-memory kill is logged at ERROR in the `varlog/system` log
   as `Memory limit of ... exceeded`. A timeout is never logged at ERROR, so an
   alert on ERROR alone misses it: Cloud Run logs it at INFO in the requests
   log as
   `The request has been terminated because it has reached the maximum request timeout.`

Copies under `FAILED_IMAGES_PATH` are never resized. To retry an image, upload
the original again to its original path.

## Migrating from the extension

Run the migration from your Firebase project directory, naming the extension
instance to replace (without `--ext-instance`, it asks you to pick one). While
the kit is pre-release, pass the `next` build with `--package`:

```sh
firebase ext:migrate --ext-instance <instance-id> \
  --package @firebase-function-kits/storage-resize-images@next
```

It exports the instance's configuration, sets `FUNCTION_DEFAULT_REGION` to the
region the extension's function ran in, prompts for `BUCKET_REGION`, deploys
the kit, then offers to uninstall the extension. Keep the extension until the
kit resizes an upload (see [Check that it works](#deploy)), then uninstall it:

```sh
firebase ext:uninstall <instance-id>
```

While both run, each upload is resized twice, to the same output paths.

To set up the kit yourself instead, write the instance's configuration to an
existing kit instance's config directory, then deploy:

```sh
firebase ext:export --mode functions --instance <instance-id> --kit-instance <kit-instance-id>
```

## Differences from the Resize Images extension

Every setting keeps its name, type, default and meaning, so an existing `.env`
carries over. Resizing, output naming, metadata, download-token regeneration
and event types are unchanged.

- **Region.** The extension's install-time `LOCATION` is gone. See
  [Region](#region).
- **The trigger is 2nd gen.** `FUNCTION_MEMORY` accepts the same values (512
  through 8192). Like the extension, the function handles one event per
  instance and gets the CPU 1st gen gave that memory size, so a burst of
  uploads scales out. Ingress is fixed to internal-only, since only Eventarc
  calls it; `setGlobalOptions` can't change concurrency, CPU or ingress, so the
  ingress `ext:migrate` carries over doesn't apply.
- **At most 100 images resize at once by default**, where the extension could
  scale to 3000. Raise it with `setGlobalOptions({ maxInstances })` from
  `firebase-functions/v2`. After `ext:migrate`, the extension's limit is
  already set this way: check `EXT_MIGRATED_SYSTEM_MAXINSTANCES` in `.env`. The
  instances must fit your Cloud Run quota in the function's region; too high a
  value fails the deploy with an error such as `Max instances must be set to
  2500 or fewer to set the requested total CPU`.
- **Event source.** The extension's events had the `source`
  `//firebaseextensions.googleapis.com/extensions/projects/<project>/instances/<instance>`.
  The kit's have
  `projects/<project>/locations/<region>/services/kit-<instance-id>-generateResizedImage`.
  A trigger filtering on the old `source` silently receives nothing. Change the
  filter, or give each instance its own `EVENTARC_CHANNEL`.
- **Path lists are validated at deploy.** A malformed `INCLUDE_PATH_LIST` or
  `EXCLUDE_PATH_LIST` fails the deploy with `Invalid includePathList: must be a
  comma-separated list of absolute path values.` instead of an install prompt.
- **An omitted `isAnimated` keeps animation for library callers.** The
  extension's parser resolved an unset `IS_ANIMATED` to first-frame-only, though
  its declared default was `true`. Omitting `isAnimated` in a direct call to
  `resolveResizeImagesConfig` now resolves to `true`. The deployed function is
  unchanged: an `IS_ANIMATED` absent from the runtime environment still means
  `false`.
- **A failed event publish** only logs a warning. The extension failed the
  function, so a failed `onStart` publish meant the image was never resized.

### Region

`BUCKET_REGION` is your bucket's location, and the function deploys to the
Cloud Run region derived from it, since a 2nd gen storage trigger can't cross
regions. Regional locations (`europe-west4`, `us-east1`, ...) are used as-is,
matched case-insensitively. Multi-regions map to a region inside them: `us` to
`us-east1`, `eu` to `europe-west1`, `asia` to `asia-east1`. A mismatch with the
bucket fails the deploy with `A function in region <region> cannot listen to a
bucket in region <region>`.

- **Dual-region buckets** (`nam4`, `eur4`, `asia1`) aren't mapped. Pick one of
  the pair: `us-central1` or `us-east1` for `nam4`, `europe-north1` or
  `europe-west4` for `eur4`, `asia-northeast1` or `asia-northeast2` for
  `asia1`. The function still receives the bucket's events. Naming the
  dual-region itself fails with `Location nam4 is not found or access is
  unauthorized`.
- **`europe-north2` and `northamerica-south1`** have no Cloud Functions
  location, so the kit can't serve a bucket there. Keep the extension, or move
  the bucket.
- **Content filtering** calls Vertex AI in the function's region (or
  `us-central1` when it is unknown, such as from the library). Where Gemini
  isn't served, filtering fails and images go to `FAILED_IMAGES_PATH`
  unresized. Leave `CONTENT_FILTER_LEVEL=OFF` or pick a supported region.

Set `BUCKET_REGION` in `.env` before the first deploy.
`functions:kits:install` and `ext:migrate` do this; with plain `firebase
deploy`, a value given at the prompt only applies from the next deploy.
Placement needs firebase-tools 15.28.0 or later; older CLIs ignore `.env`
during discovery, so upgrading the CLI can itself move the function.

With `BUCKET_REGION=` left blank, the function goes to
`FUNCTION_DEFAULT_REGION` in installer- or migrate-generated codebases (which
must then match the bucket; if both are blank the deploy fails), and otherwise
to `us-central1` on a first deploy. Omitting the line is not the same as
leaving it blank: a non-interactive deploy fails with `In non-interactive mode
but have no value for the following environment variables: BUCKET_REGION`.
Changing region, through either variable, deletes and recreates the function.

## API surface

- **Main entry** (`@firebase-function-kits/storage-resize-images`):
  `generateResizedImage` and everything from the library entry. It reads
  environment variables when the module loads, so use it from a Firebase
  deploy, the emulator or the runtime.
- **Library entry** (`@firebase-function-kits/storage-resize-images/lib`):
  `handleObjectFinalized` and the resize helpers for registering triggers
  yourself, content-filter utilities, and the config types
  (`ResizeImagesConfig`, `resolveResizeImagesConfig`).

## Reporting bugs

File bugs in the
[firebase/extensions issue tracker](https://github.com/firebase/extensions/issues/new?template=bug.md)
using the bug template, with `storage-resize-images kit` in the title. Include:

- The kit version (run `npm ls @firebase-function-kits/storage-resize-images`
  in your `functions/` or `function-kits/<kit-name>/` directory), your
  `firebase-tools` version (`firebase --version`) and Node.js version.
- Your configuration, with secrets and project details redacted. This is
  `functions/.env`, or `function-kits/<kit-name>/config-<instance-id>/.env.<project-id>`
  if you used the guided installer.
- Steps to reproduce, the result you expected, and the result you got.
- Logs from the `generateResizedImage` function in Cloud Logging (with its
  `kit-<instance-id>-` prefix if you deploy instances).

If you migrated from the extension, say so and include the extension version
you migrated from.

## License

Apache-2.0
