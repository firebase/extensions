# @firebase-function-kits/firestore-genai-chatbot

Conversational GenAI chatbot backed by Firestore. This is the Chatbot with
Generative AI Firebase Extension as an npm package you add to your own Firebase
Functions codebase and deploy.

It listens for prompt documents written to a discussion collection, calls Google
AI or Vertex AI, and writes the model response back to Firestore. The function
runs in your own Firebase project; there is no hosted version, so you deploy it
yourself.

## Install

```sh
npm install @firebase-function-kits/firestore-genai-chatbot
```

## Required IAM

Deploy needs these Google Cloud roles and APIs for the function's service
account. Firebase CLI 15.23.0 or later creates that account, grants the roles
below, enables the listed APIs, and attaches the account to every function in
this kit. Do not set a custom runtime service account for this codebase — it
conflicts with that automatic setup.

| Role / API | Why |
|---|---|
| `roles/datastore.user` | read prompts and write model responses |
| `roles/aiplatform.user` | call Vertex AI when that provider is selected |
| `roles/monitoring.metricWriter` | Genkit monitoring metrics |
| `roles/cloudtrace.agent` | Genkit tracing |
| `roles/logging.logWriter` | Genkit structured logs |
| `roles/eventarc.eventReceiver` | receive Gen2 Firestore trigger events |
| `roles/run.invoker` | allow Eventarc to invoke the Gen2 Cloud Run service |
| `aiplatform.googleapis.com` | Vertex AI Gemini access when selected |

## Usage

Export the function from your functions codebase entry:

```ts
// functions/src/index.ts
export { generateMessage } from "@firebase-function-kits/firestore-genai-chatbot";
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
      "kit": "firestore-genai-chatbot",
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
deploys as `kit-default-generateMessage`.

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
| `provider` | `GENERATIVE_AI_PROVIDER` | no | `google-ai` | `google-ai` or `vertex-ai` |
| `apiKey` | `API_KEY` | secret | — | Google AI API key |
| `model` | `MODEL` | no | `gemini-2.5-flash` | Model id |
| `vertexModelLocation` | `VERTEX_AI_MODEL_LOCATION` | no | `null` | Vertex model region |
| `collectionName` | `COLLECTION_NAME` | no | `generate` | Discussion collection |
| `promptField` | `PROMPT_FIELD` | no | `prompt` | Prompt field name |
| `responseField` | `RESPONSE_FIELD` | no | `response` | Response field name |
| `orderField` | `ORDER_FIELD` | no | `createTime` | Ordering field |
| `candidatesField` | `CANDIDATES_FIELD` | no | `candidates` | Candidates field name |
| `context` | `CONTEXT` | no | (empty) | System context |
| `temperature` | `TEMPERATURE` | no | (empty) | Sampling temperature |
| `topP` | `TOP_P` | no | (empty) | Top-p |
| `topK` | `TOP_K` | no | (empty) | Top-k |
| `candidateCount` | `CANDIDATE_COUNT` | no | `1` | Candidate count |
| `maxOutputTokens` | `MAX_OUTPUT_TOKENS` | no | (empty) | Max output tokens |
| `enableOverrides` | `ENABLE_DISCUSSION_OPTION_OVERRIDES` | no | `false` | Per-discussion option overrides |
| `enableGenkitMonitoring` | `ENABLE_GENKIT_MONITORING` | no | `false` | Enable Genkit monitoring |
| `harmHateSpeech` | `HARM_CATEGORY_HATE_SPEECH` | no | `HARM_BLOCK_THRESHOLD_UNSPECIFIED` | Harm threshold |
| `harmDangerous` | `HARM_CATEGORY_DANGEROUS_CONTENT` | no | `HARM_BLOCK_THRESHOLD_UNSPECIFIED` | Harm threshold |
| `harmHarassment` | `HARM_CATEGORY_HARASSMENT` | no | `HARM_BLOCK_THRESHOLD_UNSPECIFIED` | Harm threshold |
| `harmSexual` | `HARM_CATEGORY_SEXUALLY_EXPLICIT` | no | `HARM_BLOCK_THRESHOLD_UNSPECIFIED` | Harm threshold |

## Multiple instances

To run several chatbot instances, add one entry per instance to the `instances`
map, each pointing at its own config directory with its own `.env`:

```json
{
  "functions": [
    {
      "source": ".",
      "kit": "firestore-genai-chatbot",
      "instances": {
        "support": "instances/support",
        "sales": "instances/sales"
      }
    }
  ]
}
```

Instance ids must be unique across all kit stanzas in the project, and every
instance's function names are namespaced by its `kit-<instance id>-` prefix, so
the instances cannot collide.

## Differences from the Build Chatbot with the Gemini API extension

This kit is version 0.0.19 of the extension repackaged as an npm package you add
to your own functions codebase. The generation logic, the Firestore trigger, the
`status` state machine, the per-discussion overrides and the safety settings are
all ported verbatim. Config keeps the same environment variable names, so a
`.env` copied from your installed instance is close to a lift-and-shift, with
four exceptions below: the boolean toggles, the two region settings, and the API
key secret.

### Change `yes` and `no` to `true` and `false`

`ENABLE_DISCUSSION_OPTION_OVERRIDES` and `ENABLE_GENKIT_MONITORING` were
`yes`/`no` dropdowns. They are now booleans that count as enabled only for the
exact value `true`. A copied `.env` carrying `yes` deploys without complaint and
silently leaves the feature off, so per-discussion overrides stop being read and
Genkit monitoring stops reporting.

### Pick your Cloud Functions region, or you get us-central1

The extension's `LOCATION` setting is gone. There is no replacement value, and
`LOCATION` left in a `.env` file is ignored. The function deploys to the Cloud
Functions default region, `us-central1`, wherever your extension instance used
to run. If you need another region, register the trigger yourself from the
package's `./lib` entry point and set `region` on it.

### Set `VERTEX_AI_MODEL_LOCATION` explicitly if you use Vertex AI

The default value `null` used to mean "call Vertex AI in the same region as the
function". It now means "let the SDK choose": `us-central1` for a normal
single-candidate request, and `global` when `CANDIDATE_COUNT` is above 1. If you
relied on the default to keep model calls in your function's region, set the
region by name instead of leaving it at `null`.

### An API_KEY secret is required even on Vertex AI

`API_KEY` was optional, so a Vertex AI instance could be installed without one.
It is now always bound to the function. If no `API_KEY` secret exists in Secret
Manager, `firebase deploy` prompts you for a value, and fails outright when
running non-interactively (CI). Create the secret with any placeholder value if
your provider is `vertex-ai`.

### Long generations now time out after 60 seconds

The extension ran with a 540 second timeout. The kit does not set one, so the
platform default of 60 seconds applies. Prompts with a long history or a high
`MAX_OUTPUT_TOKENS` that used to finish will now fail and write `status.state:
ERROR`. There is no config value for this; raise it on your own trigger from
`./lib` if you need the old headroom.

### CANDIDATE_COUNT above 1 now really requests that many candidates

With `CANDIDATE_COUNT` above 1, the extension never forwarded the count (nor
`TEMPERATURE`, `TOP_P` or `TOP_K`) to the model, so it wrote a `candidates` array
holding the single response it got back. The kit forwards all four, so you get
the number of candidates you asked for, your sampling settings take effect, and
the request costs more. Two smaller consequences: with per-discussion overrides
enabled, a `candidateCount` set on a discussion document now decides whether the
`candidates` field is written for that message (the extension decided once, from
the deploy-time value), and a discussion that overrides `candidateCount` above 1
gets a `candidates` field containing one entry.

### Bad numbers are no longer rejected up front

`TEMPERATURE`, `TOP_P`, `TOP_K`, `CANDIDATE_COUNT`, `MAX_OUTPUT_TOKENS` and
`COLLECTION_NAME` were validated when you installed the extension. Nothing
validates them now: a non-numeric value is parsed to `NaN` and passed to the
model call rather than being caught at deploy time.

### Unchanged

- The watched path is still `COLLECTION_NAME/{messageId}` on the default
  database, and `COLLECTION_NAME` still defaults to `generate`.
- `PROMPT_FIELD`, `RESPONSE_FIELD`, `ORDER_FIELD` and `CANDIDATES_FIELD` behave
  identically, as does history assembly from sibling documents.
- The `status` state machine is unchanged, including that a document
  already in `COMPLETED` or `ERROR` is never reprocessed when you edit its
  prompt.
- Per-discussion overrides, `examples` and `continue` history are parsed and
  validated exactly as before.
- The four `HARM_CATEGORY_*` thresholds, `CONTEXT` handling (still sent as a
  leading system turn) and the user-facing error messages are unchanged.
- `MODEL` still defaults to `gemini-2.5-flash`, and the same list of supported
  Gemini models is accepted.

## API surface

- **Main entry** (`@firebase-function-kits/firestore-genai-chatbot`): exports
  `generateMessage`. The main entry reads environment variables when the module
  loads, so use it from Firebase deploy/emulator/runtime. For your own triggers,
  import from `./lib` instead.
- **Library entry** (`./lib`): `handleDocumentWrite` / `createProcessor`,
  generative client helpers, and config types (`GenaiChatbotConfig`,
  `resolveConfig`) for owning trigger registration yourself.

## License

Apache-2.0
