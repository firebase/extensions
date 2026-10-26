# Gotchas

Lessons from earlier parity audits (delete-user-data, storage-resize-images, firestore-send-email, firestore-bigquery-export). `<PROJECT>` is the test project.

## Auth and APIs

- `gcloud` often needs re-auth. Use REST with `$(gcloud auth application-default print-access-token)` and the header `x-goog-user-project: <PROJECT>`. ADC also works for Node clients (BigQuery, Firestore, Logging, Secret Manager).
- Enqueuing to a task queue from a local script needs `admin.initializeApp({ serviceAccountId: "<project-number>-compute@developer.gserviceaccount.com" })`, otherwise you get "Failed to determine service account".
- Find extension RCs with GET `firebaseextensions.googleapis.com/v1beta/publishers/<publisher>/extensions/<ext>/versions?pageSize=99&showPrereleases=true` (`pageSize` must be under 100).

## Firebase CLI

- firebase-tools forces non-interactive mode when it detects an AI agent. Add `--interactive` and run under `script -qfec "<command>" /dev/null` to answer prompts.

## Extensions

- Install the **published** version. Installing from local source uploads to `firebase-ext-eap-uploads` and fails with 403 for most accounts (shows up as "Unable to parse JSON … <?xml").
- `ext:install` has no `--params`. Write the manifest yourself: `firebase.json` `{"extensions": {"<id>": "<publisher>/<ext>@<version>"}}` plus `extensions/<id>.env`, then run `firebase deploy --only extensions --non-interactive`.
  - Never add `--force` to that command: it deletes other instances. Without it, other instances are kept.
  - `--only extensions:<id>` isn't supported.
  - A reconfigure takes about 5.5 minutes.
  - To turn on events, put `EVENTARC_CHANNEL` and `ALLOWED_EVENT_TYPES` in the `.env`.
- Check install-time validation with `POST firebaseextensions.googleapis.com/v1beta/projects/<PROJECT>/instances?validateOnly=true&instanceId=<id>`. `--dry-run` does **not** validate params.
- Select params also accept the option _label_ (e.g. `Recursive`, `Yes`). The platform stores the label as-is, so runtime checks like `=== "recursive"` then fail. Test exact strings with `validateOnly` before claiming the extension rejects a value.
- Blank values: the platform replaces a blank optional param with its declared default, gives blank required params their yaml default, and drops other blank values from the env.
- Uninstall: `ext:uninstall` only edits the manifest and leaves the instance running. Send DELETE to `firebaseextensions.googleapis.com/v1beta/projects/<PROJECT>/instances/<id>`. `ext:uninstall --immediate` deletes the instance and then errors about `firebase.json`; ignore that error.
- To test _unreleased_ extension code, deploy its `functions/` as a plain codebase instead:
  - use a wrapper that sets `process.env.EXT_INSTANCE_ID` and exports `exports.ext.<a>.<b>…` (the CLI maps hyphens in function IDs to nested exports);
  - add a `.env` with the params, and `"runtime": "nodejs22"` in `firebase.json` if `package.json` has no `engines`;
  - run lifecycle `initialize()` by hand;
  - re-apply task-queue retry and rate settings from `extension.yaml` after every deploy, because plain deploys reset them.
- After each deploy or reconfigure, lifecycle tasks get 403 twice and succeed on the third try (~3 min). This is IAM propagation, not a bug.

## Kits

- `npm pack` the built kit into the codebase's `vendor/` and depend on `file:vendor/<tarball>.tgz`. A path outside the codebase fails the Cloud Build.
- Non-interactive deploys need every param in `.env`, including ones with defaults.
- The first deploy needs `--force` (it creates the managed service account). Deploy only your instances with `--only functions:<instanceId>`.
- A failed first create leaves an HTTPS stub function that blocks the next deploy. Delete it first.
- `.env` values skip all CLI validation (select options, regex, int). Only _missing_ params are validated (at the prompt), so test bad values with a real deploy, not `--dry-run`.
- With no region set, global triggers (Pub/Sub, Auth) deploy to `us-east1` (`DEFAULT_GLOBAL_TRIGGER_REGION`).
- Secrets are per instance: `kit-<instanceId>-<NAME>`. `firebase functions:secrets:set kit-…` is rejected ("reserved prefix"), even though the deploy error suggests it. Create the secret with the Secret Manager API instead, and only with approval.
- `ext:migrate` only accepts npm names (e.g. `@next`). Afterwards, swap the generated `function-kits/<kit>/source` dependency to `file:vendor/<tarball>.tgz`.
- `functions:kits:uninstall --instance <id>` only deletes resources when the instance dir has `.env.<projectId>`. With a plain `.env` it exits 0 and leaves everything running.

## Observability

- 2nd gen request logs show HTTP 200 even when the function threw or timed out. Look for "Memory limit" and "request failed because" lines instead.
- 2nd gen trigger logs are under `resource.labels.service_name`; task-queue functions are under `function_name`. The Cloud Run `requests` log shows up as "undefined" messages.
- To see fan-out messages, attach pull subscriptions to the `ext-<id>-*` and `kit-<id>-*` topics.

## Forcing failures and load

- Publishing to a nonexistent Eventarc channel succeeds silently, so it can't simulate a publish failure. Removing `eventarc.publisher` from the service account does, but it's a project-level change: ask first.
- Bursts expose 2nd gen concurrency-80 out-of-memory errors and timeouts. Bursts of 40–80 large inputs have been enough.
- Admin `deleteUsers` (bulk) fires neither 1st nor 2nd gen Auth delete triggers. Delete users one at a time.
- The default bucket `<PROJECT>.firebasestorage.app` may not exist. Check before relying on it.
- Check what the project already has (Identity Platform, web apps, API keys, anonymous auth) before asking to create it.

## Per-kit notes

- **firestore-send-email:** Ethereal (`nodemailer.createTestAccount()` plus IMAP via `imapflow`) works well as an SMTP sink.
- **storage-resize-images:** give each instance its own bucket, and give test files unique basenames (outputs collide on basename).
- **firestore-bigquery-export:**
  - The extension runs change-tracker with `skipInit: true`, so missing columns are only added by the setup lifecycle task.
  - To force insert failures, pre-create `<TABLE_ID>_raw_changelog` with columns missing, then reconfigure `TABLE_ID` to it. Missing `data` gives a terminal failure (backup doc plus Cloud Task retries). Missing `old_data` or `document_id` gives strip-and-retry WARNINGs.
  - These don't work: renaming a column (streaming keeps writing to it for 6+ minutes), renaming the table ("has streaming data"), or deleting the table (inserts keep "succeeding" and losing rows for about 4 minutes).
