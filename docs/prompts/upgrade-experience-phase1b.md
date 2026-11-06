Implement the "1.1 upgrade experience" in LoreFountain (phase 1b, after shot maps phase 1 and before 1.1.0 is released). Continue on `feature/shot-maps`, or on a branch cut from it if I say so.

**Ground rule: defer to the Fountain spec.** LoreFountain may extend Fountain but never change how standard Fountain parses. Every automatic fix here applies exactly one standard Fountain correction. Nothing edits a script without the user approving the change first.

## Step 0: Read, then report contradictions before coding

Read: CONTRIBUTING.md, docs/DECISIONS.md, src/commands/checkFileUpdates.ts, src/config/readmeVersions.ts, src/config/agentFileVersions.ts, the extension's activation entry point, the diagnostics provider that surfaces validator codes live, the `lorefountain.gettingStarted` walkthrough in package.json, and CHANGELOG.md.

Then tell me, before writing code:
- which `globalState` keys 1.0.0 already writes (telemetry opt-in, license state, anything else), since they're how we tell an upgrade from a fresh install;
- whether a code-action provider already exists to extend;
- anything else that contradicts this spec.

Wait for my answer.

## Why

Phase 1 adds shot maps, `PAUSE:` and seven validator codes. Existing projects, ORUN included, predate them and will light up with new warnings, especially `orphaned-parenthetical`. Users need to learn what's new once, and to fix their scripts to standard Fountain without hand-editing hundreds of lines.

LoreFountain already refreshes generated docs through `checkFileUpdates`. This phase adds the other three layers.

## 0. Problems-panel diagnostics (prerequisite)

LoreFountain has no VS Code diagnostics today: every warning and note goes to the Output channel and `validate.js` (ADR-0038). Quick fixes attach to diagnostics, and "Show Problems" needs them, so add a script diagnostics layer first:
- A `DiagnosticCollection` for `.fountain` scripts, fed from the same per-script issues the index already produces (each carries a 0-based `line`). Warnings map to `Warning`, notes to `Information`. Script-level only: manifest-level issues stay in the Output channel.
- Refreshed whenever the index reports a script's issues (on save and on a full rebuild), and cleared when a script is deleted or renamed.
- The Output channel keeps its existing lines; the diagnostics are an addition, not a replacement.

## 1. What's-new notice (per user, once per release)

- On activation, compare the extension version with a last-seen version in `globalState`. On a **minor or major** bump, show one non-modal notification, e.g. "LoreFountain 1.1: shot maps and scene pauses." with **What's New** and **Dismiss** buttons. Patch bumps show nothing.
- **What's New** opens the release notes. Use a walkthrough step added to `lorefountain.gettingStarted` if that fits, otherwise the CHANGELOG section for the release. Report which you chose and why.
- **Fresh install:** no notice. Record the version silently; the walkthrough is the onboarding.
- **Upgrade from 1.0.0:** 1.0.0 never stored a version, so treat the presence of any 1.0-era `globalState` key (from Step 0) as proof of an earlier install. If none exists, treat it as a fresh install. Never guess the other way.
- Setting: `lorefountain.notifications.whatsNew` (boolean, default true).
- Update the last-seen version after the notice is shown, whether or not the user clicks.

## 2. Quick fixes (per diagnostic)

Code actions on the phase 1 diagnostics. Each applies one standard Fountain correction:
- `orphaned-parenthetical`:
  - **Join to the previous speech:** remove the blank line(s) between the parenthetical and the dialogue above it. Offer this only when the nearest non-blank content above is a dialogue block, with no intervening `SHOT:` or other prefix line.
  - **Re-cue the speaker:** insert `SPEAKER (CONT'D)` above the parenthetical, keeping the original speaker's cue-line extensions. Offer this when a `SHOT:` or other prefix line separates it from that speaker's last dialogue block. The speaker is the character of the nearest preceding dialogue block in the same scene. If there is none, offer no fix.
- `bare-pause-line`: replace the line with `PAUSE:`.
- Nothing for codes without a single unambiguous standard fix (e.g. `ambiguous-location`, `unmapped-shot-tag`).

## 3. Fix all in project

- Command: **LoreFountain: Fix All Script Formatting Issues**. It collects every quick fix above across the project's scripts into one `WorkspaceEdit` and applies it with VS Code's refactor preview (`needsConfirmation`), so the user reviews and can untick individual changes before anything is written.
- Where both `orphaned-parenthetical` fixes are possible, use the rule above: join if no prefix line intervenes, otherwise re-cue. A case where neither applies is skipped and counted in the result message.
- When it finishes, report counts: fixed, skipped, and remaining problems.

## 4. Post-upgrade project summary (per project, once per version)

- When a project is opened under a new minor or major version, after the first index completes, show one non-modal notification with counts. For example: "This project has 340 orphaned parentheticals and 3 standalone pause lines that can be fixed to standard Fountain, and 31 shots without tags." The buttons are **Fix All…** (runs section 3), **Show Problems**, and **Not Now**.
- Show it only if at least one fixable count is non-zero. Untagged shots are informational and never trigger it on their own.
- Track per project in `workspaceState`, keyed by version. **Not Now** dismisses it until the next minor or major version.
- It is a launcher into Fix-all and the Problems panel, not a second list of problems.
- Respect the same `lorefountain.notifications.whatsNew` setting, or add `lorefountain.notifications.projectSummary` if you think they should be separate. Report your choice.

## 5. Docs

- CHANGELOG: add these features to the Unreleased 1.1.0 entry.
- docs/DECISIONS.md: record the four layers and why each exists. Record that every fix is a single standard Fountain correction applied only with preview approval, and how 1.0 upgrades are detected.
- Describe the new command and settings wherever the extension's commands and settings are documented.

## 6. Tests

- **Version comparison:** major, minor and patch bumps; fresh install; 1.0.0 upgrade detected via an existing key; no key means fresh install.
- **Notice suppression:** setting off; already shown for this version.
- **Each quick fix:** where it's offered and where it isn't, and its exact text edits, including blank-line joining, re-cue with extensions kept, and no fix when there's no preceding speaker.
- **Fix-all:** edits from several files collected into one `WorkspaceEdit` with confirmation required; skipped-case counting.
- **Project summary:** shown once per version per project; not shown when fixable counts are zero; Not Now behavior.

Mock VS Code APIs as the existing tests do. Run lint, the full test suite (free and pro), and the build before reporting done.

## Out of scope

- Editing ORUN or the demo projects. That happens afterwards, in their own repo or session, using Fix-all.
- Publishing or releasing 1.1.0.

## Git

Commit in logical commits as the configured git user, with no AI attribution of any kind. Don't push.

## When done

Give me a short summary: files changed, test results (with counts), and anything you had to decide that this prompt didn't cover.
