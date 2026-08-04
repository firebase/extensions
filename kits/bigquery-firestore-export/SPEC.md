# bigquery-firestore-export — port spec

> **Executable spec.** Port `bigquery-firestore-export` ("Export BigQuery to
> Firestore") to npm-shared **v2** Firebase Functions. 1:1 behaviour — no new
> features.
>
> - **Reference source:** `GoogleCloudPlatform/firebase-extensions@68ef3fa`,
>   path `bigquery-firestore-export/` (v0.2.2). Not vendored — fetch via
>   `gh api` when needed.
> - **Pattern to copy:** [`../firestore-bigquery-export`](../firestore-bigquery-export)
>   (lifecycle task + lazy context; no tracker/init module, no Eventarc).
> - **Difficulty:** medium-high. DTS provisioning, Pub/Sub topic ownership, and
>   an instance-identity migration key.

## Legacy source map (`functions/src`)

- `index.ts` — two functions: `processMessages` (v1 Pub/Sub trigger on
  `ext-${EXT_INSTANCE_ID}-processMessages`) and `upsertTransferConfig`
  (task queue invoked by lifecycle events onInstall/onUpdate/onConfigure);
  the upsert orchestration lives inline here.
- `dts.ts` — BigQuery Data Transfer Service create/get/update, diff-based
  updateMask, partitioning-field removal error contract.
- `helper.ts` — Pub/Sub message handling, BigQuery query of the run's
  destination table, chunked Firestore writes, transactional `latest` doc,
  BQ→Firestore type conversion, resource-name parsers.
- `config.ts`, `types.ts`, `logs.ts` — env config, payload types, logging.
- The `transferConfigName` "link existing config" branch in `index.ts` is dead
  at v0.2.2 (`config.transferConfigName` hardcoded `undefined`, no param):
  **not ported**.

## Trigger mapping (v1 → v2)

| Legacy                                                      | v2                                                                                                                          |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `functions.pubsub.topic(pubSubTopic).onPublish`             | `onMessagePublished` (`firebase-functions/pubsub`)                                                                          |
| `functions.tasks.taskQueue().onDispatch` + lifecycle events | `onTaskDispatched` + `afterFirstDeploy`/`afterRedeploy` (both point at `upsertTransferConfig`; the reconcile is idempotent) |

v2 event delta: v1 `message.json` → `event.data.message.json`.

## Config (`ExportConfig` ← params)

| Param                       | Field                     | Type   | Default                             | Notes                                                                       |
| --------------------------- | ------------------------- | ------ | ----------------------------------- | --------------------------------------------------------------------------- |
| `LOCATION`                  | `location`                | select | `us-central1`                       | function region                                                             |
| `BIGQUERY_DATASET_LOCATION` | `bigqueryDatasetLocation` | select | `US`                                | BQ query job location                                                       |
| `DISPLAY_NAME`              | `displayName`             | string | — (prompted)                        | DTS display name, creation-only                                             |
| `DATASET_ID`                | `datasetId`               | string | — (prompted)                        | destination dataset                                                         |
| `TABLE_NAME`                | `tableName`               | string | — (prompted)                        | prefix for `${TABLE_NAME}_{run_time\|"%H%M%S"}`                             |
| `QUERY_STRING`              | `queryString`             | string | — (prompted)                        | scheduled SQL                                                               |
| `PARTITIONING_FIELD`        | `partitioningField`       | string | `""`                                | creation-time; cannot be cleared later                                      |
| `SCHEDULE`                  | `schedule`                | string | — (prompted)                        | DTS schedule                                                                |
| `COLLECTION_PATH`           | `firestoreCollection`     | string | `transferConfigs`                   | root collection                                                             |
| `LOG_LEVEL`                 | `logLevel`                | select | `info`                              |                                                                             |
| `INSTANCE_ID` _(new)_       | `instanceId`              | string | `bigquery-firestore-export`         | replaces `EXT_INSTANCE_ID`; the `extInstanceId` doc tag — **migration key** |
| `PUBSUB_TOPIC` _(new)_      | `pubsubTopic`             | string | `ext-<INSTANCE_ID>-processMessages` | short topic name; default preserves the legacy extension topic              |

## Key decisions

- **Instance identity:** the extension's `EXT_INSTANCE_ID` becomes the
  `INSTANCE_ID` param. Migrating users set it to their old instance id so their
  existing `{COLLECTION_PATH}/{transferConfigId}` docs (tagged `extInstanceId`)
  and DTS config are adopted by the update path instead of duplicated.
- **Topic provisioning:** the Extensions runtime auto-created the notification
  topic; standalone, the provisioning task creates it idempotently
  (ALREADY_EXISTS swallowed) before the DTS reconcile. `roles/pubsub.admin`
  also lets DTS grant its service agent publish rights on the topic.
- **DTS `serviceAccountName`** (creation-only): resolved at runtime from the
  GCE metadata server (the task runs as the managed runtime SA); omitted when
  the lookup fails (emulator/local).
- **Extensions runtime glue removed:** `setProcessingState` calls become logs;
  retryable failures throw (Cloud Tasks retries); the partitioning-field
  removal error is **terminal** (logged, no rethrow) because the DTS API can
  never accept it.

## Target layout (`kits/bigquery-firestore-export/src`)

- `config.ts` — params, `CONFIG_EXPRESSIONS { location, pubsubTopic }` (topic
  expression mirrors the runtime fallback via CEL `thenElse`), `configFromEnv`.
- `export-config.ts` — `ExportConfig`, `ResolvedExportConfig`,
  `resolveExportConfig`, `topicResourceName`.
- `dts.ts` — DTS request builders/calls with injected client; resource-name
  parsers; partitioning error contract.
- `firestore.ts` — chunked output writes, run doc, transactional `latest`,
  instance-association query. `convert.ts` — BQ→Firestore type conversion.
- `handlers.ts` — `handleProcessMessage(event, ctx)`,
  `handleUpsertTransferConfig(ctx)`; injected `HandlerContext`
  `{ db, config, dts, bigquery, pubsub, resolveServiceAccountEmail? }`.
- `index.ts` — `requiresRole` ×3, lifecycle hooks, lazy context, the two
  wired functions. `lib.ts` — side-effect-free surface.

## Firestore document contract (frozen — client-visible)

- `{COLLECTION_PATH}/{transferConfigId}`: mirrored DTS config + `extInstanceId`.
- `.../runs/{runId}`: `{ runMetadata, failedRowCount, totalRowCount }`.
- `.../runs/latest`: same + `latestRunId`; transactional update handles
  redelivery and out-of-order runs.
- `.../runs/{runId}/output/{autoId}`: converted result rows.

## Provisioning

`upsertTransferConfig` is enqueued automatically by `afterFirstDeploy` and
`afterRedeploy`. Roles (declared via `requiresRole`): `roles/datastore.user`,
`roles/bigquery.admin`, `roles/pubsub.admin`. APIs to enable (prerequisite,
documented in README): `bigquery.googleapis.com`,
`bigquerydatatransfer.googleapis.com`.

## Acceptance criteria

- [x] `npm run build` clean; `npm test` green (vitest, mocked clients).
- [x] `./lib` import side-effect-free.
- [ ] Deploy: DTS run fires → topic notification → rows land at
      `{collection}/{configId}/runs/{runId}/output`, `runs/{runId}` +
      `runs/latest` written.
- [ ] Re-running upsert with unchanged config is a no-op (empty update mask);
      config change produces a minimal-mask update.
- [ ] Migrating user with `INSTANCE_ID` set adopts the existing transfer
      config/topic (no duplicates).

## Risks

- **First-deploy race:** the Pub/Sub trigger may deploy before the lifecycle
  task creates the topic. If the deploy fails on a missing topic, pre-create it
  (`gcloud pubsub topics create <topic>`) or redeploy.
- Destination table name is reconstructed by replacing the exact template
  `{run_time|"%H%M%S"}`; template drift breaks the lookup (as upstream).
- `serviceAccountName` and `DISPLAY_NAME` are creation-only in the DTS API.
- E2E tests (live DTS, 15-minute schedules) descoped from this port; covered by
  deploy verification above.
