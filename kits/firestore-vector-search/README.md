# @firebase-function-kits/firestore-vector-search

Vector similarity search over a Firestore collection. This is the Vector Search
with Firestore Firebase Extension as an npm package you add to your own Firebase
Functions codebase and deploy.

It embeds documents on write (Gemini, OpenAI, Vertex, or a custom endpoint),
maintains a vector index, and serves similarity queries via callable/write
triggers plus backfill/update task helpers. The functions run in your own
Firebase project; there is no hosted version, so you deploy them yourself.

## Install

```sh
npm install @firebase-function-kits/firestore-vector-search
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
} from "@firebase-function-kits/firestore-vector-search";
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
| `instanceId` | `INSTANCE_ID` | yes | — | Must match this instance's key in the `instances` map |
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
| `updateTriggerQueueName` | `UPDATE_TRIGGER_QUEUE_NAME` | no | `kit-<INSTANCE_ID>-updateTrigger` | Update trigger queue |
| `updateTaskQueueName` | `UPDATE_TASK_QUEUE_NAME` | no | `kit-<INSTANCE_ID>-updateTask` | Update task queue |
| `backfillTriggerQueueName` | `BACKFILL_TRIGGER_QUEUE_NAME` | no | `kit-<INSTANCE_ID>-backfillTrigger` | Backfill trigger queue |
| `backfillTaskQueueName` | `BACKFILL_TASK_QUEUE_NAME` | no | `kit-<INSTANCE_ID>-backfillTask` | Backfill task queue |
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
the instances cannot collide. Set `INSTANCE_ID` in each config directory to the
same value as that directory's key in the `instances` map; it also namespaces
the internal Firestore metadata/query paths and task queue references.

## Events

When `EVENTARC_CHANNEL` is configured, the functions publish lifecycle events
such as `onStart`, `onError`, `onSuccess`, and `onCompletion` under
`firebase.extensions.firestore-vector-search.v1.*`.

## Differences from the Vector Search with Firestore extension

This kit is version 0.1.3 of the extension repackaged as an npm package, and it is
the least literal of the ports. The seven functions, the Firestore vector index,
the query document collection and the callable all survive with their names and
settings intact, so a `.env` copied from your installed instance needs no value
changes. The embedding providers, the backfill, and the shape of the status field
written onto your documents all changed, so read this before you point the kit at
a collection an installed instance has already embedded.

### `EMBEDDING_PROVIDER: multimodal` is not implemented

Selecting `multimodal` deploys, and then every embedding attempt throws
`Multimodal embeddings are not implemented in this package`. The extension's
multimodal image embedding, including reading images out of Cloud Storage, has no
equivalent here. If you use it, stay on the extension.

### OpenAI embeddings are a different model and a different size

`EMBEDDING_PROVIDER: openai` used `text-embedding-ada-002` and stored the full
1536-dimension vector, while the Firestore index it created was declared with 512
dimensions. The kit uses `text-embedding-3-small` at 512 dimensions, which matches
the index.

Vectors from the two models are not comparable, and the existing index is reused
as-is because the "does this index already exist" check only looks at the field
path, not the dimension. Re-embed the whole collection after you switch, and
delete the old vector index first if it was created with a different dimension.

### You set `INSTANCE_ID` yourself, and it names the query collection

The extension derived its instance id at install and used it for the query
collection (`_<instance id>/index/queries`), the index metadata document
(`_<instance id>/index`) and its task queues. Here `INSTANCE_ID` is a setting you
provide, and it must match this instance's key in the `instances` map in
`firebase.json`. To keep serving the query documents your clients already write
to, set it to your installed instance's id. The four task queue names can also be
overridden individually with `UPDATE_TRIGGER_QUEUE_NAME`, `UPDATE_TASK_QUEUE_NAME`,
`BACKFILL_TRIGGER_QUEUE_NAME` and `BACKFILL_TASK_QUEUE_NAME`, which the extension
did not allow.

### Create the `GEMINI_API_KEY` and `OPENAI_API_KEY` secrets, both of them

The extension stored these as `ext-<instance id>-GEMINI_API_KEY` and
`ext-<instance id>-OPENAI_API_KEY`, and both were optional. The kit asks for
secrets named exactly `GEMINI_API_KEY` and `OPENAI_API_KEY`, so your existing
extension secrets are not picked up, and both are attached to every function
whatever `EMBEDDING_PROVIDER` is set to. If either does not exist, `firebase
deploy` prompts you for a value and fails outright when running
non-interactively (CI). Create the one you do not need with a placeholder value.

### `UPDATE_ON_CONFIGURE` now re-embeds on every deploy

This setting was declared by the extension but never read. Reconfiguring an
installed instance re-embedded documents only when the provider, the vector
dimension or the input/output field names had actually changed, which the
extension tracked in its index metadata document.

The kit keeps no such metadata and does no comparison. `UPDATE_ON_CONFIGURE: true`
enqueues a full re-embed of every document that already has an embedding after
*every* `firebase deploy`, whether anything relevant changed or not, and
`DO_BACKFILL: true` embeds the whole collection after the first deploy. On a large
collection that is a large Vertex AI or OpenAI bill per deploy. Set
`UPDATE_ON_CONFIGURE: false` and re-embed deliberately when you change providers.

### Backfill is one task per document, and reads the collection in one go

The extension chunked the collection into batches sized to the provider (16
documents per OpenAI call), embedded each batch in a single API call, and tracked
progress in its metadata document. The kit reads the entire collection with one
`get()` and enqueues one Cloud Task per document, each of which embeds one
document with one API call.

Two consequences. A collection large enough that a single `get()` does not fit in
the trigger's 512 MiB will fail the backfill outright, and there is no
resume-from-progress. Backfilling *n* documents now costs *n* task invocations and
*n* embedding calls rather than *n*/batch size.

There is also no install-time progress reporting, since there is no extension
install UI to report into. Watch the function logs instead.

### The `status` field on your documents is a different shape

The extension wrote status nested under the process id, with timestamps:

```
status: { <instance id>: { state: "COMPLETED", startTime, updateTime, completeTime, createTime } }
```

The kit writes it flat, with no timestamps:

```
status: { state: "COMPLETED" }
status: { state: "ERROR", message: "<error message>" }
```

The states themselves are narrower too: `PROCESSING` and `BACKFILLED` are no
longer written, only `COMPLETED` and `ERROR`. Anything reading
`status.<instance id>.state`, or a security rule or index keyed to it, needs
updating. The field name is still `STATUS_FIELD_NAME`, defaulting to `status`.

This applies to the documents in your indexed collection only. Query documents
keep the extension's nested shape, `status.textQuery`, with the same states and
timestamps, so anything waiting on that path still works.

### Editing a document's input re-embeds it

The extension embedded each document once. Its skip rule was "this document's
status is already in a final state", so once a document reached `COMPLETED` (or
`ERROR`), changing its input field never produced a new embedding and a failure
was never retried.

The kit compares the input instead: it re-embeds when the input field changes, and
skips only when the input is unchanged and an embedding is already present. This
is usually what you wanted, but it means editing inputs in bulk now costs
embedding calls, and a document that previously sat stale will be brought up to
date on its next write.

### The lifecycle hooks and the function region

Install and reconfigure hooks are replaced by an `initVectorSearch` task that the
CLI runs after your first deploy and after every redeploy. It creates the
Firestore vector index (skipping creation when a matching index exists, as
before) and then enqueues the backfill or update triggers according to the two
settings above.

`LOCATION` is gone. The functions deploy to your codebase's default region
(`us-central1` unless you have changed it), and with
`EMBEDDING_PROVIDER: vertex` the Vertex AI embedding call uses that same region
rather than the install-time location. Gemini embedding is not served in every
region; if you deploy somewhere it is unavailable, embedding fails and the error
is written to the document's status field.

### Events are actually published now

The extension declared four event types but never published any. The kit
publishes `onStart`, `onSuccess`, `onError` and `onCompletion` under
`firebase.extensions.firestore-vector-search.v1.*` from `embedOnWrite`, once you
set `EVENTARC_CHANNEL` in your `.env` to a channel you have created. Per-event
selection is not available, because the CLI rejects any `.env` key beginning with
`EXT_`, so `EXT_SELECTED_EVENTS` cannot be set and every event type is published.
With `EVENTARC_CHANNEL` unset, nothing is published.

### The triggers are 2nd gen

All seven functions are 2nd gen. Their service accounts need
`roles/eventarc.eventReceiver`, `roles/run.invoker`, `roles/cloudtasks.enqueuer`
and `roles/iam.serviceAccountUser` on top of the four roles the extension asked
for; the Firebase CLI grants these for you.

### Unchanged

- The indexed collection is still `COLLECTION_NAME` (default `products`), the
  input, output and status fields still default to `input`, `embedding` and
  `status`, and embeddings are still written as native Firestore vectors.
- Querying by writing a document to `_<instance id>/index/queries` still works
  the same way, with `query`, an optional `limit` and optional `prefilters`, and
  the matching document ids written back to the document under `result`. A query
  document is still run once: writes that leave `query` and `limit` untouched are
  ignored, as is any write to a document whose `status.textQuery.state` is
  already set, so editing a completed query document does not re-run it and a
  failed one is not retried. Write a new document for a new query.
- `queryCallable` still requires an authenticated caller, still validates its
  argument with the same schema, still rejects a `limit` that is not an integer
  above zero, and still returns `{ ids: [...] }`.
- `DEFAULT_QUERY_LIMIT` (default 3) and `DISTANCE_MEASURE` (`COSINE`,
  `EUCLIDEAN`, `DOT_PRODUCT`, default `COSINE`) behave as before.
- Gemini and Vertex AI embeddings are still `gemini-embedding-001` at 768
  dimensions.
- A custom endpoint still receives `{ batch: [...] }` and must return
  `{ embeddings: [[...]] }`, and still requires all three of
  `CUSTOM_EMBEDDINGS_ENDPOINT`, `CUSTOM_EMBEDDINGS_BATCH_SIZE` and
  `CUSTOM_EMBEDDINGS_DIMENSION`.

## API surface

- **Main entry** (`@firebase-function-kits/firestore-vector-search`): exports
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
