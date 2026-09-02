# @firebase-function-kits/firestore-send-email

Send emails based on documents written to Firestore. This is the Trigger Email
from Firestore Firebase Extension as an npm package you add to your own Firebase
Functions codebase and deploy.

It listens for documents written to a mail collection, renders optional
templates, and delivers through SMTP (username/password or OAuth2). The function
runs in your own Firebase project; there is no hosted version, so you deploy it
yourself.

## Install

```sh
npm install @firebase-function-kits/firestore-send-email
```

## Required IAM

Deploy needs these Google Cloud roles on the function's service account.
Firebase CLI 15.23.0 or later creates that account, grants the roles below,
and attaches it to every function in this kit. Do not set a custom runtime
service account for this codebase — it conflicts with that automatic setup.

| Role                           | Why                                                 |
| ------------------------------ | --------------------------------------------------- |
| `roles/datastore.user`         | read mail documents and write delivery status       |
| `roles/eventarc.eventReceiver` | receive Gen2 Firestore trigger events               |
| `roles/run.invoker`            | allow Eventarc to invoke the Gen2 Cloud Run service |

## Usage

Export the function from your functions codebase entry:

```ts
// functions/src/index.ts
export { processQueue } from "@firebase-function-kits/firestore-send-email";
```

and configure it with a `.env` (or `.env.<projectId>`).

Importing the package without exporting its functions deploys nothing — the CLI
only deploys what your entry file exports.

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

Set these values in a `.env` (or `.env.<projectId>`) file. The Firebase CLI
loads them at deploy time and prompts for any required values that are missing.
Rows marked `secret` live in Secret Manager. You can reuse existing secrets;
the CLI connects them to the function at deploy time.

| Field                 | Env var                | Required | Default            | Description                                           |
| --------------------- | ---------------------- | -------- | ------------------ | ----------------------------------------------------- |
| `mailCollection`      | `MAIL_COLLECTION`      | no       | `mail`             | Firestore collection of outbound mail docs            |
| `defaultFrom`         | `DEFAULT_FROM`         | yes      | —                  | Default From address                                  |
| `defaultReplyTo`      | `DEFAULT_REPLY_TO`     | no       | (empty)            | Default Reply-To address                              |
| `databaseRegion`      | `DATABASE_REGION`      | yes      | (prompted)         | Firestore database location; also places the function |
| `databaseId`          | `DATABASE`             | no       | `(default)`        | Firestore database id                                 |
| `authType`            | `AUTH_TYPE`            | no       | `UsernamePassword` | `UsernamePassword` or `OAuth2`                        |
| `smtpConnectionUri`   | `SMTP_CONNECTION_URI`  | no       | (empty)            | SMTP connection URI (username/password auth)          |
| `smtpPassword`        | `SMTP_PASSWORD`        | secret   | —                  | SMTP password                                         |
| `host`                | `HOST`                 | no       | (empty)            | SMTP host (OAuth2)                                    |
| `oauthPort`           | `OAUTH_PORT`           | no       | `465`              | SMTP port (OAuth2)                                    |
| `oauthSecure`         | `OAUTH_SECURE`         | no       | `true`             | Use TLS (OAuth2)                                      |
| `user`                | `USER`                 | no       | (empty)            | SMTP username (OAuth2)                                |
| `clientId`            | `CLIENT_ID`            | secret   | —                  | OAuth2 client id                                      |
| `clientSecret`        | `CLIENT_SECRET`        | secret   | —                  | OAuth2 client secret                                  |
| `refreshToken`        | `REFRESH_TOKEN`        | secret   | —                  | OAuth2 refresh token                                  |
| `templatesCollection` | `TEMPLATES_COLLECTION` | no       | (empty)            | Optional Handlebars templates collection              |
| `usersCollection`     | `USERS_COLLECTION`     | no       | (empty)            | Optional users collection for recipient lookup        |
| `ttlExpireType`       | `TTL_EXPIRE_TYPE`      | no       | `never`            | TTL policy for processed docs                         |
| `ttlExpireValue`      | `TTL_EXPIRE_VALUE`     | no       | `1`                | TTL amount when expire type is set                    |
| `tlsOptions`          | `TLS_OPTIONS`          | no       | `{}`               | JSON TLS options for the SMTP transport               |

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

## Differences from the Trigger Email from Firestore extension

This kit is version 0.2.10 of the extension repackaged as an npm package you add
to your own functions codebase. Delivery, the `delivery` state machine, the
lease and retry handling, Handlebars templates and partials, UID recipient
lookup, the SendGrid transport, payload validation and the TTL field are all
ported verbatim. Every setting keeps its extension environment variable name and
default, so a `.env` copied from your installed instance needs no value changes.
What does change is where the four secrets come from, where the function runs,
and what is no longer checked or set up for you.

### Create the four secrets by name, all of them

The extension stored each secret param as `ext-<instance id>-<PARAM>` in Secret
Manager. The kit asks for secrets named exactly `SMTP_PASSWORD`, `CLIENT_ID`,
`CLIENT_SECRET` and `REFRESH_TOKEN`, so your existing extension secrets are not
picked up. All four are attached to the function whatever `AUTH_TYPE` is set to,
and were optional in the extension. If a secret does not exist, `firebase deploy`
prompts you for a value, and fails outright when running non-interactively (CI).
On username/password auth create the three OAuth2 secrets with a placeholder
value, and on OAuth2 auth do the same for `SMTP_PASSWORD`.

### DATABASE_REGION now decides where the function runs

In the extension it only told the trigger where your database lived; the
function itself ran in the Cloud Functions location you picked at install. The
kit deploys the function to the region derived from `DATABASE_REGION`, so the
function moves next to your database and the install-time location setting has
no replacement. Regional Firestore locations (`europe-west2`, `us-east1`, ...)
are used as-is; the multi-region locations map to a Cloud Run region inside
them - `nam5` and `nam7` to `us-central1`, `eur3` to `europe-west1` - because
they are not Cloud Run regions themselves and would fail the deploy. The
Firestore trigger always fires in the database's own region, whatever region
the function runs in.

With `DATABASE_REGION` unset or empty, the function declares no region and the
Firebase CLI resolves one at deploy time: it keeps the region it is already
deployed in, and on a first deploy lands in `us-central1` unless you set the
`FIREBASE_FUNCTIONS_DEFAULT_REGION` environment variable when running
`firebase deploy`. Careful with that variable: it applies to every no-region
function in the deploy, not just this kit. Note that changing an existing
install's function region deletes and recreates the function in the new
region.

### Create the Eventarc channel yourself for events

Choosing events at install used to create the channel and set both event
variables for you. The kit only reads them: set `EVENTARC_CHANNEL` in your `.env`
to a channel you have created, and the same seven
`firebase.extensions.firestore-send-email.v1.*` events are published. Per-event
selection is gone in practice, because the CLI rejects any `.env` key beginning
with `EXT_`, so
`EXT_SELECTED_EVENTS` cannot be set and every event type is published. With
`EVENTARC_CHANNEL` unset, nothing is published and the function is otherwise
unaffected.

### Nothing checks your settings at deploy time

The extension rejected a malformed `DEFAULT_FROM`, a `MAIL_COLLECTION` that was
not a valid collection path, an `SMTP_CONNECTION_URI` that was not
`smtp(s)://...:port`, and a `TTL_EXPIRE_VALUE` that was not a positive integer,
before it would install. None of that is checked now. A bad from address or
connection URI deploys cleanly and every document fails at send time with
`delivery.state: ERROR` instead. `TTL_EXPIRE_VALUE: 0` is silently treated as
`1`, and a negative value produces a `delivery.expireAt` in the past, which a TTL
policy will act on immediately.

### The setup steps and the OAuth2 helper are not in the README

Two install-time instructions have no equivalent here. Automatic deletion still
needs you to create a Firestore TTL policy on `delivery.expireAt` by hand for the
collection the function watches, and the SendGrid guidance (categories, dynamic
templates, the `sendgridQueueId` in `delivery.info`) is documented only in the
extension. Both still apply unchanged. The standalone
`oauth2-refresh-token-helper.js` script is not shipped with the package, but it
is a plain download from the extension repository and still works for generating
a refresh token.

### A missing template name now says so

Rendering a template whose name does not exist in your templates collection wrote
a `TypeError` about reading `attachments` into `delivery.error`. It now writes
`Tried to render non-existent template '<name>'`.

### Unchanged

- The watched path is still `MAIL_COLLECTION/{documentId}`, still matched as a
  path pattern so nested collections such as `users/{uid}/mail` keep working, and
  `MAIL_COLLECTION` still defaults to `mail`.
- Every environment variable keeps its name, type and default, including
  `OAUTH_SECURE`, which was a `true`/`false` dropdown and is now a boolean that
  reads those same two values.
- Document fields and their meanings are identical: `to`, `cc`, `bcc`, the
  `*Uids` variants, `message`, `template`, `sendGrid`, `headers`, `categories`,
  `from` and `replyTo`, along with the validation error messages written to
  `delivery.error`.
- The `delivery` state machine is unchanged, including the 60 second processing
  lease, that a document in `SUCCESS` or `ERROR` is never reprocessed, and the
  `delivery.info` shape.
- SendGrid is still selected by an `smtp.sendgrid.net` connection URI with the
  API key in `SMTP_PASSWORD`, and Outlook hosts still get their explicit
  transport configuration.
- The function still runs with a 120 second timeout, and `TLS_OPTIONS`,
  `DATABASE`, `USERS_COLLECTION` and `TEMPLATES_COLLECTION` behave as before.

## API surface

- **Main entry** (`@firebase-function-kits/firestore-send-email`): exports `processQueue`. The
  main entry reads environment variables when the module loads, so use it from
  Firebase deploy/emulator/runtime. For your own triggers, import from `./lib`
  instead.
- **Library entry** (`./lib`): config helpers, handlers, payload preparation,
  template rendering, and transport setup for owning trigger registration
  yourself.

## License

Apache-2.0
