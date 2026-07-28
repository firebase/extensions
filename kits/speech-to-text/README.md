# @firebase/speech-to-text

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

## Required Resources

The package declares these roles and APIs during deploy discovery:

| Role / API | Why |
|---|---|
| `roles/storage.objectAdmin` | read uploaded audio and write transcoded output |
| `roles/datastore.user` | write transcript documents to Firestore |
| `speech.googleapis.com` | transcribe audio |

## Usage

Export the clone-and-deploy entry point, which reads
[v2 function params](https://firebase.google.com/docs/functions/config-env) from
your `.env`:

```ts
export { transcribeAudio } from "@firebase/speech-to-text";
```

### Config

| Field | Env var | Required | Default | Notes |
|---|---|---|---|---|
| `bucket` | `EXTENSION_BUCKET` | yes | — | Storage bucket to watch |
| `languageCode` | `LANGUAGE_CODE` | yes | — | BCP-47 language code |
| `model` | `MODEL` | no | `default` | Speech model |
| `outputStoragePath` | `OUTPUT_STORAGE_PATH` | no | bucket root | transcript output prefix |
| `collectionPath` | `COLLECTION_PATH` | no | (Firestore disabled) | transcript collection |
| `enableAutomaticPunctuation` | `ENABLE_AUTOMATIC_PUNCTUATION` | no | `true` | Speech option |
| `location` | `LOCATION` | no | `us-central1` | function region |

The function timeout defaults to `540` seconds and memory to `1GiB` so long audio
does not time out mid-transcription; both are overridable via `timeoutSeconds`
and `memory`.

## Events

When `EVENTARC_CHANNEL` is configured, the function publishes:

- `firebase.extensions.storage-transcribe-audio.v1.complete` on success
- `firebase.extensions.storage-transcribe-audio.v1.fail` on failure

## Library surface (`./lib`)

`@firebase/speech-to-text/lib` re-exports the raw `handleObjectFinalized`
handler, config types/helpers, and the framework-agnostic transcription engine
(`transcodeToLinear16`, `transcribeAndUpload`, `uploadTranscodedFile`) with no
load-time side effects.
