# @firebase-function-kits/firestore-translate-text

Translate text written to a Firestore collection. This is the Translate Text in
Firestorestore Firebase Extension as an npm package you add to your own Firebase
Functions codebase and deploy.

It listens for documents written to a collection, translates a configured input
field into one or more target languages (Google Translate or Gemini), and writes
the results to an output map field. The function runs in your own Firebase
project; there is no hosted version, so you deploy it yourself.

## Install

```sh
npm install @firebase-function-kits/firestore-translate-text
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
export { fstranslate } from "@firebase-function-kits/firestore-translate-text";
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
| `geminiModel` | `GEMINI_MODEL` | no | `gemini-2.5-flash` | Gemini model when used |
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

## Differences from the Translate Text in Firestore extension

This kit is version 0.1.30 of the extension repackaged as an npm package. The
translation behaviour is ported closely: the same write trigger, the same
handling of string and map inputs, the same per-document `languages` override,
the same "delete the translations when the input goes away" rule, and the same
output shape written back to the document. Every setting keeps its extension
environment variable name and default, so a `.env` copied from your installed
instance needs no value changes. What changes is where the Gemini API key comes
from, which region Vertex AI is called in, and what is no longer checked for you.

### Create a `GOOGLE_AI_API_KEY` secret even if you do not use Google AI

The extension stored this as `ext-<instance id>-GOOGLE_AI_API_KEY` in Secret
Manager and it was optional. The kit asks for a secret named exactly
`GOOGLE_AI_API_KEY`, so your existing extension secret is not picked up, and the
secret is attached to the function whatever `TRANSLATION_PROVIDER` is set to. If
it does not exist, `firebase deploy` prompts you for a value and fails outright
when running non-interactively (CI). On the Cloud Translation or Vertex AI
providers, create it with a placeholder value.

The key is only read when `TRANSLATION_PROVIDER` is `gemini-googleai`, and that
provider still fails fast with `Google AI API key is required for Genkit Google
AI translations` when the value is empty.

### Vertex AI is called in the function's region

With `TRANSLATION_PROVIDER: gemini-vertexai`, the Vertex AI call now uses the
region the function is deployed to. The extension used the location you picked at
install time. Gemini is not served in every region, so if you deploy somewhere it
is unavailable, translation fails and the error is written to your function logs.
Deploy to a region with Vertex AI support, or use `gemini-googleai` or
`translate` instead. This was not exercised against a live deploy.

The function itself has no location setting any more. It deploys to your
codebase's default region (`us-central1` unless you have changed it).

### Nothing checks your settings at deploy time

The extension rejected a `LANGUAGES` value that was not a comma-separated list of
language codes, and a `COLLECTION_PATH` that was not a valid collection path,
before it would install. Neither is checked now, and `INPUT_FIELD_NAME`,
`OUTPUT_FIELD_NAME` and `LANGUAGES` all have defaults rather than being required,
so an incomplete or malformed config deploys and then fails per document at
translation time. `TRANSLATION_PROVIDER` falls back to `translate` when it is
empty.

The two checks that ran per document still run: the function refuses to translate
when the input and output field names are the same, or when the input field name
is itself a path inside the output field.

### Create the Eventarc channel yourself for events

Choosing events at install used to create the channel and set both event
variables for you. The kit only reads them: set `EVENTARC_CHANNEL` in your `.env`
to a channel you have created, and the same four
`firebase.extensions.firestore-translate-text.v1.*` events are published.
Per-event selection is gone in practice, because the CLI rejects any `.env` key
beginning with `EXT_`, so `EXT_SELECTED_EVENTS` cannot be set and every event
type is published. With `EVENTARC_CHANNEL` unset, nothing is published and the
function is otherwise unaffected.

### Event payloads have a different shape

The event types are unchanged, but what `onStart` and `onCompletion` carry is
not. `onStart` used to carry `{change, context}` and now carries `{data, params}`:
the write is under `data` instead of `change`, and the 1st gen `context` is gone.
`onCompletion` used to carry `{context}` and now carries `{params}` only. Anything
reading `context.eventId`, `context.timestamp`, `context.eventType` or
`context.resource` needs updating; the `messageId` trigger wildcard survives as
`params`. `onSuccess` and `onError` payloads are unchanged.

### No backfill

There is no function to translate documents that already exist in the
collection. The extension carried the same limitation (its backfill task queue
was disabled and never deployed), so this is not a regression, but the code is
gone rather than dormant: only documents written after you deploy are translated.

### The trigger is 2nd gen

`fstranslate` is a 2nd gen Firestore function where the extension was 1st gen.
Its service account needs `roles/eventarc.eventReceiver` and `roles/run.invoker`
on top of `roles/datastore.user`; the Firebase CLI grants these for you. The
Cloud Translation API is still required whichever provider you choose.

### Unchanged

- The watched path is still `COLLECTION_PATH/{messageId}` on your default
  database, and `COLLECTION_PATH` still defaults to `translations`.
- Every environment variable keeps its name, type and default, including the
  three `TRANSLATION_PROVIDER` values and the three `GEMINI_MODEL` values.
- Duplicate entries in `LANGUAGES` are still collapsed.
- A string input is translated into every language; a map input has each of its
  string values translated, with non-string values written as `null`.
- The per-document `LANGUAGES_FIELD_NAME` override, and the rule that a document
  is re-translated only when its input or its languages actually change, both
  behave as before.
- Translations are still written in a transaction, and each `onSuccess` event
  still carries the output field name and the translations.

## API surface

- **Main entry** (`@firebase-function-kits/firestore-translate-text`): exports `fstranslate`.
  The main entry reads environment variables when the module loads, so use it
  from Firebase deploy/emulator/runtime. For your own triggers, import from
  `./lib` instead.
- **Library entry** (`./lib`): `handleDocumentWrite`, translation services
  (`GoogleTranslator`, `GenkitTranslator`), and config helpers
  (`TranslateConfig`, `resolveTranslateConfig`) for owning trigger registration
  yourself.

## License

Apache-2.0
