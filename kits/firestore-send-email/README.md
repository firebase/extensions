# @firebase/firestore-send-email

Send emails based on documents written to Firestore. This is the Trigger Email
from Firestore Firebase Extension as an npm package you add to your own Firebase
Functions codebase and deploy.

It listens for documents written to a mail collection, renders optional
templates, and delivers through SMTP (username/password or OAuth2). The function
runs in your own Firebase project; there is no hosted version, so you deploy it
yourself.

## Install

```sh
npm install @firebase/firestore-send-email
```

## Required IAM

The package declares the roles below with `requiresRole(...)`. Firebase CLI
15.23.0 or later creates a managed runtime service account for the codebase,
grants it these roles, and attaches it to every function in the codebase.

| Role | Why |
|---|---|
| `roles/datastore.user` | read mail documents and write delivery status |
| `roles/eventarc.eventReceiver` | receive Gen2 Firestore trigger events |
| `roles/run.invoker` | allow Eventarc to invoke the Gen2 Cloud Run service |

## Usage

Re-export the wired function from your functions codebase entry:

```ts
// functions/src/index.ts
export { processQueue } from "@firebase/firestore-send-email";
```

and configure it with a `.env` (or `.env.<projectId>`), which the Firebase CLI
loads at deploy time, prompting for anything required that is unset.

The re-export matters: the Firebase CLI discovers functions from the top-level
exports of your codebase entry, so a bare `import` of the package deploys
nothing.

## Deploy

The package's `firebase.json` declares a `kit` stanza (Firebase CLI 15.25.1 or
later, behind the `kits` experiment):

```json
{
  "functions": [
    {
      "source": ".",
      "kit": "firestore-send-email",
      "instances": {
        "default": "."
      }
    }
  ]
}
```

`instances` maps each instance id to the directory (relative to
`firebase.json`) holding that instance's `.env`. The CLI prefixes every
function and task queue name with `kit-<instance id>-`, so the function above
deploys as `kit-default-processQueue`.

```sh
firebase experiments:enable kits
firebase deploy --only functions
```

Deploy a single instance with `firebase deploy --only functions:<instance id>`.

## Configuration

Configuration is via v2 function params: env vars named as the upper snake-case
of the fields below. Secret-backed params follow the extension migration
pattern and are declared with `defineSecret`, passed to the trigger through
`secrets: [...]`, and only resolved at runtime via `.value()`. That allows
existing Secret Manager secrets to be reused during migration instead of forcing
operators to re-enter them.

| Field | Env var | Required | Default | Description |
|---|---|---|---|---|
| `mailCollection` | `MAIL_COLLECTION` | no | `mail` | Firestore collection of outbound mail docs |
| `defaultFrom` | `DEFAULT_FROM` | yes | — | Default From address |
| `defaultReplyTo` | `DEFAULT_REPLY_TO` | no | (empty) | Default Reply-To address |
| `databaseRegion` | `DATABASE_REGION` | yes | — | Region for the trigger |
| `databaseId` | `DATABASE` | no | `(default)` | Firestore database id |
| `authType` | `AUTH_TYPE` | no | `UsernamePassword` | `UsernamePassword` or `OAuth2` |
| `smtpConnectionUri` | `SMTP_CONNECTION_URI` | no | (empty) | SMTP connection URI (username/password auth) |
| `smtpPassword` | `SMTP_PASSWORD` | secret | — | SMTP password |
| `host` | `HOST` | no | (empty) | SMTP host (OAuth2) |
| `oauthPort` | `OAUTH_PORT` | no | `465` | SMTP port (OAuth2) |
| `oauthSecure` | `OAUTH_SECURE` | no | `true` | Use TLS (OAuth2) |
| `user` | `USER` | no | (empty) | SMTP username (OAuth2) |
| `clientId` | `CLIENT_ID` | secret | — | OAuth2 client id |
| `clientSecret` | `CLIENT_SECRET` | secret | — | OAuth2 client secret |
| `refreshToken` | `REFRESH_TOKEN` | secret | — | OAuth2 refresh token |
| `templatesCollection` | `TEMPLATES_COLLECTION` | no | (empty) | Optional Handlebars templates collection |
| `usersCollection` | `USERS_COLLECTION` | no | (empty) | Optional users collection for recipient lookup |
| `ttlExpireType` | `TTL_EXPIRE_TYPE` | no | `never` | TTL policy for processed docs |
| `ttlExpireValue` | `TTL_EXPIRE_VALUE` | no | `1` | TTL amount when expire type is set |
| `tlsOptions` | `TLS_OPTIONS` | no | `{}` | JSON TLS options for the SMTP transport |

## Multiple instances

To process several mail queues, add one entry per instance to the `instances`
map, each pointing at its own config directory with its own `.env`:

```json
{
  "functions": [
    {
      "source": ".",
      "kit": "firestore-send-email",
      "instances": {
        "transactional": "instances/transactional",
        "marketing": "instances/marketing"
      }
    }
  ]
}
```

Instance ids must be unique across all kit stanzas in the project, and every
instance's function names are namespaced by its `kit-<instance id>-` prefix, so
the instances cannot collide.

## Events

When `EVENTARC_CHANNEL` is configured, the function publishes lifecycle events
such as `onStart`, `onProcessing`, `onSuccess`, `onError`, `onComplete`,
`onPending`, and `onRetry` under
`firebase.extensions.firestore-send-email.v1.*`.

## API surface

- **Main entry** (`@firebase/firestore-send-email`): the wired `processQueue`
  function, configured from env params at load time. Because it reads the
  environment at load time, it only runs cleanly inside the Firebase toolchain
  (deploy discovery, runtime, or the emulator).
- **Library entry** (`./lib`): side-effect-free config helpers, handlers, payload
  preparation, template rendering, and transport setup for owning trigger
  registration yourself.

## License

Apache-2.0
