# firestore-translate-text — port spec

> **Executable spec.** Port `firestore-translate-text` to an npm-shared **v2**
> Firebase Function. 1:1 behaviour — no new features.
>
> - **Reference source:** [`./legacy`](./legacy) — vendored from
>   `firebase/extensions@51d1239`, path `firestore-translate-text/`. Reference only.
> - **Pattern to copy:** [`../firestore-bigquery-export`](../firestore-bigquery-export)
>   (keep `events.ts` for Eventarc; drop tracker/queue/init).
> - **Background:** [`../../plans/migration/extensions/firestore-translate-text.md`](../../plans/migration/extensions/firestore-translate-text.md)
> - **Difficulty:** medium. One write trigger; only provisioning is granting an
>   API-key **secret** — this is the secrets reference for the simpler ports.

## Legacy source map (`./legacy/functions/src`)

- `index.ts` — the `fstranslate` function: v1 Firestore `document.write` on
  `COLLECTION_PATH/{messageId}`. Translates `INPUT_FIELD_NAME` into `LANGUAGES`,
  writes results to `OUTPUT_FIELD_NAME`. Supports a per-doc `LANGUAGES_FIELD_NAME`.
- `translate/` — `translateDocument.ts`, `translateSingle.ts`,
  `translateMultiple.ts`, `common.ts`: the translate orchestration.
- `translate` providers: Google **Translate API** or **Gemini**
  (`TRANSLATION_PROVIDER` select; `GEMINI_MODEL`, `GOOGLE_AI_API_KEY` secret).
- `validators.ts`, `events.ts` (Eventarc onStart/onSuccess/onError/onCompletion),
  `config.ts`, `logs/`.

## Trigger mapping (v1 → v2)

| Legacy                                                            | v2                                                   |
| ----------------------------------------------------------------- | ---------------------------------------------------- |
| `functions.firestore.document(`${COLLECTION_PATH}/{id}`).onWrite` | `onDocumentWritten` (`firebase-functions/firestore`) |

## Config (`ExportConfig` ← params)

| Param                  | Field                | Type                             | Default            | Notes                               |
| ---------------------- | -------------------- | -------------------------------- | ------------------ | ----------------------------------- |
| `COLLECTION_PATH`      | `collectionPath`     | string                           | —                  | watched collection                  |
| `INPUT_FIELD_NAME`     | `inputFieldName`     | string                           | —                  | source text field                   |
| `OUTPUT_FIELD_NAME`    | `outputFieldName`    | string                           | —                  | translations output field           |
| `LANGUAGES`            | `languages`          | string[]                         | —                  | target language codes               |
| `LANGUAGES_FIELD_NAME` | `languagesFieldName` | string                           | —                  | per-doc language override field     |
| `TRANSLATION_PROVIDER` | `provider`           | `"google-translate" \| "gemini"` | `google-translate` | provider switch                     |
| `GEMINI_MODEL`         | `geminiModel`        | string                           | —                  | when provider = gemini              |
| `GOOGLE_AI_API_KEY`    | `googleAiApiKey`     | **secret**                       | —                  | `defineSecret`; required for gemini |

## Entrypoint

```ts
// index.ts registers required roles/APIs and exports the deployable function.
export const fstranslate: CloudFunction<FirestoreEvent<...>>;
```

## Target layout (`packages/firestore-translate-text/src`)

- `export-config.ts` — `TranslateConfig` + `resolveConfig` + provider union.
- `translate/` — port providers + orchestration (single/multiple/document).
- `handlers.ts` — `handleDocumentWrite(event, ctx)`: detect changed input,
  resolve languages, call provider, write output, emit events. Pure (inject
  provider client + secret value).
- `index.ts` — registers required roles/APIs and wires `onDocumentWritten`
  (+ `secrets: [googleAiApiKey]`).
- `events.ts` — port Eventarc publishing from the reference.
- `lib.ts` / `index.ts` / `config.ts` — dual-entry pattern.

## Steps

1. Scaffold from reference; keep `events.ts`.
2. Port `translate/` modules; abstract the provider behind a small interface so
   `google-translate` vs `gemini` is a typed switch.
3. Wire the secret via `defineSecret("GOOGLE_AI_API_KEY")`; pass it in the
   trigger's `secrets` option; read with `.value()` in the handler context.
   Document granting it and **reusing the existing secret** on migration
   (don't re-enter).
4. Map params in `config.ts`; preserve update-detection (only translate when the
   input field changed) and delete handling.
5. Register roles/APIs from `extension.yaml` in `index.ts`.
6. Tests: handler with provider mocked (add/update/delete, multi-language,
   per-doc override); `pnpm test`.

## Provisioning

None (no lifecycle). Secret must exist + be granted to the runtime SA — document
as a prerequisite, like the IAM contract.

## Acceptance criteria

- [ ] `pnpm build` + `pnpm lint` clean; `private:false`.
- [ ] Writing a doc translates into all configured languages; per-doc override
      works; no re-translate when input unchanged.
- [ ] Gemini provider path works with the secret; Google Translate path needs no
      secret.
- [ ] Eventarc events fire; `./lib` import side-effect-free.

## Risks / decisions

- The legacy yaml has a **commented-out backfill task-queue**. Decide: descope
  for v1 (recommended; document as follow-up) or include with the fixed
  multi-instance queue contract.
- Secret-reuse UX on migration ties to the migration tooling.
