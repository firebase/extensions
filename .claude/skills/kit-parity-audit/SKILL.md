---
name: kit-parity-audit
description: Audit a Firebase Function Kit against its Firebase Extension. Finds every behavioural difference, proves each one in a deployed test project, and files one GitHub issue per gap under the kit's tracking issue.
argument-hint: <kit> [tracking-issue]
disable-model-invocation: true
---

# Kit/extension parity audit

Arguments: `$ARGUMENTS` (the kit name, a directory under `kits/`, optionally followed by its tracking issue number).

Find every behavioural difference between the `<KIT>` Firebase Extension and its kit (`@firebase-function-kits/<KIT>`). Prove each one in a deployed environment, then file one GitHub issue per gap under the kit's tracking issue in `firebase/extensions`.

Read [references/gotchas.md](references/gotchas.md) before deploying anything, and [references/issues.md](references/issues.md) before drafting issues.

## 1. Before you start

Settle everything below before you create a single resource. Look things up first, then ask the rest in one round (AskUserQuestion), giving your recommendation for each. Keep asking follow-ups until nothing is ambiguous.

**Look up:**

- The kit: `kits/<KIT>` exists. Read its README, `package.json` and params.
- The extension: GET `firebaseextensions.googleapis.com/v1beta/publishers/<publisher>/extensions/<KIT>` for `ref`, `latestVersion` and `repoUri`, then `…/versions/<latestVersion>` for `buildSourceUri` (the published commit) and `extensionRoot`. The publisher is `firebase` when `<KIT>/extension.yaml` is in this repo, otherwise `googlecloud` (source in GoogleCloudPlatform/firebase-extensions).
- The tracking issue, if not given: search for the title "`<KIT>` kit tracking issue".
- Every param on both sides. Note which are required with no default, which are secrets, and which need an outside account or resource (an SMTP server, an API key, a BigQuery dataset, …).

**Ask:**

1. **Tracking issue.** Confirm the one you found. If there is none, offer to create it from the template in `references/issues.md`.
2. **Project and prefix.** The Firebase project to deploy to, and a unique prefix for every resource you create (e.g. `kpar-`). Check nothing in the project already uses the prefix.
3. **Param values and secrets.** Does the user have explicit values for any param? List the values you'll use otherwise, and any outside test resources you plan to set up (e.g. an Ethereal SMTP account). Never ask for a secret value in chat: have the user create it in Secret Manager, or put it in a file outside the repo and give you the path.
4. **Region.** Default `us-central1` for both sides.
5. **Scope and cost limits.** Anything to skip (load tests, an install path, a feature), and limits on paid APIs (Translate, Speech, Vertex AI, BigQuery, …).
6. **Project-level changes.** List the ones you expect to need (e.g. removing IAM roles to force failures, enabling an API or Identity Platform, creating a web app, API key, secret or Eventarc channel), and ask which are approved.
7. **Cleanup.** Delete everything at the end, or leave it deployed.

Never make a project-level change without approval. If a change is blocked (denied, a permission error, an auto-mode refusal), stop and say so. Don't work around it.

## 2. Setup

- Work in an isolated worktree: `git fetch origin kits && git worktree add --detach .claude/worktrees/<KIT>-parity origin/kits`. Record its SHA. Never commit or push.
- Keep test codebases, `.env` files, recorder functions and scripts in a `<PREFIX>` folder in your scratchpad (or a temp dir outside the repo).
- Compare the **published** extension (latest Hub version) against the kit **built from the worktree SHA**:
  - run `pnpm build` in `kits/<KIT>`, `npm pack` into the codebase's `vendor/`, and depend on `file:vendor/<tarball>.tgz`;
  - also diff the build against the npm `@next` build and note any drift.
- Install the kit the three ways a user would, and test each:
  1. the README's manual setup (`kit` stanza in `firebase.json`);
  2. `firebase functions:kits:install`;
  3. `firebase ext:migrate`. It only accepts npm names, so swap the dependency to the tarball afterwards.

## 3. Compare

- Deploy matching extension and kit instances with identical config. Give each instance its own Firestore DB, bucket and RTDB prefix: triggers often fire project-wide, and other people's old instances exist.
- Cover every feature and param, error paths, invalid and blank config, events (type, payload, source, filtering, publish failure), and logs and severity.
- Compare runtime settings via the Cloud Functions API: region, memory, CPU, concurrency, max instances, ingress, retry, Node runtime, service account and IAM roles.
- Test load (bursts, large fan-out, long jobs near the timeout), install and migrate UX, and uninstall leftovers.
- Use capture subscriptions on Pub/Sub topics, a recorder function for Eventarc events, and Cloud Logging queries.
- Re-run anything surprising. Isolate the cause (e.g. change only the region) and prove a proposed fix works before recommending it.

**Don't stop after the first sweep.** Keep a coverage checklist of every function, param, event type, log line, runtime setting, install path and uninstall step, on both sides. Then:

- A **pass** is a full sweep of that checklist and everything above. A **clean pass** finds nothing new.
- Keep going until you have **3 clean passes in a row**. Any new finding resets the count to 0.
- Rotate through these angles, so the three clean passes cover all of them:
  1. **Code:** diff the extension and kit source file by file, including `extension.yaml` against the kit's params and function options.
  2. **Config:** every param with valid, invalid, blank and edge values, on all three install paths.
  3. **Runtime:** the deployed functions, events, logs, load and uninstall.
- Run at least one of the clean passes in a fresh subagent that gets the checklist but not your findings, so it doesn't share your blind spots.
- Log each pass: its angle, what it covered and what it found.

## 4. Before filing

- Verify every claim live where possible. Say plainly what is code-only.
- Check that every permalink's line range is correct.
- Search existing issues and PRs. Link related ones, and don't file duplicates.
- Read #2974 (the parity ledger) for differences already accepted, but **never mention #2974 in any issue**.
- These aren't parity gaps, so report them to the user only (no issue):
  - extension-only bugs;
  - behaviour that is the same on both sides.

## 5. Report, then file

1. Report the gaps to the user, ranked by priority and grouped as bug, docs or decision. For each, give the draft title, priority and one line of evidence. List separately: extension-only bugs, same-on-both-sides findings, intentional differences for the tracking issue, anything code-only, and the pass log.
2. Wait for the user's go-ahead. They may drop, merge or reword issues.
3. File all approved issues in one go, attach them as sub-issues and order them (see `references/issues.md`).
4. Update the tracking issue body from the template. Merge into what's there: never drop existing Decisions or Intentional Differences.

## 6. Wrap up

- Clean up if approved (see uninstall notes in `references/gotchas.md`).
- List every resource you left deployed, and every project-level change you made and whether you reverted it.
- Offer to add anything new you learned to `references/gotchas.md`. Show the additions, edit only on a yes, and never commit.
