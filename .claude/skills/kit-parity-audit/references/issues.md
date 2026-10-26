# Issues

Keep each issue concise, and write it so someone with little context can follow it.

## Gap issue

- **Title:** `fix|docs|decision(<KIT>): kit/extension parity – <the problem in a few words>`
- **Labels:** `kits` plus `type: bug`, `documentation` or `decision`.
- **Body:**

```markdown
**`<KIT>` kit/extension parity.** Priority: **critical|high|medium|low**. <one-line impact>

### Difference

- **Extension:** …
- **Kit:** …

### Reproduced

<live evidence; a small table if useful>

### Code

- Extension: <permalinks>
- Kit: <permalinks>

### Resolution

<concrete fix, referencing related PRs/issues>
```

- **Permalinks:**
  - Kit: pin to the worktree's `kits` SHA.
  - Extension: pin to the same SHA when the extension is in this repo and its code there matches the published version. Otherwise pin to the published version's `buildSourceUri` commit.
- **Decision issues:** in Resolution, list the options. One must be: record it as an accepted difference under "Decisions" in #<TRACKING_ISSUE>.
- **Priority:**
  - critical = user data or work silently lost under normal use;
  - high = the same in a common setup or config;
  - medium = observability, security or ops;
  - low = UX, docs or cosmetic.

## Sub-issues

- Attach each issue: `gh api -X POST repos/firebase/extensions/issues/<TRACKING_ISSUE>/sub_issues -F sub_issue_id=<id>`, where `<id>` is the issue's `.id` (`gh api repos/firebase/extensions/issues/<number> -q .id`), not its number.
- Order them by priority, with bugs before decisions within a tier: `gh api -X PATCH repos/firebase/extensions/issues/<TRACKING_ISSUE>/sub_issues/priority -F sub_issue_id=<id> -F after_id=<previous id>`.
- Make sure the tracking issue has the `kits` label.

## Tracking issue

Title: `` `<KIT>` kit tracking issue ``. Label: `kits`. Body (as in #3249):

```markdown
Tracks parity between the `<KIT>` extension (<version>) and the `@firebase-function-kits/<KIT>` kit.

**How it was tested:** both deployed side by side on a test project with matching configs, then compared on <what this kit does, e.g. emails sent>, events, logs, runtime settings, install and uninstall. Kit tested at `kits` @ <short SHA>, installed three ways: the README's manual setup, `functions:kits:install`, and `ext:migrate`.

Sub-issues are ordered by priority, highest first.

Issues labelled `decision` need a call: change the kit, or record the difference as accepted in the below "Decisions" section.

## Decisions

None yet

## Intentional Differences

- **<short name>:** <one or two lines on a designed difference, e.g. 2nd gen only, kit-prefixed topic names, default region, max instances>
```

When the issue already exists, update its body in place. Keep any Decisions and Intentional Differences already there.
