# firestore-bundle-builder — port spec

> **Executable spec.** Port `firestore-bundle-builder` to an npm-shared **v2**
> Firebase Function. 1:1 behaviour — no new features.
>
> - **Reference source:** [`./legacy`](./legacy) — vendored from
>   `firebase/firestore-bundle-builder@c68dfc1` (whole repo; the extension is at
>   repo root). Reference only.
> - **Pattern to copy:** [`../firestore-bigquery-export`](../firestore-bigquery-export),
>   minus tracker/queue/init.
> - **Background:** [`../../plans/migration/extensions/firestore-bundle-builder.md`](../../plans/migration/extensions/firestore-bundle-builder.md)
> - **Difficulty:** low. Single HTTP function, no queue/secret/lifecycle.

## Legacy source map (`./legacy/functions/src`)
- `index.ts` — the `serve` function: v1 `functions.https.onRequest`. Reads a
  bundle spec from the `BUNDLESPEC_COLLECTION`, builds a Firestore data bundle,
  caches it to Cloud Storage (`BUNDLE_STORAGE_BUCKET`/`STORAGE_PREFIX`), serves
  with cache headers.
- `build_bundle.ts` — bundle assembly from the spec (queries, docs, TTL/caching).

## Trigger mapping (v1 → v2)
| Legacy | v2 |
|---|---|
| `functions.https.onRequest` | `onRequest` (`firebase-functions/https`) |

## Config (`ExportConfig` ← params)
| Param | Field | Type | Default | Notes |
|---|---|---|---|---|
| `BUNDLESPEC_COLLECTION` | `bundleSpecCollection` | string | — | Firestore collection holding bundle specs |
| `BUNDLE_STORAGE_BUCKET` | `bundleStorageBucket` | string | — | Storage bucket for cached bundles (empty ⇒ no cache) |
| `STORAGE_PREFIX` | `storagePrefix` | string | — | Object-name prefix for cached bundles |
| (new) | `region` | string | `us-central1` | function region |

## Factory
```ts
export function defineFirestoreBundleBuilder(config: BundleBuilderConfig): {
  serve: HttpsFunction;
};
```

## Target layout (`packages/firestore-bundle-builder/src`)
- `export-config.ts` — `BundleBuilderConfig` + `resolveConfig`.
- `build-bundle.ts` — ported bundle assembly (framework-agnostic; tier-1-ish).
- `handlers.ts` — `handleServe(req, res, ctx)`: spec lookup, cache hit/miss,
  build, store, respond. Pure-ish (inject Firestore + Storage clients).
- `factory.ts` — `defineFirestoreBundleBuilder`: wires `onRequest` → handler.
- `lib.ts` / `index.ts` / `config.ts` — as per the reference dual-entry pattern.

## Steps
1. Scaffold from the reference; drop tracker/queue/init/events.
2. Port `build_bundle.ts` → `src/build-bundle.ts` (the bundle SDK calls).
3. Port the HTTP handler; preserve **cache-control headers and Storage cache
   read/write** exactly (bundle freshness is the public contract).
4. Map the 3 params in `config.ts`.
5. `metadata` export: `{ roles: ["datastore.user","storage.objectAdmin"], functionNames: ["serve"] }`.
6. Tests: spec→bundle build, cache-hit serves from Storage, cache-miss builds+stores.
7. Confirm the vendored repo isn't diverged from the published extension before
   trusting it as the source of truth.

## Provisioning
None.

## Acceptance criteria
- [ ] `pnpm build` + `pnpm lint` clean; `private:false`.
- [ ] A configured bundle spec serves a valid bundle; second request hits the
      Storage cache; headers match legacy.
- [ ] `./lib` import has no side effects.

## Risks / decisions
- Cache semantics (TTL, max-age, Storage object naming) must match legacy or
  clients re-download / serve stale.
- Decide whether the cache bucket being unset disables caching (legacy behaviour).
