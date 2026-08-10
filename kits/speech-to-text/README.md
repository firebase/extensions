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
