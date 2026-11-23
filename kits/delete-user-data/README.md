# @firebase-function-kits/delete-user-data

Delete user data across Firestore, RTDB, and Storage on account deletion. This
is the Delete User Data Firebase Extension as an npm package you add to your own
Firebase Functions codebase and deploy.

When a Firebase Auth user is deleted, `clearData` clears the configured
Firestore, Realtime Database and Cloud Storage paths for that user id.
Auto-discovery and a custom search function can find more Firestore paths,
which `handleSearch` and `handleDeletion` delete through two Pub/Sub topics.

> **Pre-release:** this kit has not been released yet. The `latest` version
> on npm is a placeholder with no kit code. Pre-release builds are published
> under the `next` tag and may change between builds, so the commands below
> install `@next`.

Terms used below: a **codebase** is a directory of Cloud Functions source the
Firebase CLI deploys as a unit. A **kit** is this package declared by a `kit`
entry in `firebase.json`. An **instance** is one configured copy of the kit,
with its own `.env.<project-id>` and three functions; the CLI deploys each
instance as a codebase named after its instance id.

## Install

This assumes the latest Firebase CLI is installed and signed in, and that you
run the commands from your Firebase project directory (the one containing
`firebase.json`; `firebase init` creates it), linked to your project
(`firebase use <project-id>`). You also need Firebase Auth on the Blaze plan
and Node.js 24 (22 or later is supported).

**Guided installer.** This creates the codebase under `function-kits/<kit-name>/`,
adds the `kit` entry to `firebase.json`, and prompts for each setting, writing
the answers to `function-kits/<kit-name>/config-<instance-id>/.env.<project-id>`:

```sh
firebase functions:kits:install --package @firebase-function-kits/delete-user-data@next
```

It also asks for `FUNCTION_DEFAULT_REGION`. Enter your Firestore database's
region (see [Region](#region)).

**Your own codebase.** From the `functions/` directory that `firebase init
functions` creates, install the kit plus `firebase-functions` and
`firebase-admin` as direct dependencies, on the major versions the kit uses
(currently 7 and 13). The kit's shrinkwrap nests its own copies, which the CLI
can't see.

```sh
npm install @firebase-function-kits/delete-user-data@next firebase-functions@7 firebase-admin@13
npm install --save-dev typescript@5
```

## Required IAM

Nothing to do by hand. On the first deploy, Firebase CLI 15.23.0 or later asks
you to confirm these roles (`This codebase uses declarative security …
Continue? (y/N)`), then creates a service account for the kit, grants them,
enables the APIs, and attaches the account to every function in the instance.
Don't set a custom runtime service account: it conflicts with that setup.

Without a terminal (for example in CI), there's no one to answer, so confirm
with `--force`. It accepts every prompt, so limit it to one instance:

```sh
firebase deploy --only functions:<instance-id> --force
```

| Role / API                          | Why                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `roles/datastore.owner`             | discover and delete Firestore user data                                 |
| `roles/firebasedatabase.admin`      | delete Realtime Database user data                                      |
| `roles/storage.admin`               | delete Cloud Storage user objects                                       |
| `roles/pubsub.admin`                | publish to and receive from the discovery and deletion topics           |
| `roles/eventarc.eventReceiver`      | receive the Auth and Pub/Sub trigger events                             |
| `roles/run.invoker`                 | let Eventarc invoke the functions                                       |
| `roles/eventarc.publisher`          | publish the kit's [events](#events) (the extension got this implicitly) |
| `firestore.googleapis.com`          | delete Firestore user data                                              |
| `eventarcpublishing.googleapis.com` | publish the kit's events                                                |

## Usage

With your own codebase, this layout keeps the codebase and the instance's
`.env.<project-id>` in the `functions/` directory that `firebase init
functions` creates:

```text
my-project/
  .firebaserc
  firebase.json
  functions/
    package.json         # "main": "lib/index.js", "engines": { "node": "24" }, "scripts": { "build": "tsc" }
    tsconfig.json        # compiles src/ to lib/
    .env.<project-id>
    src/index.ts
```

```ts
// functions/src/index.ts
export {
  clearData, // Auth user deletion trigger
  handleSearch, // auto-discovery
  handleDeletion, // deletes discovered Firestore paths
} from "@firebase-function-kits/delete-user-data";
```

```sh
# functions/.env.<project-id>
FUNCTION_DEFAULT_REGION=us-central1   # your Firestore database's region
FIRESTORE_PATHS=users/{UID}
CLOUD_STORAGE_BUCKET=<project-id>.firebasestorage.app
```

Use `.env.<project-id>` rather than a plain `.env`: both deploy the same way,
but `functions:kits:uninstall` ignores a plain `.env` (see
[Uninstall](#uninstall)). Any setting you leave out is asked for at deploy (see
[Configuration](#configuration)). Importing the package without exporting its
functions deploys nothing: the CLI only deploys what your entry file exports.

## Deploy

In the `functions` entry `firebase init` created, add `kit` and `instances` and
remove `codebase` (a `kit` entry can't have one). This needs Firebase CLI
15.27.0 or later, behind the `kits` experiment; earlier CLIs don't provide the
`FIREBASE_KIT_INSTANCE_ID` variable the kit reads its instance id from:

```json
{
  "functions": [
    {
      "source": "functions",
      "kit": "delete-user-data",
      "instances": { "default": "functions" },
      "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"]
    }
  ]
}
```

`instances` maps each instance id to the directory (relative to
`firebase.json`) holding its `.env.<project-id>`. Function names get a
`kit-<instance-id>-` prefix, so this deploys `kit-default-clearData`,
`kit-default-handleSearch` and `kit-default-handleDeletion`. Commands that take
a codebase take the instance id.

```sh
firebase experiments:enable kits
firebase deploy --only functions                 # all instances
firebase deploy --only functions:<instance-id>   # one instance
```

**Check that it works.** With the `.env.<project-id>` from [Usage](#usage),
create a test user in the Authentication tab of the
[Firebase console](https://console.firebase.google.com/), add a Firestore
document at `users/<that user's UID>`, then delete the user. The document is
gone within a few seconds, and `firebase functions:log --only
kit-<instance-id>-clearData` shows `Successfully removed data for user`. If it
doesn't, look for an error there (see [Failure handling](#failure-handling)).

Only users deleted after the deploy are cleared. There is no backfill, as with
the extension.

## Configuration

Settings go in the instance's `.env.<project-id>` (or `.env`). If a setting
isn't there, the deploy asks you for it and saves your answer to
`.env.<project-id>`. A non-interactive deploy fails instead, so set every
variable.

A setting with **No** under "Can be blank" fails the deploy on a line like
`FIRESTORE_DELETE_MODE=`. Give it a value, or remove the line and answer the
prompt.

| Field                 | Env var                        | Can be blank | Default                | Description                                                                 |
| --------------------- | ------------------------------ | ------------ | ---------------------- | --------------------------------------------------------------------------- |
| (none)                | `FUNCTION_DEFAULT_REGION`      | Yes          | `us-central1`          | Region the functions deploy to ([Region](#region))                          |
| `firestorePaths`      | `FIRESTORE_PATHS`              | Yes          | (empty)                | Comma-separated Firestore paths with `{UID}`                                |
| `firestoreDatabaseId` | `FIRESTORE_DATABASE_ID`        | No           | `(default)`            | Firestore database id                                                       |
| `firestoreDeleteMode` | `FIRESTORE_DELETE_MODE`        | No           | `shallow`              | `shallow` or `recursive`                                                    |
| `rtdbInstance`        | `SELECTED_DATABASE_INSTANCE`   | Yes          | (empty)                | RTDB instance id; without it `rtdbPaths` are skipped                        |
| `rtdbLocation`        | `SELECTED_DATABASE_LOCATION`   | Yes          | `us-central1`          | `us-central1`, `europe-west1` or `asia-southeast1`                          |
| `rtdbPaths`           | `RTDB_PATHS`                   | Yes          | (empty)                | Comma-separated RTDB paths with `{UID}`                                     |
| `storageBucket`       | `CLOUD_STORAGE_BUCKET`         | No           | default Storage bucket | Bucket to clear                                                             |
| `storagePaths`        | `STORAGE_PATHS`                | Yes          | (empty)                | Comma-separated Storage paths with `{UID}`; `{DEFAULT}` for the default bucket |
| `enableAutoDiscovery` | `ENABLE_AUTO_DISCOVERY`        | No           | `no`                   | Auto-discover user-linked docs (`yes` or `no`)                              |
| `searchDepth`         | `AUTO_DISCOVERY_SEARCH_DEPTH`  | No           | `3`                    | Discovery depth                                                             |
| `searchFields`        | `AUTO_DISCOVERY_SEARCH_FIELDS` | Yes          | `id,uid,userId`        | Fields treated as user ids; empty falls back to the default                 |
| `searchFunction`      | `SEARCH_FUNCTION`              | Yes          | (empty)                | URL of a custom search function that returns paths to delete                |
| (none)                | `EVENTARC_CHANNEL`             | Yes          | (unset)                | Channel for the kit's [events](#events); unset disables                     |
| (none)                | `EXT_SELECTED_EVENTS`          | Yes          | (unset)                | Event types to publish; unset or blank publishes none                       |

The CLI doesn't check values already in the file, so the kit checks them when
the deploy loads it, as the extension did at install. One error names every
bad setting, along with any blank setting that can't be blank. It fails if:

- `FIRESTORE_DELETE_MODE`, `ENABLE_AUTO_DISCOVERY` or
  `SELECTED_DATABASE_LOCATION` isn't one of the values above or their labels.
  Values are case sensitive.
- `SELECTED_DATABASE_INSTANCE` is a URL rather than an instance id, or
  `CLOUD_STORAGE_BUCKET` has `gs://` or capital letters.
- `EVENTARC_CHANNEL` or `EXT_SELECTED_EVENTS` is invalid (see [Events](#events)).

The emulator runs the same check, so a bad value stops that instance's
functions from loading there.

An option's label (such as `Recursive`) is accepted because the extension's
installer accepted it, but it runs as it did in the extension: `Recursive`
deletes shallowly, `Yes` leaves auto-discovery off, and a location label
(`United States`, `Belgium`, `Singapore`) gives a database URL that doesn't
exist. Use the values instead.

The instance id is not a setting: the CLI provides it as
`FIREBASE_KIT_INSTANCE_ID`, set to the instance's key in `instances`.
`FIREBASE_` is a reserved prefix in `.env` files, so it can't be overridden.

## Multiple instances

Add one entry per instance, each with its own config directory and
`.env.<project-id>`. Instance ids must be unique across the project. In a
project set up by `firebase functions:kits:install`, add them to the entry it
wrote.

```json
"instances": { "app": "instances/app", "admin": "instances/admin" }
```

Each instance's `.env.<project-id>` must be complete, including
`FUNCTION_DEFAULT_REGION`. Its functions and Pub/Sub topics are prefixed with
`kit-<instance-id>-`, so instances can't collide.

### Uninstall

```sh
firebase functions:kits:uninstall --instance <instance-id>
```

This deletes the instance's functions, their triggers and Pub/Sub
subscriptions, and the service account the CLI created for them. It then
removes the instance from `firebase.json` and deletes its `.env.<project-id>`.
If it is the kit's only instance, it removes the whole kit entry, leaving
`"functions": []`. Despite what the prompt says, it doesn't delete your
functions source when the kit is exported from your own codebase.

The command asks you to confirm, twice for the kit's only instance. In a
non-interactive shell (CI, a script, or when the CLI detects an AI agent), add
`--force`. Without it nothing is deleted: the command exits 0 for the kit's
only instance, and fails with `Command aborted.` otherwise.

- **Plain `.env`.** The command only deletes what is deployed to a project with
  a `.env.<project-id>` in the config directory. With only a plain `.env`, it
  removes the instance from `firebase.json` and exits without an error, but the
  functions keep running and keep deleting user data. Rename the file first. If
  you already uninstalled, put the instance (or the whole kit entry) back in
  `firebase.json`, rename the file, and run the command again.
- **Several projects.** Give each its own `.env.<project-id>` (copy a shared
  `.env`, don't rename it) and run the command once per project with
  `--project <project-id>`. The instance stays in `firebase.json` until the
  last project's file is gone.
- **`.env.local`.** Move it out of the config directory first. Next to a plain
  `.env` it makes the command fail with "contains no .env file for current
  project". Next to `.env.<project-id>` the command deletes the functions but
  leaves the instance in `firebase.json`, and running it again fails with that
  error.

Like the extension's uninstall, the kit's keeps the topics
`kit-<instance-id>-discovery` and `kit-<instance-id>-deletion`; delete them
with `gcloud pubsub topics delete <topic>`. Unlike the extension, it also keeps
the deleted service account's seven project roles. They no longer grant
access, and show in your IAM policy as
`deleted:serviceAccount:firebase-fn-<n>@<project-id>.iam.gserviceaccount.com?uid=<n>`.
Note the `firebase-fn-<n>` account the uninstall prints ("The following managed
service accounts will also be deleted"), since other kits' deleted accounts
look the same. List its roles with:

```sh
gcloud projects get-iam-policy <project-id> --flatten="bindings[].members" --filter="bindings.members:deleted:serviceAccount:firebase-fn-<n>@" --format="value(bindings.role,bindings.members)"
```

and remove each with
`gcloud projects remove-iam-policy-binding <project-id> --member='<member>' --role=<role> --condition=None`.
Keep the quotes: the `?` in the member makes some shells, such as zsh, fail
with "no matches found".

## Events

With both settings below in `.env.<project-id>`, the functions publish deletion
events under `firebase.extensions.delete-user-data.v1.*` (`firestore`,
`database` and `storage`), with the same types and payloads as the extension.

| Env var               | Description                                                                                                            |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `EVENTARC_CHANNEL`    | Full channel name, e.g. `projects/<project-id>/locations/us-central1/channels/firebase`                                |
| `EXT_SELECTED_EVENTS` | Comma-separated types to publish, e.g. `firebase.extensions.delete-user-data.v1.firestore,firebase.extensions.delete-user-data.v1.storage` |

Only the listed types are published. List them exactly as shown, with no
spaces; empty entries are skipped. The deploy fails if an entry has spaces or
different case, isn't one of the three types, or is listed twice, or if types
are listed but `EVENTARC_CHANNEL` is unset, as the extension's install did. It
also fails if `EVENTARC_CHANNEL` isn't a full channel name, is in another
project, or is outside `us-central1`, `us-west1`, `europe-west4` and
`asia-northeast1`, the locations the extension supported.

The channel must already exist: deploying the kit doesn't create it, and
publishing to a missing channel logs a warning without failing the function.
The events' `source` differs from the extension's; see
[Differences](#differences-from-the-delete-user-data-extension).

## Failure handling

The functions never retry, and 2nd gen records every event as HTTP 200, so
alert on the functions' logs or `execution_count` rather than request status.

1. **A configured path fails to delete.** `clearData` logs it at ERROR
   (`Error when deleting: '<path>' from Cloud Firestore`, `... from the Realtime
   Database`, or `Error deleting: '<path>' from Cloud Storage`) and carries on
   with the other paths. The run still ends with `Successfully removed data for
   user`.
2. **The custom search function returns an error status.** `clearData` logs
   `Call to custom hook function threw an error` at ERROR, with the response
   body, and deletes nothing from it.
3. **A discovered document no longer matches.** `handleDeletion` skips any
   document whose search field no longer holds the user id, and logs a warning
   with the count.
4. **Anything else throws** (for example auto-discovery or a Pub/Sub publish
   fails, or a message can't be parsed). The run fails, logs its stack trace
   once at ERROR, and the event isn't redelivered. On `clearData`, the custom
   search function then doesn't run.
5. **A timeout or out-of-memory kill** stops the function before it can log an
   error. An out-of-memory kill logs one ERROR per crashed instance (`Memory
   limit of 256 MiB exceeded…`). A timeout is never logged at ERROR: Cloud Run
   logs it at INFO as `The request has been terminated because it has reached
   the maximum request timeout.` The timed-out run keeps going in the
   background, so its INFO logs can still appear minutes later.

To be told about failures, create a
[metric alert](https://cloud.google.com/monitoring/alerts/using-alerting-ui) on
`cloudfunctions.googleapis.com/function/execution_count` with
`metric.labels.status!="ok"`, which also counts out-of-memory crashes, or a
[log-based alert](https://cloud.google.com/logging/docs/alerting/log-based-alerts)
such as:

```text
resource.type="cloud_run_revision"
resource.labels.service_name=~"^kit-<instance-id>-"
(severity>=ERROR OR textPayload:"maximum request timeout")
```

The Auth user is already gone, so there is no event to replay. Delete what's
left by hand, using the paths in the ERROR logs.

## Migrating from the extension

Run the migration from your Firebase project directory, naming the extension
instance to replace (without `--ext-instance`, it asks you to pick one). While
the kit is pre-release, pass the `next` build with `--package`:

```sh
firebase ext:migrate --ext-instance <instance-id> \
  --package @firebase-function-kits/delete-user-data@next
```

It exports the instance's configuration, sets `FUNCTION_DEFAULT_REGION` to the
region the extension's functions ran in, and asks for the kit name and instance
id. It then deploys the kit, asking you to confirm the
[roles](#required-iam), and offers to uninstall the extension. Keep the
extension until the kit clears a test user (see [Check that it works](#deploy)),
then uninstall it:

```sh
firebase ext:uninstall <instance-id>
```

Running both at once is safe: each user deletion is handled twice, and the
second pass finds nothing left to delete. The extension's `ext-` Pub/Sub topics
aren't reused and can be deleted afterwards.

To set up the kit yourself instead, write the instance's configuration to an
existing kit instance's config directory, then deploy:

```sh
firebase ext:export --mode functions --instance <instance-id> --kit-instance <kit-instance-id>
```

## Differences from the Delete User Data extension

Every setting keeps its name, type, default and meaning, so an existing
configuration carries over. Path syntax, the delete modes, auto-discovery,
the `SEARCH_FUNCTION` contract, the RTDB gate (paths are skipped with
`Realtime Database paths are not configured, skipping` when no database URL
can be derived), and event types and payloads are unchanged.

- **Region.** The extension's install-time location is gone. See
  [Region](#region).
- **The instance id comes from `firebase.json`.** The CLI provides each
  instance's key in `instances` as `FIREBASE_KIT_INSTANCE_ID`. There is no
  `INSTANCE_ID` setting.
- **Pub/Sub topics** are `kit-<instance-id>-discovery` and
  `kit-<instance-id>-deletion`, where the extension used an `ext-` prefix. The
  CLI creates them on deploy, and the names can't be changed.
- **All functions are 2nd gen.** `clearData` listens on
  `google.firebase.auth.user.v2.deleted` instead of the 1st gen `user.delete`
  trigger; the event type is still beta in `firebase-functions`. Like the
  extension, each function handles one event per instance with the 1st gen CPU
  for its memory, up to 3000 instances, with internal-only ingress. During a
  burst, Cloud Run may log `no available instance` while it scales; Eventarc
  redelivers those events.
- **Max instances.** Change it with `setGlobalOptions({ maxInstances })` from
  `firebase-functions/v2`, called before the kit loads; it applies to every
  function in the codebase. The `ext:migrate` template does this, and the
  `firebase init functions` template sets `maxInstances: 10`, so check your
  entry file. `setGlobalOptions` can't change concurrency, CPU or ingress, so
  the ingress `ext:migrate` carries over doesn't apply.
- **Failed runs show as HTTP 200** in Cloud Run's request log, where 1st gen
  logged `status: 'error'`. See [Failure handling](#failure-handling).
- **Events need an existing channel.** The extension created it at install;
  the kit doesn't.
- **Event source.** The extension's events had the `source`
  `//firebaseextensions.googleapis.com/extensions/projects/<project-id>/instances/<instance-id>`.
  The kit's have
  `projects/<project-id>/locations/<region>/services/kit-<instance-id>-<function>`,
  which differs between the three functions. Filter triggers on the event
  `type` instead.
- **A failed event publish** only logs a warning and deletion carries on. The
  extension failed the function, so in `clearData` auto-discovery and
  `SEARCH_FUNCTION` were skipped, leaving their data behind.

### Region

The functions deploy to `FUNCTION_DEFAULT_REGION` in each instance's
`.env.<project-id>`, defaulting to `us-central1`, so instances can deploy to
different regions. `functions:kits:install` asks for it and `ext:migrate`
writes the region the extension ran in.

Keep the functions in your Firestore database's region (for a `nam5` database,
`us-central1`), so user data isn't read and deleted from another region. The
kit sets the region on each function, so `setGlobalOptions({ region })`
doesn't move them. Changing region deletes and recreates the functions.

## API surface

- **Main entry** (`@firebase-function-kits/delete-user-data`): `clearData`,
  `handleSearch`, `handleDeletion` and everything from the library entry. It
  reads environment variables when the module loads, so use it from a Firebase
  deploy, the emulator or the runtime.
- **Library entry** (`@firebase-function-kits/delete-user-data/lib`): the
  handlers (`handleClear`, `handleSearch`, `handleDeletion`), path helpers,
  search and batch-deletion utilities, and the config types
  (`DeleteUserDataConfig`, `resolveDeleteUserDataConfig`) for registering
  triggers yourself.

## Reporting bugs

File bugs in the
[firebase/extensions issue tracker](https://github.com/firebase/extensions/issues/new?template=bug.md)
using the bug template, with `delete-user-data kit` in the title. Include:

- The kit version (run `npm ls @firebase-function-kits/delete-user-data` in
  your `functions/` or `function-kits/<kit-name>/` directory), your
  `firebase-tools` version (`firebase --version`) and Node.js version.
- Your configuration, with secrets and project details redacted. This is
  `functions/.env.<project-id>`, or
  `function-kits/<kit-name>/config-<instance-id>/.env.<project-id>` if you used
  the guided installer.
- Steps to reproduce, the result you expected, and the result you got.
- Logs from the `clearData`, `handleSearch` and `handleDeletion` functions in
  Cloud Logging (with their `kit-<instance-id>-` prefix).

If you migrated from the extension, say so and include the extension version
you migrated from.

## License

Apache-2.0
