# @firebase/firestore-vector-search

Vector similarity search over a Firestore collection. This is the Vector Search
with Firestore Firebase Extension as an npm package you add to your own Firebase
Functions codebase and deploy.

## Install

```sh
npm install @firebase/firestore-vector-search
```

## Required IAM

The package declares these roles and APIs during deploy discovery. Firebase CLI
15.23.0 or later creates a managed runtime service account for the codebase,
grants it these roles, and attaches it to every function in the codebase.

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

## Configuration

Configuration is via v2 function params: env vars named as in the table below.
`GEMINI_API_KEY` and `OPENAI_API_KEY` are secrets.

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
| `region` | `LOCATION` | yes | — | Function region |
| `updateTriggerQueueName` | `UPDATE_TRIGGER_QUEUE_NAME` | no | `updateTrigger` | Update trigger queue |
| `updateTaskQueueName` | `UPDATE_TASK_QUEUE_NAME` | no | `updateTask` | Update task queue |
| `backfillTriggerQueueName` | `BACKFILL_TRIGGER_QUEUE_NAME` | no | `backfillTrigger` | Backfill trigger queue |
| `backfillTaskQueueName` | `BACKFILL_TASK_QUEUE_NAME` | no | `backfillTask` | Backfill task queue |
| `geminiApiKey` | `GEMINI_API_KEY` | secret | — | Gemini API key |
| `openAiApiKey` | `OPENAI_API_KEY` | secret | — | OpenAI API key |

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
