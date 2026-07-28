# rtdb-limit-child-nodes — port spec

> **Executable spec.** Port the `rtdb-limit-child-nodes` Firebase Extension to an
> npm-shared **v2** Firebase Function. 1:1 behaviour — no new features.
>
> - **Reference source:** [`./legacy`](./legacy) — vendored from
>   `firebase/extensions@51d1239`, path `rtdb-limit-child-nodes/`. Reference only:
>   not built, linted, published, or imported.
> - **Pattern to copy:** [`../firestore-bigquery-export`](../firestore-bigquery-export)
>   (entrypoint / handlers / lib), minus tracker/queue/init.
> - **Background:** [`../../plans/migration/extensions/rtdb-limit-child-nodes.md`](../../plans/migration/extensions/rtdb-limit-child-nodes.md)
> - **Difficulty:** lowest in the fleet. No external API, no queue, no secret, no
>   lifecycle/provisioning. Do this one first to prove the pattern.

## Legacy source map (`./legacy/functions/src`)

- `index.ts` — the `rtdblimit` function: v1 `functions.database.ref(path).onCreate`,
  trims oldest children when the node exceeds `MAX_COUNT`.
- `config.ts` — reads env (`NODE_PATH`, `MAX_COUNT`, `SELECTED_DATABASE_INSTANCE`).
- `logs.ts` — structured logs.

## Trigger mapping (v1 → v2)

| Legacy                                                                   | v2                                                                                   |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `functions.database.instance(...).ref(`${NODE_PATH}/{nodeId}`).onCreate` | `onValueCreated` (`firebase-functions/database`) with `ref` + `instance` from config |

## Config (`ExportConfig` ← params)

| Param                        | Field              | Type   | Default               | Notes                                                    |
| ---------------------------- | ------------------ | ------ | --------------------- | -------------------------------------------------------- |
| `NODE_PATH`                  | `nodePath`         | string | —                     | RTDB path to cap; trigger watches `${nodePath}/{nodeId}` |
| `MAX_COUNT`                  | `maxCount`         | number | —                     | Max children to keep                                     |
| `SELECTED_DATABASE_INSTANCE` | `databaseInstance` | string | default RDTB instance | required; always passed to v2 `instance` option          |
| (new)                        | `region`           | string | `us-central1`         | function region                                          |

## Entry Point

`index.ts` is the only module that defines Firebase triggers. It registers
required IAM roles and wires `rtdblimit` with deploy-time params.

## Target layout (`packages/rtdb-limit-child-nodes/src`)

- `export-config.ts` — `RtdbLimitConfig` + `resolveConfig` (defaults).
- `handlers.ts` — `handleChildCreated(event, ctx)`: pure trim logic (query node,
  count, remove oldest over `maxCount`). Unit-testable without firebase-functions.
- `logs.ts` — port from legacy.
- `lib.ts` — re-export handler + config types (no side effects).
- `index.ts` — env entry: `configFromEnv()` → `onValueCreated` (clone-and-deploy example).
- `config.ts` — env params (`defineString`/`defineInt`) → `RtdbLimitConfig`.

## Steps

1. Scaffold from the reference package; delete tracker/queue/init/events pieces.
2. Port the trim algorithm from `legacy/.../index.ts` into `handlers.ts`. Replace
   v1 `snapshot.ref.parent` / `change` access with the v2 `DatabaseEvent` shape.
3. Wire `onValueCreated({ ref: `${nodePath}/{nodeId}`, instance, region })`.
4. Map the 3 params in `config.ts`.
5. Register `roles/firebasedatabase.admin` in the entrypoint.
6. Tests: `handlers.test.ts` (over/under/equal `maxCount`); run with `pnpm test`.
7. Add an `examples/rtdb-limit-child-nodes` degit starter (mirror the reference example).

## Provisioning

None. No lifecycle, nothing to create.

## Acceptance criteria

- [ ] `pnpm build` + `pnpm lint` clean; `package.json` `private:false`.
- [ ] Handler unit tests pass; trimming keeps newest `maxCount`, removes oldest.
- [ ] Deployed to a scratch project: writing > `maxCount` children trims correctly.
- [ ] `./lib` import has no load-time side effects.

## Risks / decisions

- RTDB instance/region binding in v2 must come from config, not a fixed path.
- Preserve legacy binding semantics by keeping `SELECTED_DATABASE_INSTANCE`
  required, defaulting it from `DATABASE_INSTANCE` when available, and always
  passing the resolved value into the v2 trigger `instance` option.
- Confirm ordering semantics: legacy trims by key order (push-id chronological) —
  preserve exactly.
