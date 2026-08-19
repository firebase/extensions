# @firebase/firestore-translate-text

Translate text written to a Firestore collection. This is the Translate Text in
Firestorestore Firebase Extension as an npm package you add to your own Firebase
Functions codebase and deploy.

It listens for documents written to a collection, translates a configured input
field into one or more target languages (Google Translate or Gemini), and writes
the results to an output map field. The function runs in your own Firebase
project; there is no hosted version, so you deploy it yourself.

## Install

```sh
npm install @firebase/firestore-translate-text
```

## Required IAM

Deploy needs these Google Cloud roles and APIs for the function's service
account. Firebase CLI 15.23.0 or later creates that account, grants the roles
below, enables the listed APIs, and attaches the account to every function in
this kit. Do not set a custom runtime service account for this codebase — it
conflicts with that automatic setup.

| Role / API | Why |
|---|---|
| `roles/datastore.user` | read input docs and write translations |
| `roles/eventarc.eventReceiver` | receive Gen2 Firestore trigger events |
| `roles/run.invoker` | allow Eventarc to invoke the Gen2 Cloud Run service |
| `translate.googleapis.com` | Google Translate provider |

## Usage

Export the function from your functions codebase entry:

```ts
// functions/src/index.ts
export { fstranslate } from "@firebase/firestore-translate-text";
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
      "kit": "firestore-translate-text",
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
deploys as `kit-default-fstranslate`.

```sh
firebase experiments:enable kits
firebase deploy --only functions
```

Deploy a single instance with `firebase deploy --only functions:<instance id>`.

## Configuration

Set these values in a `.env` (or `.env.<projectId>`) file. The Firebase CLI
loads them at deploy time and prompts for any required values that are missing.
Rows marked `secret` live in Secret Manager. You can reuse existing secrets;
the CLI connects them to the function at deploy time.

| Field | Env var | Required | Default | Description |
|---|---|---|---|---|
| `collectionPath` | `COLLECTION_PATH` | no | `translations` | Watched collection |
| `inputFieldName` | `INPUT_FIELD_NAME` | no | `input` | Source text field |
| `outputFieldName` | `OUTPUT_FIELD_NAME` | no | `translated` | Output map field |
| `languages` | `LANGUAGES` | no | `en,es,de,fr` | Target language codes |
| `languagesFieldName` | `LANGUAGES_FIELD_NAME` | no | `languages` | Per-doc languages field |
| `provider` | `TRANSLATION_PROVIDER` | yes | — | Translation provider |
| `geminiModel` | `GEMINI_MODEL` | no | `gemini-3.6-flash` | Gemini model when used |
| `googleAiApiKey` | `GOOGLE_AI_API_KEY` | secret | — | Google AI API key (Gemini) |

## Multiple instances

To translate several collections, add one entry per instance to the `instances`
map, each pointing at its own config directory with its own `.env`:

```json
{
  "functions": [
    {
      "source": ".",
      "kit": "firestore-translate-text",
      "instances": {
        "posts": "instances/posts",
        "comments": "instances/comments"
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
such as `onStart`, `onError`, `onSuccess`, and `onCompletion` under
`firebase.extensions.firestore-translate-text.v1.*`.

## API surface

- **Main entry** (`@firebase/firestore-translate-text`): exports `fstranslate`.
  The main entry reads environment variables when the module loads, so use it
  from Firebase deploy/emulator/runtime. For your own triggers, import from
  `./lib` instead.
- **Library entry** (`./lib`): `handleDocumentWrite`, translation services
  (`GoogleTranslator`, `GenkitTranslator`), and config helpers
  (`TranslateConfig`, `resolveTranslateConfig`) for owning trigger registration
  yourself.

## License

Apache-2.0
