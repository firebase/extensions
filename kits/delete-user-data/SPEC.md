# delete-user-data — port spec

> **Executable spec.** Port `delete-user-data` to npm-shared **v2** Firebase
> Functions. 1:1 behaviour — no new features. **Read "Trigger-shape decision"
> first: this one needs a design call before coding.**
>
> - **Reference source:** [`./legacy`](./legacy) — vendored from
>   `firebase/extensions@51d1239`, path `delete-user-data/`. Reference only.
> - **Pattern to copy:** [`../firestore-bigquery-export`](../firestore-bigquery-export),
>   drop tracker/init.
> - **Background:** [`../../plans/migration/extensions/delete-user-data.md`](../../plans/migration/extensions/delete-user-data.md)
> - **Difficulty:** med-high. No lifecycle/init endpoint, but the **auth-delete
>   trigger has no clean v2 equivalent** and **Pub/Sub topics are no longer
>   auto-provisioned**.

## Legacy source map (`./legacy/functions/src`)

- `index.ts` — three functions:
  - `clearData` — v1 Auth `user.delete`; deletes Firestore/RTDB/Storage data.
  - `handleSearch` — Pub/Sub `topic.publish`; auto-discovery search fan-out.
  - `handleDeletion` — Pub/Sub `topic.publish`; batch deletion fan-out.
- `recursiveDelete.ts`, `search.ts`, `runCustomSearchFunction.ts`,
  `runBatchPubSubDeletions.ts`, `helpers.ts`, `types.ts`, `config.ts`, `logs.ts`.

## Trigger-shape decision (do this first)

v1 `functions.auth.user().onDelete` has **no clean v2 background equivalent**.
The v2 path is the _blocking_ `beforeUserDeleted` (Identity Platform), different
semantics. Pick one and record it in this spec before coding:

- **A. `beforeUserDeleted` blocking fn** — runs before deletion; hand off to a
  queue/Pub/Sub to do the work async. Behaviour shift (blocking, can fail-open).
- **B. Keep the Auth trigger via `firebase-functions/v1`** — `clearData` stays a
  v1 auth trigger; the rest go v2. Least behaviour change; mixes v1+v2.
- **C. Callable/HTTP `deleteUserData(uid)`** — most portable, no auth magic;
  consumer wires it to their auth lifecycle. Recommended if a behaviour shift is
  acceptable; cleanest for the npm model.

**Decision:** B. Keep `clearData` on the v1 Auth `user.delete` trigger for this
port. It preserves the shipped async post-delete behavior and avoids changing
the public deletion contract while the Pub/Sub fan-out handlers move to v2.

## Trigger mapping (v1 → v2)

| Legacy                                     | v2                                       |
| ------------------------------------------ | ---------------------------------------- |
| Auth `user.delete` (`clearData`)           | **decision above** (A/B/C)               |
| Pub/Sub `topic.publish` (`handleSearch`)   | `onMessagePublished` (topic from config) |
| Pub/Sub `topic.publish` (`handleDeletion`) | `onMessagePublished` (topic from config) |

## Config (`ExportConfig` ← params)

| Param                          | Field                 | Type    | Notes                                           |
| ------------------------------ | --------------------- | ------- | ----------------------------------------------- |
| `FIRESTORE_PATHS`              | `firestorePaths`      | string  | `{UID}`-templated paths                         |
| `FIRESTORE_DATABASE_ID`        | `firestoreDatabaseId` | string  |                                                 |
| `FIRESTORE_DELETE_MODE`        | `firestoreDeleteMode` | enum    | recursive / shallow                             |
| `SELECTED_DATABASE_INSTANCE`   | `rtdbInstance`        | string  | RTDB                                            |
| `SELECTED_DATABASE_LOCATION`   | `rtdbLocation`        | string  | RTDB                                            |
| `RTDB_PATHS`                   | `rtdbPaths`           | string  |                                                 |
| `CLOUD_STORAGE_BUCKET`         | `storageBucket`       | string  |                                                 |
| `STORAGE_PATHS`                | `storagePaths`        | string  |                                                 |
| `ENABLE_AUTO_DISCOVERY`        | `enableAutoDiscovery` | boolean |                                                 |
| `AUTO_DISCOVERY_SEARCH_DEPTH`  | `searchDepth`         | number  |                                                 |
| `AUTO_DISCOVERY_SEARCH_FIELDS` | `searchFields`        | string  |                                                 |
| `SEARCH_FUNCTION`              | `searchFunction`      | string  | custom search URL                               |
| (new)                          | `topicName`           | string  | the fan-out Pub/Sub topic (was runtime-created) |

## Factory

```ts
export function defineDeleteUserData(config: DeleteUserDataConfig): {
  clearData: ...;        // shape depends on the trigger decision
  handleSearch: CloudFunction<CloudEvent<MessagePublishedData>>;
  handleDeletion: CloudFunction<CloudEvent<MessagePublishedData>>;
};
```

## Target layout (`packages/delete-user-data/src`)

- `export-config.ts` — `DeleteUserDataConfig` + `resolveConfig`.
- `recursive-delete.ts`, `search.ts`, `batch-deletions.ts`, `custom-search.ts` —
  port the deletion/discovery core (framework-agnostic).
- `handlers.ts` — `handleClear(uid, ctx)`, `handleSearch(msg, ctx)`,
  `handleDeletion(msg, ctx)`. Pure (inject Firestore/RTDB/Storage + Pub/Sub).
- `factory.ts` — wires the chosen auth shape + two `onMessagePublished`.
- `lib.ts` / `index.ts` / `config.ts` — standard pattern.

## Steps

1. **Resolve the trigger-shape decision (A/B/C).** Record it here.
2. **Provision Pub/Sub topic(s):** they were created by the Extensions runtime.
   Standalone: create explicitly (a small init/HTTP step or documented
   `gcloud pubsub topics create`), and pass the name via config.
3. Port the multi-datastore deletion + auto-discovery search.
4. Wire `onMessagePublished` for the two fan-out functions.
5. Map params; preserve `{UID}` path templating + delete modes.
6. `metadata`: `{ roles:["datastore.owner","firebasedatabase.admin","storage.admin","pubsub.admin"], functionNames:["clearData","handleSearch","handleDeletion"] }`.
7. Tests (isolated — destructive): deletion across all three datastores, search
   fan-out, with clients mocked.

## Provisioning

No lifecycle event, but **Pub/Sub topic(s) must be created** (no longer
automatic). Treat as a documented prerequisite or a tiny init step.

## Acceptance criteria

- [ ] Trigger-shape decision recorded and implemented.
- [ ] `pnpm build` + `pnpm lint` clean; `private:false`.
- [ ] Deleting a user removes data across Firestore/RTDB/Storage; auto-discovery + custom search behave as in the extension.
- [ ] Pub/Sub fan-out works against the configured topic.
- [ ] `./lib` import side-effect-free.

## Risks / decisions

- **Auth-delete trigger shape (highest risk)** — raise with Google early; it
  dictates the public API. See A/B/C.
- Pub/Sub topic provisioning is now explicit.
- Broad destructive roles — test isolation and dry-run guards matter.
