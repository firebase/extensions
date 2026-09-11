# Firebase Function Kits

This directory contains the source for Firebase Function Kits. A kit is a
Firebase Extension repackaged as an npm package that you add to your own
Firebase Functions codebase and deploy into your own project.

While an extension is installed as a managed instance configured through the
Firebase console or CLI, a kit is code you own: you install the package, export
the functions you want from your functions entry file, configure it with a
`.env`, and deploy with `firebase deploy`. There is no hosted version, so the
functions run in your project, under your service account, on your deployment
schedule. That also means you can read the source, fork it, or import the
package's `./lib` entry point and register the triggers yourself.

Each directory here contains the source code for a kit and a README explaining
how it works, including the roles it needs, the settings it reads, and the
functions it exports.

## Available kits

| Kit | Description |
|---|---|
| [`bigquery-firestore-export`](bigquery-firestore-export) | Reverse-sync rows from BigQuery into Firestore |
| [`delete-user-data`](delete-user-data) | Delete user data across Firestore, RTDB, and Storage on account deletion |
| [`firestore-bigquery-export`](firestore-bigquery-export) | Stream a Cloud Firestore collection to BigQuery |
| [`firestore-bundle-builder`](firestore-bundle-builder) | Build and serve Firestore data bundles |
| [`firestore-counter`](firestore-counter) | Distributed, sharded counters for Firestore |
| [`firestore-genai-chatbot`](firestore-genai-chatbot) | Conversational GenAI chatbot backed by Firestore |
| [`firestore-incremental-capture`](firestore-incremental-capture) | Incremental point-in-time capture of Firestore changes |
| [`firestore-send-email`](firestore-send-email) | Send emails based on documents written to Firestore |
| [`firestore-translate-text`](firestore-translate-text) | Translate text written to a Firestore collection |
| [`firestore-vector-search`](firestore-vector-search) | Vector similarity search over a Firestore collection |
| [`rtdb-limit-child-nodes`](rtdb-limit-child-nodes) | Limit the number of child nodes under a Realtime Database path |
| [`speech-to-text`](speech-to-text) | Transcribe Cloud Storage audio with Cloud Speech-to-Text |
| [`storage-resize-images`](storage-resize-images) | Resize images uploaded to Cloud Storage |

## Using a kit

Kits need Firebase CLI 15.27.0 or later with the `kits` experiment enabled.
The CLI provides each instance its id as the `FIREBASE_KIT_INSTANCE_ID`
environment variable; earlier versions do not set it, and kits that use the
instance id will not deploy or run without it.

```sh
firebase experiments:enable kits
```

Install the package into your functions codebase, export the functions you want
from your entry file, and add a `kit` stanza to `firebase.json` naming the
instances to deploy:

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

Each instance ID maps to the directory holding that instance's `.env`, and the
CLI prefixes every function name with `kit-<instance-id>-`, so one kit can run
several independently configured instances side by side. See each kit's README
for its exports, its settings, and the roles the CLI grants on deploy.

## Migrating from an extension

A kit ports the extension's behavior, but it is not a drop-in replacement for
an installed instance. Deployment still handles the platform setup for you: Firebase
CLI 15.23.0 or later creates the runtime service account, grants it the roles
the kit needs, enables the required APIs, and connects any secrets. What moves
to you is the configuration itself, so check the kit's README against your
installed instance's settings before deploying, rather than copying the `.env`
across unchanged.

### Differences that apply to every kit

Each kit's README has a "Differences" section covering the behaviour specific
to that kit. The four below come from the platform rather than from any one
kit, and are accepted: there is no kit equivalent to restore.

**Resource names use a `kit-` prefix.** The CLI names every function, task
queue and Pub/Sub topic `kit-<instance id>-<name>`, where an extension
instance used `ext-<instance id>-<name>`. No resources created by an extension
instance are reused, so an installed extension keeps running on its own
resources until you uninstall it, and its old resources can be deleted once
you have migrated.

**There is no billing declaration.** Extensions set `billingRequired: true` in
`extension.yaml`, which is why the console refused to install them on a Spark
plan project. There is no kit equivalent, but the requirement itself is
unchanged: kits deploy 2nd gen functions, so the project still needs the Blaze
plan. You find out at `firebase deploy` rather than up front.

**There is no deploy-time status surface.** Extensions reported install,
update and backfill progress by calling
`getExtensions().runtime().setProcessingState(...)`, and the Firebase console
showed that state on the instance. Kits have no equivalent, so the outcome of
a post-deploy task, including a failure, is only visible in that function's
logs. This affects the lifecycle and backfill tasks in
`bigquery-firestore-export`, `firestore-bigquery-export`,
`firestore-incremental-capture` and `firestore-vector-search`.

**Settings are checked at deploy time, not at install.** An extension
validated your values in the install prompt using `extension.yaml`
(`required`, `validationRegex`), and one extension also threw at startup when
an environment variable was missing. Kits declare settings with
`firebase-functions/params`, so the CLI still prompts for a required setting
that has no value and still refuses to deploy while a bound secret does not
exist. What is gone is the per-value checking: a malformed but present value
now deploys and fails at runtime. Each kit's README lists the checks its
extension used to run.

Extensions themselves are unaffected and remain available. To learn more about
Firebase Extensions, including how to install them, visit the
[Firebase documentation](https://firebase.google.com/docs/extensions).
