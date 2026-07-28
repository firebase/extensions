# firestore-send-email — port spec

> **Executable spec.** Port `firestore-send-email` to an npm-shared **v2**
> Firebase Function. 1:1 behaviour — no new features.
>
> - **Reference source:** [`./legacy`](./legacy) — vendored from
>   `firebase/extensions@51d1239`, path `firestore-send-email/`. Reference only.
> - **Pattern to copy:** [`../firestore-bigquery-export`](../firestore-bigquery-export),
>   keep `events.ts`; drop tracker/queue/init.
> - **Background:** [`../../plans/migration/extensions/firestore-send-email.md`](../../plans/migration/extensions/firestore-send-email.md)
> - **Difficulty:** med-high. No init endpoint, but **4 Secret Manager secrets**
>   and a delivery state-machine. This is the **reference for the secret pattern**.

## Legacy source map (`./legacy/functions/src`)

- `index.ts` — the `processQueue` function: v2 Firestore `document.v1.written`
  on `MAIL_COLLECTION/{id}`; sends via SMTP, writes `delivery.*` state back.
- `prepare-payload.ts` — builds the message (templates, users collection).
- `templates.ts` — Handlebars templates from `TEMPLATES_COLLECTION`.
- `helpers.ts`, `validation.ts`, `types.ts`, `config.ts`, `logs.ts`,
  `events.ts` (onStart/onProcessing/onRetry/onPending/onSuccess/onComplete/onError),
  `nodemailer-sendgrid/` — SendGrid transport.

## Trigger mapping (v1 → v2)

| Legacy                                       | v2                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| v2 `document.v1.written` (already v2-shaped) | `onDocumentWritten` (`firebase-functions/firestore`) with `secrets:[...]` |

## Config (`ExportConfig` ← params)

| Param                                  | Field                            | Type       | Default | Notes                |
| -------------------------------------- | -------------------------------- | ---------- | ------- | -------------------- |
| `MAIL_COLLECTION`                      | `mailCollection`                 | string     | —       | watched mail queue   |
| `SMTP_CONNECTION_URI`                  | `smtpConnectionUri`              | string     | —       | transport URI        |
| `SMTP_PASSWORD`                        | `smtpPassword`                   | **secret** | —       | `defineSecret`       |
| `AUTH_TYPE`                            | `authType`                       | enum       | —       | password / OAuth2    |
| `HOST` / `OAUTH_PORT` / `OAUTH_SECURE` | `host`/`oauthPort`/`oauthSecure` | string     | —       | OAuth transport      |
| `CLIENT_ID`                            | `clientId`                       | **secret** | —       | OAuth2               |
| `CLIENT_SECRET`                        | `clientSecret`                   | **secret** | —       | OAuth2               |
| `REFRESH_TOKEN`                        | `refreshToken`                   | **secret** | —       | OAuth2               |
| `USER`                                 | `user`                           | string     | —       | SMTP user            |
| `DEFAULT_FROM`                         | `defaultFrom`                    | string     | —       |                      |
| `DEFAULT_REPLY_TO`                     | `defaultReplyTo`                 | string     | —       |                      |
| `USERS_COLLECTION`                     | `usersCollection`                | string     | —       | per-user lookups     |
| `TEMPLATES_COLLECTION`                 | `templatesCollection`            | string     | —       | Handlebars templates |
| `TTL_EXPIRE_TYPE`                      | `ttlExpireType`                  | enum       | —       | doc TTL              |
| `TLS_OPTIONS`                          | `tlsOptions`                     | string     | —       | raw TLS opts         |
| `DATABASE_REGION`                      | `databaseRegion`/`region`        | string     | —       | region               |

## Entry Point

`index.ts` is the only module that defines Firebase triggers. It wires
`processQueue` using deploy-time parameter expressions so function discovery
does not resolve runtime config.

## Target layout (`packages/firestore-send-email/src`)

- `export-config.ts` — `SendEmailConfig` + `resolveConfig` (password vs OAuth2 union).
- `prepare-payload.ts`, `templates.ts`, `nodemailer-sendgrid/` — port mostly as-is.
- `handlers.ts` — `handleQueueDoc(event, ctx)`: the delivery state-machine
  (PENDING→PROCESSING→SUCCESS/ERROR, retries). Pure (inject transport + secrets).
- `index.ts` — `onDocumentWritten` with `secrets:[smtpPassword,clientId,clientSecret,refreshToken]`.
- `events.ts` / `lib.ts` / `config.ts` — standard pattern.

## Steps

1. Scaffold from reference; keep `events.ts`.
2. **Establish the secret pattern here:** declare each secret via `defineSecret`,
   pass into trigger `secrets`, read `.value()` in the handler context.
   Document granting + **reusing existing secrets on migration** (don't re-enter).
3. Port the transport(s) (SMTP + SendGrid) and templating.
4. Port the delivery state-machine **preserving the `delivery.*` document shape**
   (clients read `delivery.state`).
5. Map params; resolve the password-vs-OAuth2 branch.
6. Tests: state transitions (success/retry/error), templating, with transport mocked.

## Provisioning

None at runtime. Secrets must exist + be granted to the runtime SA — document as
a prerequisite; coordinate secret-reuse with the migration tooling.

## Acceptance criteria

- [ ] `pnpm build` + `pnpm lint` clean; `private:false`.
- [ ] A mail doc sends and the `delivery.state` machine matches the extension.
- [ ] Both password and OAuth2 transports work via secrets.
- [ ] `./lib` import side-effect-free.

## Risks / decisions

- **Secret pattern correctness** — this is the template other ports copy.
- **`delivery.*` doc contract** must not change.
- Reusing existing Secret Manager secrets vs re-provisioning is a cutover-UX
  decision tied to the migration tooling.
