# @firebase/speech-to-text

Transcribe audio files in Cloud Storage to text. This is the Transcribe Speech to
Text Firebase Extension as an npm package you add to your own Firebase Functions
codebase and deploy.

It listens for audio files finalized in a Cloud Storage bucket, transcodes them
to LINEAR16, runs a long-running Cloud Speech-to-Text recognition, and writes the
transcript to Firestore (and/or back to Storage). The function runs in your own
Firebase project; there is no hosted version, so you deploy it yourself.

## Install

```sh
npm install @firebase/speech-to-text
```

## Required IAM

Deploy needs these Google Cloud roles and APIs for the function's service
account. Firebase CLI 15.23.0 or later creates that account, grants the roles
below, enables the listed APIs, and attaches the account to every function in
this kit. Do not set a custom runtime service account for this codebase — it
conflicts with that automatic setup.

| Role / API | Why |
|---|---|
| `roles/storage.objectAdmin` | read uploaded audio and write transcoded output |
| `roles/datastore.user` | write transcript documents to Firestore |
| `roles/eventarc.eventReceiver` | receive Gen2 Storage trigger events |
| `roles/run.invoker` | allow Eventarc to invoke the Gen2 Cloud Run service |
| `speech.googleapis.com` | transcribe audio |

## Usage

Export the function from your functions codebase entry:

```ts
// functions/src/index.ts
export { transcribeAudio } from "@firebase/speech-to-text";
```

and configure it with a `.env` (or `.env.<projectId>`).

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
      "kit": "speech-to-text",
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
deploys as `kit-default-transcribeAudio`.

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
| `bucket` | `EXTENSION_BUCKET` | no | default Storage bucket | Storage bucket to watch |
| `languageCode` | `LANGUAGE_CODE` | yes | — | BCP-47 language code |
| `model` | `MODEL` | no | `default` | Speech model |
| `outputStoragePath` | `OUTPUT_STORAGE_PATH` | no | bucket root | transcript output prefix |
| `collectionPath` | `COLLECTION_PATH` | no | (firestore disabled) | transcript collection |
| `enableAutomaticPunctuation` | `ENABLE_AUTOMATIC_PUNCTUATION` | no | `true` | Speech option |

The function timeout defaults to `540` seconds and memory to `1GiB` so long audio
does not time out mid-transcription; both are overridable via `timeoutSeconds`
and `memory`.

## Multiple instances

To run several transcription pipelines, add one entry per instance to the
`instances` map, each pointing at its own config directory with its own `.env`:

```json
{
  "functions": [
    {
      "source": ".",
      "kit": "speech-to-text",
      "instances": {
        "uploads": "instances/uploads",
        "voicemail": "instances/voicemail"
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
under the legacy extension id (kept for compatibility with existing consumers):

- `firebase.extensions.storage-transcribe-audio.v1.complete` on success
- `firebase.extensions.storage-transcribe-audio.v1.fail` on failure

## Differences from the Transcribe Speech to Text extension

This kit is version 0.1.9 of the extension repackaged as an npm package. The
pipeline is ported closely: the same trigger on finalized objects, the same
ffmpeg transcode to LINEAR16, the same long-running recognition request, the same
per-channel transcript map, the same Firestore progress document and the same two
Eventarc events. Every setting keeps its extension environment variable name and
default, so a `.env` copied from your installed instance needs no value changes.
What changes is where the intermediate audio file is written, how long the
function may run, and what is no longer checked for you.

### The transcoded copy no longer lands under `tmp/`

The extension named the transcoded WAV after the local temporary file it had just
written, so with no `OUTPUT_STORAGE_PATH` the copy appeared in your bucket as
`tmp/<original path>.wav`, and with `OUTPUT_STORAGE_PATH: transcriptions` as
`transcriptions/tmp/<original path>.wav`. The kit names it after the original
object instead: `<original path>.wav`, or
`transcriptions/<original path>.wav`.

The transcript itself is written to the same place as before
(`<original path>.wav_transcription.txt`, under `OUTPUT_STORAGE_PATH` when set),
so only the intermediate audio moves. If you have lifecycle rules, cleanup jobs
or client code that expect the WAV under a `tmp/` prefix, point them at the new
path. Both files still carry the `isTranscodeOutput` metadata flag that stops the
function from processing its own output.

### The function may now run for nine minutes

Recognition is polled to completion inside the function, and the extension ran
with the default 60 second timeout, so long audio failed part way through. The
kit sets `timeoutSeconds: 540`. Memory is unchanged at 1 GiB (`1024MB` in the
extension's terms).

Temporary files are also deleted after every invocation now. The extension left
the downloaded and transcoded files in `/tmp`, which is shared across warm
invocations of the same instance and counts against the function's memory, so a
busy instance could run itself out of space.

### Nothing checks your settings at deploy time

The extension rejected a `LANGUAGE_CODE` that did not look like a BCP-47 code and
a `COLLECTION_PATH` that was not a valid collection path, before it would install.
Neither is checked now. `LANGUAGE_CODE` is still required, so the CLI prompts for
it if it is missing, but any string is accepted and a bad value surfaces as a
Speech-to-Text error per file, with the failure recorded on the Firestore
document and in the `fail` event.

### The function has no location setting

`LOCATION` is gone. The function deploys to your codebase's default region
(`us-central1` unless you have changed it) rather than the immutable location you
picked at install.

### Create the Eventarc channel yourself for events

Choosing events at install used to create the channel and set both event
variables for you. The kit only reads them: set `EVENTARC_CHANNEL` in your `.env`
to a channel you have created, and the same
`firebase.extensions.storage-transcribe-audio.v1.complete` and `.fail` events are
published. Per-event selection is gone in practice, because the CLI rejects any
`.env` key beginning with `EXT_`, so `EXT_SELECTED_EVENTS` cannot be set and both
event types are published. With `EVENTARC_CHANNEL` unset, nothing is published and
the function is otherwise unaffected.

### `fail` events for unexpected errors now say what went wrong

Typed pipeline failures (a zero-stream file, an ffmpeg error, a null
transcription) carry the same payload as before. Unexpected errors did not: the
extension published the caught `Error` directly, and because an `Error`'s
`message` and `stack` are not serialised to JSON, subscribers received
`{"error":{}}`. The kit publishes `{ error: { message, stack } }` instead.

### The trigger is 2nd gen

`transcribeAudio` is a 2nd gen Cloud Storage function where the extension was 1st
gen. Its service account needs `roles/eventarc.eventReceiver` and
`roles/run.invoker` on top of `roles/storage.objectAdmin` and
`roles/datastore.user`; the Firebase CLI grants these for you.

### Unchanged

- `EXTENSION_BUCKET` still selects the bucket that is both watched and written
  to, and still defaults to your project's default bucket.
- `ENABLE_AUTOMATIC_PUNCTUATION` still reads the same `true` / `false` values, and
  `MODEL` still defaults to `default`.
- Firestore output is still opt-in: with `COLLECTION_PATH` unset nothing is
  written to Firestore, and with it set you still get a document per file created
  in `PROCESSING`, moved through `PROCESSING`/`FAILED`, and finished with the
  transcription and status.
- Objects with no content type, or a content type that is not `audio/*`, are
  still skipped with the same `No content type provided.` and
  `Invalid content type.` messages on the Firestore document.
- Multi-channel audio still produces a transcript per channel tag, and a file
  with more than one stream still produces a warning rather than a failure.
- There is no backfill for audio already in the bucket, as before.

## API surface

- **Main entry** (`@firebase/speech-to-text`): exports `transcribeAudio`. The
  main entry reads environment variables when the module loads, so use it from
  Firebase deploy/emulator/runtime. For your own triggers, import from `./lib`
  instead.
- **Library entry** (`./lib`): the raw `handleObjectFinalized` handler, config
  types/helpers, and the framework-agnostic transcription engine
  (`transcodeToLinear16`, `transcribeAndUpload`, `uploadTranscodedFile`).

## License

Apache-2.0
