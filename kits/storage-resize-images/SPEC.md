# storage-resize-images — port spec

> **Executable spec.** Port `storage-resize-images` to an npm-shared **v2**
> Firebase Function. 1:1 behaviour — no new features.
>
> - **Reference source:** [`./legacy`](./legacy) — vendored from
>   `firebase/extensions@51d1239`, path `storage-resize-images/`. Reference only.
> - **Pattern to copy:** [`../firestore-bigquery-export`](../firestore-bigquery-export),
>   keep `events.ts`; drop tracker/queue/init.
> - **Background:** [`../../plans/migration/extensions/storage-resize-images.md`](../../plans/migration/extensions/storage-resize-images.md)
> - **Difficulty:** med-high. No provisioning/lifecycle, but the largest
>   single-trigger codebase and a `sharp` native dependency.

## Legacy source map (`./legacy/functions/src`)
- `index.ts` — the `generateResizedImage` function: v1 Storage `object.finalize`.
- `resize-image.ts` — the sharp resize pipeline (sizes, formats, animated).
- `file-operations.ts` — download/upload, metadata, signed-URL/token, make-public.
- `filters.ts` — include/exclude path + content-type gating.
- `content-filter.ts` — optional Gemini/Vertex content filtering + placeholder.
- `placeholder.ts`, `util.ts`, `global.ts`, `config.ts`, `logs.ts`,
  `events.ts` (Eventarc onStart/onSuccess/onError/onCompletion/onStartResize).

## Trigger mapping (v1 → v2)
| Legacy | v2 |
|---|---|
| `functions.storage.object().onFinalize` | `onObjectFinalized` (`firebase-functions/storage`) with `bucket` from config |

## Config (`ExportConfig` ← params)
| Param | Field | Type | Default | Notes |
|---|---|---|---|---|
| `IMG_BUCKET` | `bucket` | string | — | watched bucket |
| `IMG_SIZES` | `sizes` | string[] | — | e.g. `["200x200"]` |
| `DELETE_ORIGINAL_FILE` | `deleteOriginal` | `"true"\|"false"\|"on_success"` | `false` | |
| `MAKE_PUBLIC` | `makePublic` | boolean | `false` | |
| `INCLUDE_PATH_LIST` | `includePathList` | string | — | path globs |
| `EXCLUDE_PATH_LIST` | `excludePathList` | string | — | path globs |
| `IMAGE_TYPE` | `imageTypes` | string[] | — | output formats (multiSelect) |
| `OUTPUT_OPTIONS` | `outputOptions` | string | — | per-format options |
| `SHARP_OPTIONS` | `sharpOptions` | string | — | raw sharp options |
| `IS_ANIMATED` | `isAnimated` | boolean | — | animated handling |
| `FUNCTION_MEMORY` | `memory` | enum | — | v2 `memory` option |
| `REGENERATE_TOKEN` | `regenerateToken` | boolean | — | download-token behaviour |
| `CONTENT_FILTER_LEVEL` | `contentFilterLevel` | enum | off | optional Vertex filter |
| `CUSTOM_FILTER_PROMPT` | `customFilterPrompt` | string | — | filter prompt |
| `PLACEHOLDER_IMAGE_PATH` | `placeholderImagePath` | string | — | blocked-image placeholder |
| (new) | `region` | string | `us-central1` | function region |

## Factory
```ts
export function defineStorageResizeImages(config: ResizeImagesConfig): {
  generateResizedImage: CloudFunction<StorageEvent>;
};
```

## Target layout (`packages/storage-resize-images/src`)
- `export-config.ts` — `ResizeImagesConfig` + `resolveConfig` + the size/option parsers.
- `resize-image.ts`, `file-operations.ts`, `filters.ts`, `content-filter.ts`,
  `placeholder.ts` — port mostly as-is (framework-agnostic core).
- `handlers.ts` — `handleObjectFinalized(event, ctx)`: filter, resize each size,
  upload, optional delete/public, content-filter, emit events. Pure (inject
  Storage client + sharp).
- `factory.ts` — wires `onObjectFinalized({ bucket, region, memory })`.
- `events.ts` / `lib.ts` / `index.ts` / `config.ts` — standard pattern.

## Steps
1. Scaffold from reference; keep `events.ts`.
2. Port the resize pipeline + file-ops + filters verbatim where possible.
3. Wire `onObjectFinalized`; map `FUNCTION_MEMORY` → v2 `memory`,
   re-entrancy guard (skip already-resized outputs) preserved.
4. Gate the Vertex content-filter behind `contentFilterLevel` so the base install
   needs no `aiplatform.user`.
5. Map the ~18 params in `config.ts`.
6. `metadata`: `{ roles:["storage.admin"], apis:["storage-component.googleapis.com"], functionNames:["generateResizedImage"] }` (add `aiplatform.user` only when filtering enabled).
7. Tests: the resize core (sizes × formats), filter gating, delete/public modes.

## Provisioning
None.

## Acceptance criteria
- [ ] `pnpm build` + `pnpm lint` clean; `private:false`.
- [ ] **`sharp` resolves from the published package** (no monorepo-only
      resolution) — verify in a fresh `npm install` of the example.
- [ ] Uploading an image produces all configured sizes at the **same output
      path/naming** as the extension; delete/public/token modes match.
- [ ] `./lib` import side-effect-free.

## Risks / decisions
- **Output path/naming is a hard contract** — existing buckets depend on it.
- `sharp` native binary across Node 22 / Cloud Build — confirm prebuilt binaries.
- Commented backfill task-queue: descope for v1 (recommend) or include with the
  fixed multi-instance queue contract.
