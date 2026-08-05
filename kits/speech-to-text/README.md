# @firebase/speech-to-text

<!-- FIREBASE_EXTENSION_REPLACEMENT: extension=googlecloud/speech-to-text package=@firebase/speech-to-text -->

> **Deprecation Notice:** The Firebase Extension `googlecloud/speech-to-text` is deprecated. Please migrate to the [`@firebase/speech-to-text`](https://www.npmjs.com/package/@firebase/speech-to-text) package.

Transcribe audio files in Cloud Storage to text. This is the Transcribe Speech to
Text Firebase Extension as a deployable Firebase Functions package.

It listens for audio files finalized in a Cloud Storage bucket, transcodes them
to LINEAR16, runs a long-running Cloud Speech-to-Text recognition, and writes the
transcript to Firestore (and/or back to Storage). The function runs in your own
Firebase project; there is no hosted version, so you deploy it yourself.

## Install

```sh
npm install @firebase/speech-to-text
```

If you do not have a Functions codebase yet, the fastest start is to scaffold the
ready-made example instead (it uses this package):

```sh
npx degit FirebasePrivate/extensions/examples/speech-to-text#speech-to-text-npm my-transcriber
```

## Required IAM

The package declares these roles and APIs during deploy discovery. Firebase CLI
15.23.0 or later creates a managed runtime service account for the codebase,
grants it these roles, and attaches it to every function in the codebase.

| Role / API | Why |
|---|---|
| `roles/storage.objectAdmin` | read uploaded audio and write transcoded output |
| `roles/datastore.user` | write transcript documents to Firestore |
| `roles/eventarc.eventReceiver` | receive Gen2 Storage trigger events |
| `speech.googleapis.com` | transcribe audio |

## Usage

Re-export the wired function from your functions codebase entry:

```ts
// functions/src/index.ts
export { transcribeAudio } from "@firebase/speech-to-text";
```

and configure it with a `.env` (or `.env.<projectId>`), which the Firebase CLI
loads at deploy time, prompting for anything required that is unset.

The re-export matters: the Firebase CLI discovers functions from the top-level
exports of your codebase entry, so a bare `import` of the package deploys
nothing.

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

Configuration is via v2 function params: env vars named as in the table below.

| Field | Env var | Required | Default | Notes |
|---|---|---|---|---|
| `bucket` | `EXTENSION_BUCKET` | yes | — | Storage bucket to watch |
| `languageCode` | `LANGUAGE_CODE` | yes | — | BCP-47 language code |
| `model` | `MODEL` | no | `default` | Speech model |
| `outputStoragePath` | `OUTPUT_STORAGE_PATH` | no | bucket root | transcript output prefix |
| `collectionPath` | `COLLECTION_PATH` | no | (firestore disabled) | transcript collection |
| `enableAutomaticPunctuation` | `ENABLE_AUTOMATIC_PUNCTUATION` | no | `true` | Speech option |
| `location` | `LOCATION` | no | `us-central1` | function region |

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

When `EVENTARC_CHANNEL` is configured, the function publishes:

- `firebase.extensions.storage-transcribe-audio.v1.complete` on success
- `firebase.extensions.storage-transcribe-audio.v1.fail` on failure

## API surface

- **Main entry** (`@firebase/speech-to-text`): the wired `transcribeAudio`
  function, configured from env params at load time. Because it reads the
  environment at load time, it only runs cleanly inside the Firebase toolchain
  (deploy discovery, runtime, or the emulator).
- **Library entry** (`./lib`): the raw `handleObjectFinalized` handler, config
  types/helpers, and the framework-agnostic transcription engine
  (`transcodeToLinear16`, `transcribeAndUpload`, `uploadTranscodedFile`) with no
  load-time side effects.

## License

Apache-2.0
