# @firebase/firestore-vector-search

Vector similarity search over a Firestore collection. This is the Vector Search
with Firestore Firebase Extension as an npm package you add to your own Firebase
Functions codebase and deploy.

It embeds documents on write (Gemini, OpenAI, Vertex, or a custom endpoint),
maintains a vector index, and serves similarity queries via callable/write
triggers plus backfill/update task helpers. The functions run in your own
Firebase project; there is no hosted version, so you deploy them yourself.

## Install

```sh
npm install @firebase/firestore-vector-search
```

## Required IAM

Deploy needs these Google Cloud roles and APIs for the function's service
account. Firebase CLI 15.23.0 or later creates that account, grants the roles
below, enables the listed APIs, and attaches the account to every function in
this kit. Do not set a custom runtime service account for this codebase — it
conflicts with that automatic setup.

| Role / API | Why |
|---|---|
| `roles/datastore.user` | read/write documents and embeddings |
| `roles/aiplatform.user` | Vertex AI embeddings when configured |
| `roles/storage.objectAdmin` | read image inputs from Cloud Storage |
| `roles/datastore.indexAdmin` | manage vector indexes |
| `roles/eventarc.eventReceiver` | receive Gen2 Firestore trigger events |
| `roles/run.invoker` | allow Eventarc/Tasks to invoke the Gen2 Cloud Run service |
| `aiplatform.googleapis.com` | Vertex AI embedding/search |
| `storage-component.googleapis.com` | read image data from Cloud Storage |

## Usage

Export the functions from your functions codebase entry:

```ts
// functions/src/index.ts
export {
  updateTrigger,
  updateTask,
  backfillTrigger,
  backfillTask,
  embedOnWrite,
  queryOnWrite,
  queryCallable,
  initVectorSearch,
} from "@firebase/firestore-vector-search";
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
      "kit": "firestore-vector-search",
      "instances": {
        "default": "."
      }
    }
  ]
}
```

`instances` maps each instance id to the directory (relative to
`firebase.json`) holding that instance's `.env`. The CLI prefixes every
function and task queue name with `kit-<instance id>-`, so the functions above
deploy as `kit-default-embedOnWrite`, `kit-default-queryCallable`,
`kit-default-initVectorSearch`, and the related task/trigger helpers.

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
| `instanceId` | `KIT_INSTANCE_ID` | no | `firestore-vector-search` | Logical instance id |
| `embeddingProvider` | `EMBEDDING_PROVIDER` | no | `gemini` | Embedding provider |
| `customEmbeddingsEndpoint` | `CUSTOM_EMBEDDINGS_ENDPOINT` | no | (empty) | Custom embeddings endpoint |
| `customEmbeddingsBatchSize` | `CUSTOM_EMBEDDINGS_BATCH_SIZE` | no | (empty) | Custom batch size |
| `customEmbeddingsDimension` | `CUSTOM_EMBEDDINGS_DIMENSION` | no | (empty) | Custom embedding dimension |
| `collectionPath` | `COLLECTION_NAME` | no | `products` | Indexed collection |
| `defaultQueryLimit` | `DEFAULT_QUERY_LIMIT` | no | `3` | Default query limit |
| `distanceMeasure` | `DISTANCE_MEASURE` | no | `COSINE` | Distance measure |
| `inputFieldName` | `INPUT_FIELD_NAME` | no | `input` | Input field |
| `outputFieldName` | `OUTPUT_FIELD_NAME` | no | `embedding` | Embedding field |
| `statusFieldName` | `STATUS_FIELD_NAME` | no | `status` | Status field |
| `doBackfill` | `DO_BACKFILL` | yes | — | Run backfill on setup |
| `updateOnConfigure` | `UPDATE_ON_CONFIGURE` | yes | — | Update index on configure |
| `updateTriggerQueueName` | `UPDATE_TRIGGER_QUEUE_NAME` | no | `updateTrigger` | Update trigger queue |
| `updateTaskQueueName` | `UPDATE_TASK_QUEUE_NAME` | no | `updateTask` | Update task queue |
| `backfillTriggerQueueName` | `BACKFILL_TRIGGER_QUEUE_NAME` | no | `backfillTrigger` | Backfill trigger queue |
| `backfillTaskQueueName` | `BACKFILL_TASK_QUEUE_NAME` | no | `backfillTask` | Backfill task queue |
| `geminiApiKey` | `GEMINI_API_KEY` | secret | — | Gemini API key |
| `openAiApiKey` | `OPENAI_API_KEY` | secret | — | OpenAI API key |

## Multiple instances

To run several vector-search indexes, add one entry per instance to the
`instances` map, each pointing at its own config directory with its own `.env`:

```json
{
  "functions": [
    {
      "source": ".",
      "kit": "firestore-vector-search",
      "instances": {
        "products": "instances/products",
        "docs": "instances/docs"
      }
    }
  ]
}
```

Instance ids must be unique across all kit stanzas in the project, and every
instance's function names are namespaced by its `kit-<instance id>-` prefix, so
the instances cannot collide.

## Events

When `EVENTARC_CHANNEL` is configured, the functions publish lifecycle events
such as `onStart`, `onError`, `onSuccess`, and `onCompletion` under
`firebase.extensions.firestore-vector-search.v1.*`.

## API surface

- **Main entry** (`@firebase/firestore-vector-search`): exports
  `updateTrigger`, `updateTask`, `backfillTrigger`, `backfillTask`,
  `embedOnWrite`, `queryOnWrite`, `queryCallable`, and `initVectorSearch`. The
  main entry reads environment variables when the module loads, so use it from
  Firebase deploy/emulator/runtime. For your own triggers, import from `./lib`
  instead.
- **Library entry** (`./lib`): handlers, embedding client helpers, vector-store
  utilities, and config types (`VectorSearchConfig`, `resolveVectorSearchConfig`)
  for owning trigger registration yourself.

## License

Apache-2.0
