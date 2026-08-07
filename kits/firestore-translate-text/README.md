# @firebase/firestore-translate-text

Translate text written to a Firestore collection. This is the Translate Text in
Firestorestore Firebase Extension as an npm package you add to your own Firebase
Functions codebase and deploy.

## Install

```sh
npm install @firebase/firestore-translate-text
```

## Required IAM

The package declares these roles and APIs during deploy discovery. Firebase CLI
15.23.0 or later creates a managed runtime service account for the codebase,
grants it these roles, and attaches it to every function in the codebase.

| Role / API | Why |
|---|---|
| `roles/datastore.user` | read input docs and write translations |
| `roles/eventarc.eventReceiver` | receive Gen2 Firestore trigger events |
| `roles/run.invoker` | allow Eventarc to invoke the Gen2 Cloud Run service |
| `translate.googleapis.com` | Google Translate provider |

## Configuration

Configuration is via v2 function params: env vars named as in the table below.
`GOOGLE_AI_API_KEY` is a secret used when the Gemini provider is selected.

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
| `region` | `LOCATION` | no | `us-central1` | Function region |

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
