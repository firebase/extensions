# speech-to-text — port spec

> **Executable spec.** Port `speech-to-text` (Storage transcribe-audio) to an
> npm-shared **v2** Firebase Function. 1:1 behaviour — no new features.
>
> - **Reference source:** [`./legacy`](./legacy) — vendored from
>   `GoogleCloudPlatform/firebase-extensions@4d2a7f9`, path `speech-to-text/`.
>   Reference only. (Large `.wav` test fixtures were stripped on vendoring.)
> - **Pattern to copy:** [`../firestore-bigquery-export`](../firestore-bigquery-export),
>   keep `events.ts`; drop tracker/queue/init.
> - **Background:** [`../../plans/migration/extensions/speech-to-text.md`](../../plans/migration/extensions/speech-to-text.md)
> - **Difficulty:** medium. One storage trigger, no secret, no lifecycle.

## Legacy source map (`./legacy/functions/src`)

- `index.ts` — the `transcribeAudio` function: v1 Storage `object.finalize`.
- `transcribe-audio.ts` — calls the **Speech API** (sync or long-running),
  builds the transcript.
- `firestore.ts` — writes transcript/state to `COLLECTION_PATH`.
- `util.ts`, `types.ts`, `config.ts`, `logs.ts`. Eventarc events
  `...storage-transcribe-audio.v1.complete` / `.fail`.

## Trigger mapping (v1 → v2)

| Legacy                                  | v2                                                                           |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| `functions.storage.object().onFinalize` | `onObjectFinalized` (`firebase-functions/storage`) with `bucket` from config |

## Config (`ExportConfig` ← params)

| Param                          | Field                  | Type    | Default       | Notes                                         |
| ------------------------------ | ---------------------- | ------- | ------------- | --------------------------------------------- |
| `EXTENSION_BUCKET`             | `bucket`               | string  | —             | watched Storage bucket                        |
| `OUTPUT_STORAGE_PATH`          | `outputStoragePath`    | string  | —             | where transcripts are written (if to Storage) |
| `COLLECTION_PATH`              | `collectionPath`       | string  | —             | Firestore collection for transcript docs      |
| `LANGUAGE_CODE`                | `languageCode`         | string  | —             | Speech language                               |
| `MODEL`                        | `model`                | string  | —             | Speech model                                  |
| `ENABLE_AUTOMATIC_PUNCTUATION` | `automaticPunctuation` | boolean | —             | Speech option                                 |
| `LOCATION`                     | `location`             | string  | `us-central1` | function region                               |

## Entry Point

`index.ts` is the only module that defines Firebase triggers. It registers
required IAM roles/APIs and wires `transcribeAudio` with deploy-time params.

## Target layout (`packages/speech-to-text/src`)

- `export-config.ts` — `SpeechToTextConfig` + `resolveConfig`.
- `transcribe.ts` — Speech client call (sync + `longRunningRecognize` polling),
  framework-agnostic.
- `firestore.ts` — transcript/state writes.
- `handlers.ts` — `handleObjectFinalized(event, ctx)`: filter audio objects,
  transcribe, persist, emit events. Pure (inject Speech + Firestore clients).
- `events.ts` / `lib.ts` / `index.ts` / `config.ts` — standard pattern.

## Steps

1. Scaffold from reference; keep `events.ts`.
2. Port `transcribe-audio.ts` → `src/transcribe.ts`. Keep the long-running
   recognize path (polls an operation **in-function** — no task queue needed).
3. Wire `onObjectFinalized` with the bucket from config; set **timeout/memory**
   to match the legacy function (long audio).
4. Port the Firestore write + audio-object filtering (content-type / path).
5. Map params in `config.ts`.
6. Register required resources in the entrypoint:
   `roles/storage.objectAdmin`, `roles/datastore.user`, and
   `speech.googleapis.com`.
7. Tests: handler with Speech mocked (success + fail → events); skip the 7MB wav
   fixtures (stripped) — use a small stub or mock the client.

## Provisioning

None.

## Acceptance criteria

- [ ] `pnpm build` + `pnpm lint` clean; `private:false`.
- [ ] Uploading an audio file produces a transcript doc + `.complete` event;
      a failure produces a `.fail` event.
- [ ] Long-audio path completes without hitting the function timeout.
- [ ] `./lib` import side-effect-free.

## Risks / decisions

- Long-running transcription vs function timeout — confirm v2 `timeoutSeconds`
  matches the legacy setting; very long audio may need a documented ceiling.
- Output target: Firestore doc and/or Storage path — preserve legacy behaviour.
