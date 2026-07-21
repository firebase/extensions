# firestore-vector-search — port spec

> **Executable spec draft.** Port `firestore-vector-search` to an npm-shared
> **v2** Firebase Functions package. 1:1 behaviour — no new features.
>
> - **Reference source:** `GoogleCloudPlatform/firebase-extensions`, path
>   `firestore-vector-search/` (version `0.1.3`). Vendor this into
>   `packages/firestore-vector-search/legacy/` before implementation; never
>   import, build, lint, or publish `legacy/`.
> - **Pattern to copy:** [`../firestore-bigquery-export`](../firestore-bigquery-export),
>   but keep the init/provisioning endpoint pattern and fix task-queue naming
>   before wiring queues.
> - **Background:** [`../../plans/migration/extensions/firestore-vector-search.md`](../../plans/migration/extensions/firestore-vector-search.md)
> - **Difficulty:** high. Five task queues, two write triggers, one query HTTP
>   endpoint, lifecycle provisioning, Firestore vector index management, Vertex
>   embeddings, Cloud Storage reads, and multiple secret/provider paths.

## Prerequisites / decisions
1. **Vendor upstream legacy source first.** This package currently has no
   `legacy/` directory, so implementation must start by vendoring the upstream
   extension source at the pinned commit/version used by the migration wave.
2. **Land the multi-instance queue-name contract first.** This extension has
   five task queues. Every enqueue path must use the same configurable function
   name that registers the corresponding `onTaskDispatched` function. Do not
   hardcode queue names.
3. **Init endpoint shape.** Replace lifecycle events with explicit HTTP init
   endpoint(s). They must be idempotent and private-by-default, create/update
   the Firestore vector index, and enqueue backfill/update work.
4. **Provider scope.** Preserve all upstream embedding providers:
   `gemini`, `multimodal`, `openai`, `vertex`, and `custom`. Secrets must use
   `defineSecret` and migration must reuse existing Secret Manager secrets.
5. **Firestore vector index parity.** Confirm upstream uses Firestore native
   vector indexes (not Vertex Matching Engine) and preserve that behaviour.

## Legacy source map (`./legacy/functions/src`)
- `index.ts` — function exports and trigger wiring:
  - `updateTrigger` — task queue that queues document update tasks.
  - `updateTask` — task queue that embeds changed documents.
  - `backfillTrigger` — task queue that queues backfill work.
  - `backfillTask` — task queue that embeds existing documents.
  - `embedOnWrite` — Firestore write trigger for source collection documents.
  - `queryOnWrite` — Firestore write trigger for query documents.
  - `queryCallable` — HTTPS query endpoint.
- `config.ts` — env singleton for all params and provider selection.
- `logs.ts` — shared logging.
- `embeddings/` — embedding provider abstraction and implementations:
  - `embeddings/index.ts`, `embeddings/logs.ts`
  - `embeddings/client/` — Gemini, multimodal, OpenAI, Vertex, and custom clients.
- `queries/` — query endpoint and query-on-write processing:
  - `queries/index.ts`, `queries/query_on_call.ts`, `queries/setup.ts`,
    `queries/util.ts`.
- `vector-store/` — Firestore vector store:
  - `vector-store/base_class.ts`, `vector-store/firestore.ts`,
    `vector-store/index.ts`.

## Trigger mapping (v1 → v2)
| Legacy | v2 |
|---|---|
| `taskQueueTrigger` (`updateTrigger`) | `onTaskDispatched` (`firebase-functions/tasks`) |
| `taskQueueTrigger` (`updateTask`) | `onTaskDispatched` |
| `taskQueueTrigger` (`backfillTrigger`) | `onTaskDispatched` |
| `taskQueueTrigger` (`backfillTask`) | `onTaskDispatched` |
| Firestore `document.write` (`embedOnWrite`) | `onDocumentWritten` |
| Firestore `document.write` (`queryOnWrite`) | `onDocumentWritten` |
| `httpsTrigger` (`queryCallable`) | `onRequest` or `onCall`; choose to preserve upstream request shape |
| Lifecycle `onInstall → backfillTrigger` | `afterInstall` task hook that provisions index and enqueues backfill |
| Lifecycle `onConfigure → updateTrigger` | `afterUpdate` task hook that reconciles index and enqueues updates |

## Config (`VectorSearchConfig` ← params)
| Param | Field | Type | Default / notes |
|---|---|---|---|
| `EMBEDDING_PROVIDER` | `embeddingProvider` | `"gemini"\|"multimodal"\|"openai"\|"vertex"\|"custom"` | default `gemini` |
| `GEMINI_API_KEY` | `geminiApiKey` | secret | for Gemini provider |
| `OPENAI_API_KEY` | `openAiApiKey` | secret | for OpenAI provider |
| `CUSTOM_EMBEDDINGS_ENDPOINT` | `customEmbeddingsEndpoint` | string | for custom provider |
| `CUSTOM_EMBEDDINGS_BATCH_SIZE` | `customEmbeddingsBatchSize` | number | for custom provider |
| `CUSTOM_EMBEDDINGS_DIMENSION` | `customEmbeddingsDimension` | number | for custom provider and index dimension |
| `COLLECTION_NAME` | `collectionPath` | string | source collection |
| `DEFAULT_QUERY_LIMIT` | `defaultQueryLimit` | number | default `3` |
| `DISTANCE_MEASURE` | `distanceMeasure` | `"COSINE"\|"EUCLIDEAN"\|"DOT_PRODUCT"` | default `COSINE` |
| `INPUT_FIELD_NAME` | `inputFieldName` | string | default `input` |
| `OUTPUT_FIELD_NAME` | `outputFieldName` | string | default `embedding` |
| `STATUS_FIELD_NAME` | `statusFieldName` | string | default `status` |
| `DO_BACKFILL` | `doBackfill` | boolean | lifecycle/backfill gate |
| `UPDATE_ON_CONFIGURE` | `updateOnConfigure` | boolean | lifecycle/update gate |
| `LOCATION` | `region` | string | function + provider location |
| (new) | queue names | object | exported function names for all five queues |

## Entrypoint
```ts
// index.ts registers required roles/APIs/lifecycle hooks and exports all
// deployable functions directly.
export const updateTrigger: TaskQueueFunction<unknown>;
export const updateTask: TaskQueueFunction<VectorTaskData>;
export const backfillTrigger: TaskQueueFunction<unknown>;
export const backfillTask: TaskQueueFunction<VectorTaskData>;
export const embedOnWrite: CloudFunction<FirestoreEvent<...>>;
export const queryOnWrite: CloudFunction<FirestoreEvent<...>>;
export const queryCallable: CallableFunction<unknown, { ids: string[] }>;
export const initVectorSearch: TaskQueueFunction<unknown>;
```

## Target layout (`packages/firestore-vector-search/src`)
- `export-config.ts` — `VectorSearchConfig`, `ResolvedVectorSearchConfig`,
  provider union, queue-name config, index config, and `resolveConfig`.
- `embeddings/` — port provider clients; no env singleton. Construct per
  invocation when secrets are available.
- `vector-store/` — Firestore vector store and index/query helpers.
- `queries/` — query endpoint and query-on-write logic.
- `backfill.ts`, `updates.ts` — queue task cores for backfill/update fan-out.
- `handlers.ts` — pure handlers:
  - `handleEmbedOnWrite(event, ctx)`
  - `handleQueryOnWrite(event, ctx)`
  - `handleQueryRequest(req, res, ctx)` or callable equivalent
  - `handleUpdateTrigger(data, ctx)`
  - `handleUpdateTask(data, ctx)`
  - `handleBackfillTrigger(data, ctx)`
  - `handleBackfillTask(data, ctx)`
  - `handleInit(req, res, ctx)`
- `index.ts` — wires two Firestore triggers, five task queues, query endpoint,
  init task, region/memory/timeouts/secrets, required roles/APIs, and lifecycle
  hooks.
- `events.ts` — Eventarc onStart/onSuccess/onError/onCompletion.
- `config.ts` / `lib.ts` — config expressions and reusable library exports.

## Steps
1. Vendor upstream `firestore-vector-search/` into
   `packages/firestore-vector-search/legacy/`.
2. Read `legacy/extension.yaml` and confirm this spec's param table/resource map
   against the pinned source.
3. Land or copy the fixed multi-instance queue-name contract before creating
   any enqueue calls.
4. Define typed config and preserve all `UPPER_SNAKE` env names in `config.ts`.
5. Port embeddings clients with config and secrets injected; do not read env in
   `./lib`.
6. Port Firestore vector store/index/query helpers. Preserve document fields:
   input, output embedding, status, query, limit, and prefilters.
7. Port queue handlers. Ensure each enqueue targets the configured queue name
   matching the exported function symbol.
8. Port Firestore write handlers for source documents and query documents.
9. Port query endpoint using the upstream request/response contract. If using
   `onRequest`, type response structurally instead of adding `express`.
10. Add init task: idempotently create/update the Firestore vector index and
    enqueue backfill/update tasks according to config.
11. Register required roles, APIs, and lifecycle hooks from `index.ts`.
12. Add tests with mocked embeddings/vector-store/queues; run each as written.
13. Verify build/lint/tests; set `private:false` only once implementation is
    complete.

## Provisioning
- Firestore vector index lifecycle moves to the `initVectorSearch` task. It must
  be safe to call repeatedly after deploy.
- Backfill/update lifecycle work is registered through `afterInstall` and
  `afterUpdate` lifecycle hooks.
- Provider secrets must exist and be granted to the runtime service account
  before deploy/runtime use.
- For migration, reuse existing resources and secrets where possible.

## Acceptance criteria
- [ ] Upstream source is vendored to `legacy/` and excluded from build/lint.
- [ ] Multi-instance queue-name contract is fixed for all five queues.
- [ ] `pnpm build` + package lint clean; `private:false`.
- [ ] `./lib` import has no load-time side effects.
- [ ] Init endpoint creates/reconciles Firestore vector index idempotently.
- [ ] `embedOnWrite` writes embeddings and status fields matching legacy.
- [ ] Backfill and update queues process all configured documents and retry
      safely.
- [ ] Query endpoint and `queryOnWrite` return/write ranked vector results with
      the same request/doc contract as legacy.
- [ ] Gemini, multimodal, OpenAI, Vertex, and custom providers work behind the
      typed provider interface; secrets are read only at runtime.
- [ ] Scratch-project round trip verified: deploy, init, backfill, write update,
      query endpoint, query document.

## Risks / decisions
- **Highest queue risk in the fleet:** five queues make any queue-name mismatch a
  silent data-loss/retry-loss bug.
- **Index lifecycle is async:** index create/update needs reconcile logic and
  clear operator feedback for "building" vs "ready".
- **Provider drift:** upstream provider SDK APIs may change; check installed
  versions before implementation.
- **Location coupling:** Vertex/Gemini provider support may constrain `LOCATION`.
- **Cost/destructive operations:** backfill can read/embed large collections and
  write many documents; tests must use isolated projects/mocks.
