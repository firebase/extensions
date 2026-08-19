# @firebase/firestore-genai-chatbot

Conversational GenAI chatbot backed by Firestore. This is the Chatbot with
Generative AI Firebase Extension as an npm package you add to your own Firebase
Functions codebase and deploy.

It listens for prompt documents written to a discussion collection, calls Google
AI or Vertex AI, and writes the model response back to Firestore. The function
runs in your own Firebase project; there is no hosted version, so you deploy it
yourself.

## Install

```sh
npm install @firebase/firestore-genai-chatbot
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
export { generateMessage } from "@firebase/firestore-genai-chatbot";
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
| `model` | `MODEL` | no | `gemini-3.6-flash` | Model id |
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

## API surface

- **Main entry** (`@firebase/firestore-genai-chatbot`): exports
  `generateMessage`. The main entry reads environment variables when the module
  loads, so use it from Firebase deploy/emulator/runtime. For your own triggers,
  import from `./lib` instead.
- **Library entry** (`./lib`): `handleDocumentWrite` / `createProcessor`,
  generative client helpers, and config types (`GenaiChatbotConfig`,
  `resolveConfig`) for owning trigger registration yourself.

## License

Apache-2.0
