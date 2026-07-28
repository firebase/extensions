# firestore-counter — port spec

> **Executable spec.** Port `firestore-counter` to npm-shared **v2** Firebase
> Functions. 1:1 behaviour — no new features.
>
> - **Reference source:** [`./legacy`](./legacy) — vendored from
>   `firebase/extensions@51d1239`, path `firestore-counter/`. Reference only.
>   Includes `legacy/clients/` (the **client-SDK contract** — see Risks).
> - **Pattern to copy:** [`../firestore-bigquery-export`](../firestore-bigquery-export),
>   minus tracker/queue/init.
> - **Background:** [`../../plans/migration/extensions/firestore-counter.md`](../../plans/migration/extensions/firestore-counter.md)
> - **Difficulty:** medium. No secret, no init endpoint — but a scheduled worker
>   and a **public client-SDK doc contract** to preserve.

## Legacy source map (`./legacy/functions/src`)

- `index.ts` — exports three functions: `controllerCore` (scheduled),
  `onWrite` (Firestore write on shard docs), `worker` (Firestore write on the
  internal-state path).
- `controller.ts` — aggregation controller; schedules/dispatches work.
- `worker.ts` — aggregates shards into parent counters.
- `aggregator.ts`, `planner.ts`, `common.ts` — core sharding/aggregation engine
  (framework-agnostic).
- `events.ts` — Eventarc onStart/onError/onCompletion.
- `legacy/clients/` — web/node/android/dart client SDKs that read the shard
  layout. **Do not change the doc structure they depend on.**

## Trigger mapping (v1 → v2)

| Legacy                                                                              | v2                                            |
| ----------------------------------------------------------------------------------- | --------------------------------------------- |
| `functions.pubsub.schedule("every ${SCHEDULE_FREQUENCY} minutes")` (controllerCore) | `onSchedule` (`firebase-functions/scheduler`) |
| `functions.firestore.document(...).onWrite` (onWrite)                               | `onDocumentWritten`                           |
| `functions.firestore.document(`${INTERNAL_STATE_PATH}/...`).onWrite` (worker)       | `onDocumentWritten`                           |

## Config (`ExportConfig` ← params)

| Param                 | Field                      | Type   | Default       | Notes                                                           |
| --------------------- | -------------------------- | ------ | ------------- | --------------------------------------------------------------- |
| `INTERNAL_STATE_PATH` | `internalStatePath`        | string | —             | doc path for controller state; drives the `worker` trigger path |
| `SCHEDULE_FREQUENCY`  | `scheduleFrequencyMinutes` | number | —             | `onSchedule` interval                                           |
| (new)                 | `region`                   | string | `us-central1` | function region                                                 |

## Entry Point

`index.ts` is the only module that defines Firebase triggers. It wires
`controllerCore`, `onWrite`, and `worker` using deploy-time parameter
expressions so function discovery does not resolve runtime config.

## Target layout (`packages/firestore-counter/src`)

- `export-config.ts` — `CounterConfig` + `resolveConfig`.
- `aggregator.ts`, `planner.ts`, `common.ts` — port the engine **verbatim**
  (it's already framework-agnostic); this is the bulk and the contract.
- `controller.ts`, `worker.ts` — port; strip v1 function wiring.
- `handlers.ts` — `handleSchedule(ctx)`, `handleShardWrite(event, ctx)`,
  `handleWorker(event, ctx)`.
- `index.ts` — wires `onSchedule` (interval from param expression) + two
  `onDocumentWritten` triggers. Note the `worker` trigger path comes from
  `INTERNAL_STATE_PATH`.
- `events.ts` / `lib.ts` / `config.ts` — standard pattern.

## Steps

1. Scaffold from reference; keep `events.ts`.
2. Port the engine (`aggregator`/`planner`/`common`) unchanged — preserve the
   shard/counter doc schema exactly.
3. Map the scheduled controller → `onSchedule`. The Cloud Scheduler job is
   provisioned **at deploy** by `onSchedule`.
4. Wire the two write triggers; `worker` watches `${internalStatePath}/...`.
5. Map params in `config.ts`.
6. Tests: aggregation correctness (shards → parent), schedule handler, write
   handlers; `pnpm test`.

## Provisioning

None at runtime. The schedule is created by `firebase deploy` via `onSchedule`.

## Acceptance criteria

- [ ] `pnpm build` + `pnpm lint` clean; `private:false`.
- [ ] Shard increments aggregate to the parent counter on schedule and on write.
- [ ] **Existing `firestore-counter` client SDKs read the counters unchanged**
      (doc structure byte-compatible).
- [ ] `onSchedule` interval matches `SCHEDULE_FREQUENCY`.
- [ ] `./lib` import side-effect-free.

## Risks / decisions

- **Client-SDK contract (highest risk here):** the sharded-counter doc layout is
  consumed by published client libraries. Any schema drift breaks live clients —
  port the engine without changing field names/paths.
- Confirm `onSchedule` interval semantics (every-N-minutes) match the old
  `pubsub.schedule` frequency string.
- `controllerCore` previously may have self-scheduled follow-up work via tasks —
  check whether the v2 port needs a task queue or stays purely scheduled.
