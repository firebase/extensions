# firestore-genai-chatbot — port spec

> **Executable spec.** Port `firestore-genai-chatbot` to an npm-shared **v2**
> Firebase Function. 1:1 behaviour — no new features.
>
> - **Reference source:** [`./legacy`](./legacy) — vendored from
>   `GoogleCloudPlatform/firebase-extensions@4d2a7f9`, path `firestore-genai-chatbot/`.
>   Reference only.
> - **Pattern to copy:** [`../firestore-bigquery-export`](../firestore-bigquery-export),
>   drop tracker/queue/init.
> - **Background:** [`../../plans/migration/extensions/firestore-genai-chatbot.md`](../../plans/migration/extensions/firestore-genai-chatbot.md)
> - **Difficulty:** med-high. No provisioning/lifecycle, but the largest param
>   surface and Genkit/provider weight.

## Legacy source map (`./legacy/functions/src`)

- `index.ts` — the `generateMessage` function: v1 Firestore `document.write` on
  `COLLECTION_NAME/{id}`; reads the prompt, calls the model, writes the response.
- `generate_chat_response.ts` — history assembly + generation.
- `generative-client/` — `genkit.ts`, `vertex_ai.ts`, `google_ai.ts`,
  `base_class.ts`, `index.ts`: provider abstraction.
- `firestore-onwrite-processor/` — the write-processing state machine.
- `overrides.ts` (per-doc option overrides), `firestore.ts`, `config.ts`,
  `types.ts`, `logs.ts`, `logger.ts`, `errors.ts`.

## Trigger mapping (v1 → v2)

| Legacy                                                            | v2                                          |
| ----------------------------------------------------------------- | ------------------------------------------- |
| `functions.firestore.document(`${COLLECTION_NAME}/{id}`).onWrite` | `onDocumentWritten` with `secrets:[apiKey]` |

## Config (`ExportConfig` ← params, ~22)

| Param                                                                  | Field                            | Type                       | Notes                  |
| ---------------------------------------------------------------------- | -------------------------------- | -------------------------- | ---------------------- |
| `GENERATIVE_AI_PROVIDER`                                               | `provider`                       | `"vertex-ai"\|"google-ai"` | provider switch        |
| `API_KEY`                                                              | `apiKey`                         | **secret**                 | required for google-ai |
| `MODEL`                                                                | `model`                          | string                     |                        |
| `LOCATION` / `VERTEX_AI_MODEL_LOCATION`                                | `location`/`vertexModelLocation` | string                     | region + model region  |
| `COLLECTION_NAME`                                                      | `collectionName`                 | string                     | watched collection     |
| `PROMPT_FIELD` / `RESPONSE_FIELD` / `ORDER_FIELD` / `CANDIDATES_FIELD` | `*Field`                         | string                     | doc fields             |
| `CONTEXT`                                                              | `context`                        | string                     | system context         |
| `TEMPERATURE`/`TOP_P`/`TOP_K`/`CANDIDATE_COUNT`/`MAX_OUTPUT_TOKENS`    | generation config                | number                     |                        |
| `ENABLE_DISCUSSION_OPTION_OVERRIDES`                                   | `enableOverrides`                | boolean                    | per-doc overrides      |
| `ENABLE_GENKIT_MONITORING`                                             | `enableGenkitMonitoring`         | boolean                    | gates Genkit telemetry |
| `HARM_CATEGORY_*` (4)                                                  | `safetySettings`                 | enum                       | safety thresholds      |

## Entrypoint

```ts
// index.ts registers required roles/APIs and exports the deployable function.
export const generateMessage: CloudFunction<FirestoreEvent<...>>;
```

## Target layout (`packages/firestore-genai-chatbot/src`)

- `export-config.ts` — `GenaiChatbotConfig` + `resolveConfig` (provider union,
  generation config, safety settings).
- `generative-client/` — port the provider abstraction (genkit + vertex + google-ai).
- `firestore-onwrite-processor/` — port the write processor.
- `handlers.ts` — `handleDocumentWrite(event, ctx)`: assemble history, generate,
  write response/candidates. Pure (inject the generative client + secret).
- `index.ts` — required roles/APIs plus `onDocumentWritten` with
  `secrets:[apiKey]`.
- `lib.ts` / `index.ts` / `config.ts` — standard pattern.

## Steps

1. Scaffold from reference.
2. Port `generative-client/` + `firestore-onwrite-processor/` (the bulk).
3. Provider switch (vertex-ai vs google-ai) as a typed union; wire `API_KEY`
   secret only for google-ai.
4. Gate Genkit monitoring behavior behind `enableGenkitMonitoring`.
5. Map the ~22 params; preserve per-doc overrides + safety settings.
6. Register roles/APIs from `extension.yaml` in `index.ts`.
7. Tests: generation with the client mocked (history, overrides, candidates).

## Provisioning

None.

## Acceptance criteria

- [ ] `pnpm build` + `pnpm lint` clean; `private:false`.
- [ ] A chat doc gets a generated response/candidates; overrides + safety settings
      behave as in the extension.
- [ ] Both providers work (google-ai via secret; vertex-ai via IAM).
- [ ] `./lib` import side-effect-free.

## Risks / decisions

- Genkit version pinning + monitoring exporters add dependency weight.
- Keep it a 1:1 behaviour port, not a redesign of the GenAI surface.
