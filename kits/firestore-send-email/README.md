# @firebase-function-kits/firestore-send-email

Send emails based on documents written to Firestore. This is the Trigger Email
from Firestore Firebase Extension as an npm package you add to your own Firebase
Functions codebase and deploy.

> **Pre-release:** this kit has not been released yet. The `latest` version
> on npm is a placeholder with no kit code. Pre-release builds are published
> under the `next` tag and may change between builds:
>
> ```sh
> npm install @firebase-function-kits/firestore-send-email@next
> ```

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

| Role                           | Why                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| `roles/datastore.user`         | read mail documents and write delivery status                                              |
| `roles/eventarc.eventReceiver` | receive Gen2 Firestore trigger events                                                      |
| `roles/run.invoker`            | allow Eventarc to invoke the Gen2 Cloud Run service                                        |
| `roles/eventarc.publisher`     | publish the kit's custom Eventarc events (the Extensions platform granted this implicitly) |

## Usage

Export the function from your functions codebase entry:

```ts
// functions/src/index.ts
export { processQueue } from "@firebase-function-kits/firestore-send-email";
```

and configure it in a `.env.<projectId>` file (see [Uninstall](#uninstall) for
why not a plain `.env`).

Importing the package without exporting its functions deploys nothing — the CLI
only deploys what your entry file exports.

## Deploy

Add a `kit` stanza to your project's `firebase.json` (Firebase CLI 15.27.0 or
later, behind the `kits` experiment):

```json
{
  "functions": [
    {
      "source": ".",
      "kit": "firestore-send-email",
      "instances": {
        "default": "instances/default"
      }
    }
  ]
}
```

`instances` maps each instance id to the directory (relative to
`firebase.json`) holding that instance's `.env.<projectId>`. Give each instance
a directory of its own: `functions:kits:uninstall` treats every `.env.*` file in
it as instance config. The CLI prefixes every function and task queue name with
`kit-<instance-id>-`, so the function above deploys as
`kit-default-processQueue`.

```sh
firebase experiments:enable kits
firebase deploy --only functions
```

Deploy a single instance with `firebase deploy --only functions:<instance-id>`.

## Configuration

Set these values in a `.env.<projectId>` file, such as `.env.my-project`. The
Firebase CLI loads them at deploy time and prompts for any required values that
are missing. A plain `.env` deploys the same way, but
`functions:kits:uninstall` ignores it (see [Uninstall](#uninstall)).
Rows with a `(secret)` default live in Secret Manager. You can reuse existing
secrets; the CLI connects them to the function at deploy time.

`SMTP_PASSWORD` is attached to the function only when it is needed, which the
kit decides from the values in your `.env` files when the deploy loads it.
Whenever it is attached, it replaces any password in `SMTP_CONNECTION_URI`, as
in the extension.

| Situation                                                                                     | Prompted, if the secret does not exist yet? | Attached?         |
| --------------------------------------------------------------------------------------------- | ------------------------------------------- | ----------------- |
| URI with password in `.env`                                                                   | No                                          | No                |
| URI answered at the deploy prompt                                                             | Yes                                         | First deploy only |
| `firebase ext:migrate` (instance had no `SMTP_PASSWORD`) or `firebase functions:kits:install` | Yes, any non-empty value                    | No                |
| `FIREBASE_SECRET_REF_SMTP_PASSWORD` in `.env`                                                 | Yes, for the secret it names                | Yes               |
| `AUTH_TYPE=OAuth2` in `.env`, or a SendGrid URI (`smtp.sendgrid.net`)                         | Yes                                         | Yes               |

A URI answered at the deploy prompt is written to `.env.<projectId>` and only
counts from the next deploy, so answer the `SMTP_PASSWORD` prompt with your real
password, or with any value and run `firebase deploy` again. `firebase
ext:migrate` writes `FIREBASE_SECRET_REF_SMTP_PASSWORD` when the extension
instance had an `SMTP_PASSWORD` secret; remove it if you want the URI password
used.

We recommend putting the password in `SMTP_PASSWORD` rather than in the URI: a
password in the URI is stored in a plain environment variable, while the secret
is kept in Secret Manager. The URI form still works for existing setups.

For the emulator, leave `SMTP_PASSWORD` out of `.secret.local` when the URI
includes the password, because the emulator passes every `.secret.local` value
to the function.

A setting with **No** under "Can be blank" fails the deploy on a line like
`DEFAULT_FROM=`. Give it a value, or remove the line and answer the prompt.

| Field                 | Env var                | Can be blank | Default            | Description                                           |
| --------------------- | ---------------------- | ------------ | ------------------ | ----------------------------------------------------- |
| `mailCollection`      | `MAIL_COLLECTION`      | No           | `mail`             | Firestore collection of outbound mail docs            |
| `defaultFrom`         | `DEFAULT_FROM`         | No           | —                  | Default From address                                  |
| `defaultReplyTo`      | `DEFAULT_REPLY_TO`     | Yes          | (empty)            | Default Reply-To address                              |
| `databaseRegion`      | `DATABASE_REGION`      | Yes          | (prompted)         | Firestore database location; also places the function |
| `databaseId`          | `DATABASE`             | No           | `(default)`        | Firestore database id                                 |
| `authType`            | `AUTH_TYPE`            | No           | `UsernamePassword` | `UsernamePassword` or `OAuth2`                        |
| `smtpConnectionUri`   | `SMTP_CONNECTION_URI`  | Yes          | (empty)            | SMTP connection URI (username/password auth)          |
| `smtpPassword`        | `SMTP_PASSWORD`        | —            | (secret)           | SMTP password                                         |
| `host`                | `HOST`                 | Yes          | (empty)            | SMTP host (OAuth2)                                    |
| `oauthPort`           | `OAUTH_PORT`           | Yes          | `465`              | SMTP port (OAuth2)                                    |
| `oauthSecure`         | `OAUTH_SECURE`         | Yes          | `true`             | Use TLS (OAuth2)                                      |
| `user`                | `USER`                 | Yes          | (empty)            | SMTP username (OAuth2)                                |
| `clientId`            | `CLIENT_ID`            | —            | (secret)           | OAuth2 client id                                      |
| `clientSecret`        | `CLIENT_SECRET`        | —            | (secret)           | OAuth2 client secret                                  |
| `refreshToken`        | `REFRESH_TOKEN`        | —            | (secret)           | OAuth2 refresh token                                  |
| `templatesCollection` | `TEMPLATES_COLLECTION` | Yes          | (empty)            | Optional Handlebars templates collection              |
| `usersCollection`     | `USERS_COLLECTION`     | Yes          | (empty)            | Optional users collection for recipient lookup        |
| `ttlExpireType`       | `TTL_EXPIRE_TYPE`      | No           | `never`            | TTL policy for processed docs                         |
| `ttlExpireValue`      | `TTL_EXPIRE_VALUE`     | No           | `1`                | TTL amount when expire type is set                    |
| `tlsOptions`          | `TLS_OPTIONS`          | Yes          | `{}`               | JSON TLS options for the SMTP transport               |

A value that contains `#` may need quotes in the `.env.<projectId>` file; see
[Quote settings that contain a hash sign](../README.md#quote-settings-that-contain-a-hash-sign).

Single-quote JSON values such as `TLS_OPTIONS` in the `.env.<projectId>` file. In a double-quoted
value the CLI turns `\n` into a real newline, so a PEM certificate no longer
parses as JSON, and the kit falls back to `{"rejectUnauthorized":false}`
(certificate checks off) with only a warning:

```
TLS_OPTIONS='{"ca":"-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----\n"}'
```

The CLI does not check values that are already in the file, so the kit checks
them itself when the deploy loads it, as the extension did at install time. The
deploy fails with an error naming the setting if `DATABASE_REGION`,
`AUTH_TYPE`, `OAUTH_SECURE` or `TTL_EXPIRE_TYPE` is not one of its option values
or their labels (the error lists the allowed values), or if
`SMTP_CONNECTION_URI`, `MAIL_COLLECTION`, `DEFAULT_FROM` or `TTL_EXPIRE_VALUE`
is not in the format the extension accepted (the error gives the extension's
message). One error lists
every bad setting, along with any required setting left blank. The values are
case sensitive. The emulator runs the same check, so a bad value stops the
function from loading there. An empty `OAUTH_SECURE` means `true`, as it did in
the extension.

An option's label (such as `Day`) is accepted because the extension's
installer accepted it, but it runs as it did in the extension: any
`TTL_EXPIRE_TYPE` label, `Never` included, leaves every document without a
`delivery` field, `OAUTH_SECURE=Yes` connects without TLS, and a
`DATABASE_REGION` label is not a region the function can deploy to. Use the
values instead.

## Multiple instances

To process several mail queues, add one entry per instance to the `instances`
map, each pointing at its own config directory with its own `.env.<projectId>`:

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
instance's function names are namespaced by its `kit-<instance-id>-` prefix, so
the instances cannot collide.

## Events

When `EVENTARC_CHANNEL` is configured, the function publishes lifecycle events
such as `onStart`, `onProcessing`, `onSuccess`, `onError`, `onComplete`,
`onPending`, and `onRetry` under
`firebase.extensions.firestore-send-email.v1.*`.

## Uninstall

```sh
firebase functions:kits:uninstall --instance <instance-id>
```

This deletes the instance's function, its trigger, and the service account the
CLI created for it. It then removes the instance from `firebase.json` and
deletes its `.env.<projectId>` file. If it is the kit's only instance, it
removes the whole kit entry, leaving `"functions": []`. Despite what the prompt
says, it doesn't delete your functions source when the kit is exported from
your own codebase, as in [Usage](#usage).

The command asks you to confirm, twice if this is the kit's only instance. In a
non-interactive shell (CI, a script, any shell without a TTY, or when the CLI
detects an AI agent), add `--force`. Without it nothing is deleted: the command
exits 0 for the kit's only instance, and fails with `Command aborted.`
otherwise.

- **Plain `.env`.** The command only deletes what is deployed to a project with
  a `.env.<projectId>` (or `.env.<alias>`) file in the instance's config
  directory. With only a plain `.env`, it removes the instance from
  `firebase.json` and exits without an error, but the function keeps running
  and keeps sending mail. Rename the file first. If you already uninstalled,
  put the instance (or, if it was the only one, the whole kit entry) back in
  `firebase.json`, rename the file, and run the command again.
- **Several projects.** Give each its own `.env.<projectId>` (copy a shared
  `.env`, don't rename it) and run the command once per project with
  `--project <project-id>`. The instance stays in `firebase.json` until the
  last project's file is gone.
- **Other `.env.*` files.** Move any other `.env.*` file, such as `.env.local`
  (the emulator override) or a `.env.bak`, out of the config directory first.
  Next to a plain `.env` it makes the command fail with "contains no .env file
  for current project". Next to `.env.<projectId>` the command deletes the
  function but leaves the instance in `firebase.json`, and running it again
  fails with that error.

Uninstalling the extension also deleted its secrets and the service account's
IAM role bindings. The kit's uninstall leaves both:

- The instance's secrets in Secret Manager, `kit-<instance-id>-SMTP_PASSWORD`,
  `kit-<instance-id>-CLIENT_ID`, `kit-<instance-id>-CLIENT_SECRET` and
  `kit-<instance-id>-REFRESH_TOKEN`. `SMTP_PASSWORD` and the OAuth2 ones hold
  credentials for your mail server. Delete each with
  `gcloud secrets delete <secret> --project <project-id>`, unless you pointed
  another function at it. A secret you reused with a
  `FIREBASE_SECRET_REF_<NAME>` line in `.env.<projectId>` is used under its own
  name instead, so there is no `kit-<instance-id>-<NAME>` secret for it. Delete
  it only if nothing else uses it.
- The deleted service account's project roles. They no longer grant
  access, and show in your project's IAM policy as members like
  `deleted:serviceAccount:firebase-fn-<n>@<project-id>.iam.gserviceaccount.com?uid=<n>`.
  The account's name doesn't include the instance id, and other kits' deleted
  accounts look the same, so note the `firebase-fn-<n>` account the uninstall
  command prints ("The following managed service accounts will also be
  deleted" or "Deleting managed service account"). List its roles with:

  ```sh
  gcloud projects get-iam-policy <project-id> --flatten="bindings[].members" --filter="bindings.members:deleted:serviceAccount:firebase-fn-<n>@" --format="value(bindings.role,bindings.members)"
  ```

  and remove each one, one command per role, with
  `gcloud projects remove-iam-policy-binding <project-id> --member='<member>' --role=<role> --condition=None`.
  Keep the quotes: the `?` in the member makes some shells, such as zsh, fail
  with "no matches found".

## Differences from the Trigger Email from Firestore extension

This kit is version 0.2.10 of the extension repackaged as an npm package you add
to your own functions codebase. Delivery, the `delivery` state machine, the
lease and retry handling, Handlebars templates and partials, UID recipient
lookup, the SendGrid transport, payload validation and the TTL field are all
ported verbatim. Every setting keeps its extension environment variable name and
default, so a `.env` copied from your installed instance needs no value changes.
What does change is where the secrets come from, where the function runs,
and what is no longer checked or set up for you.

### Create the secrets by name

The extension stored each secret param as `ext-<instance-id>-<PARAM>` in Secret
Manager. The kit asks for `kit-<instance-id>-SMTP_PASSWORD`,
`kit-<instance-id>-CLIENT_ID`, `kit-<instance-id>-CLIENT_SECRET` and
`kit-<instance-id>-REFRESH_TOKEN` (`kit-default-SMTP_PASSWORD` and so on for the
`default` instance), so your existing extension secrets are not picked up unless
you add a line such as
`FIREBASE_SECRET_REF_SMTP_PASSWORD=ext-<instance-id>-SMTP_PASSWORD` to
`.env.<projectId>`. All four were optional in the extension. The three OAuth2
secrets are attached to the function whatever `AUTH_TYPE` is set to, and so is
`SMTP_PASSWORD` unless the connection URI already includes the password and
your `.env` files have no binding for it (see [Configuration](#configuration)).
If a secret does not exist, `firebase deploy` prompts you for a value, and fails
outright when running non-interactively (CI).

On username/password auth create the three OAuth2 secrets with a placeholder
value. If your `SMTP_CONNECTION_URI` includes the password, keep it and
`AUTH_TYPE` in your `.env` files and the deploy does not attach `SMTP_PASSWORD`.
`firebase ext:migrate` still asks for it once: answer with any non-empty value,
such as a placeholder, which is stored but not used.

On OAuth2 auth create `SMTP_PASSWORD` with a placeholder value, unless you send
through SendGrid: the SendGrid transport reads `SMTP_PASSWORD` as its API key
whatever `AUTH_TYPE` is set to, so a connection URI pointing at
`smtp.sendgrid.net` needs your real API key there and a placeholder fails every
send with a 401.

### DATABASE_REGION now decides where the function runs

In the extension it only told the trigger where your database lived; the
function itself always ran in `us-central1`, as the extension offered no
location setting. The kit deploys the function to the region derived from
`DATABASE_REGION`, so the function moves next to your database. Regional
Firestore locations (`europe-west2`, `us-east1`, ...) are used as-is; the
multi-region locations map to a Cloud Run region inside them - `nam5` and
`nam7` to `us-central1`, `eur3` to `europe-west1` - because they are not Cloud
Run regions themselves and would fail the deploy. The value is case sensitive,
as in the extension, so `NAM5` fails the deploy. The Firestore trigger always fires in the database's own
region, whatever region the function runs in.

If you copied `DATABASE_REGION` into your `.env.<projectId>` from an extension
install, it is honored: the function deploys near your database.

Placement needs firebase-tools 15.28.0 or later - older CLIs do not load
`.env` values during deploy discovery, so the function silently falls back to
the no-region behavior below. Upgrading the CLI (or this kit, if your
`.env.<projectId>` already carried `DATABASE_REGION`) can itself trigger the
region move described below on your next deploy.

`firebase functions:kits:install` and `firebase ext:migrate` prompt for this
value and write it to `.env.<projectId>` before anything is deployed, so a
single deploy places the function correctly. If you instead run
`firebase deploy` with the value still missing from `.env.<projectId>`, the
prompt comes after discovery has already chosen a region, so your answer only
takes effect on the following deploy.

`firebase ext:migrate` also writes `FUNCTION_DEFAULT_REGION` to your
`.env.<projectId>`, recording where the extension's function ran. Nothing reads
it: placement comes from `DATABASE_REGION` alone, so if the two disagree your
next deploy moves the function.

With an explicit empty `DATABASE_REGION=` line in `.env.<projectId>`, the function declares
no region and the Firebase CLI resolves one at deploy time: it keeps the region
it is already deployed in, and on a first deploy it lands in `us-central1`. The
CLI would otherwise place it next to the database, but it resolves the default
region before it resolves params, so the `DATABASE` param this kit passes to the
trigger is still an unresolved expression when the database is looked up, and
the lookup falls back
([firebase/firebase-tools#11020](https://github.com/firebase/firebase-tools/issues/11020)).
Set the `FIREBASE_FUNCTIONS_DEFAULT_REGION` environment variable when running
`firebase deploy` to land somewhere else. Careful with that variable: it applies
to every no-region function in the deploy, not just this kit. Omitting the line
is not the same as an empty one: a non-interactive deploy fails with `In
non-interactive mode but have no value for the following environment variables:
DATABASE_REGION`. Note that changing an existing install's function region
deletes and recreates the function in the new region. `processQueue` is the
kit's only function and nothing reconciles the mail collection afterwards, so
any document written while the function is gone is never delivered. Stop
writers and let the collection drain before a deploy that moves the region.

### Create the Eventarc channel yourself for events

Choosing events at install used to create the channel and set both event
variables for you. The kit only reads them: set `EVENTARC_CHANNEL` in your `.env.<projectId>`
to a channel you have created, and the same seven
`firebase.extensions.firestore-send-email.v1.*` events are published. Per-event
selection is gone in practice, because the CLI rejects any `.env` key beginning
with `EXT_`, so
`EXT_SELECTED_EVENTS` cannot be set and every event type is published. With
`EVENTARC_CHANNEL` unset, nothing is published and the function is otherwise
unaffected.

### CloudEvent source has changed

Each event's CloudEvent `source` used to identify the extension instance
(`//firebaseextensions.googleapis.com/extensions/projects/<project-id>/instances/<instance-id>`).
The Firebase CLI now sets it to the function that published the event
(`projects/<project-id>/locations/<region>/services/kit-<instance-id>-processQueue`).
Only `processQueue` publishes, so each instance still has one `source`. If your
event triggers filter on `source`, change the filter to the new value.

### A failed event publish doesn't stop delivery

If an event can't be published, the kit logs a warning and carries on. The
extension failed the function instead, so a failed `onStart` publish meant the
mail was never sent.

### An empty required setting fails the deploy

The kit checks `.env` values against the extension's install-time rules (see
[Configuration](#configuration)), with one difference: a required setting left
empty, such as `DEFAULT_FROM=`, fails the deploy instead of taking its default.

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
  `OAUTH_SECURE`, which is still a `true`/`false` dropdown, and keeps the
  extension's `Yes` / `No` option labels.
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
- The function still runs like the extension's: 0.1666 vCPU
  (`cpu: "gcf_gen1"`), one event per instance (`concurrency: 1`) and
  internal-only ingress, rather than the 2nd gen defaults of 1 vCPU,
  concurrency `80` and `ALLOW_ALL`, so a burst of mail scales out across
  instances instead of sharing one. `setGlobalOptions` can't change these.
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

## Reporting bugs

File bugs in the
[firebase/extensions issue tracker](https://github.com/firebase/extensions/issues/new?template=bug.md)
using the bug template, with `firestore-send-email kit` in the title. Include:

- The kit version (run `npm ls @firebase-function-kits/firestore-send-email` in the
  directory where you installed it), your `firebase-tools` version
  (`firebase --version`) and Node.js version.
- Your configuration from your `.env.<projectId>` (or `.env`) file, with
  secrets and project details redacted.
- Steps to reproduce, the result you expected, and the result you got.
- Logs from the kit's functions in Cloud Logging (with their
  `kit-<instance-id>-` prefix if you deploy instances).

If you migrated from the extension, say so and include the extension version
you migrated from.

## License

Apache-2.0
