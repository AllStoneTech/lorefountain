# TODO

Things that need to happen but don't yet, tracked here so they survive between sessions. Not a changelog or a decision log — see `docs/DECISIONS.md` for the rationale behind each of these.

## Before `lorefountain` goes public (blocking)

**Scrub the product spec's history out of this repo before flipping visibility to public.** The files themselves were removed from the working tree on 2026-07-26 (ADR-0024) and now live in the private `AllStoneTech/lorefountain-business` repo instead — but removing a file only stops *future* commits from containing it. This repo's past commits still have every one of these in their original blobs, retrievable via `git log`/`git show` on old revisions even after deletion. A history rewrite (`git filter-repo` or BFG Repo-Cleaner) removing these exact paths from every commit, followed by a force-push to `origin/main`, is required before this repo is ever made public — not before.

Exact paths to remove from history:
- `docs/LoreFountain_Spec.docx`
- `docs/LoreFountain_Spec.md`
- `docs/archive/LoreWeaver_Spec_v0.2.docx`
- `docs/archive/LoreWeaver_Spec_v0.3.docx`
- `docs/archive/Loreweave_Spec_v0.1.docx`

(`docs/archive/` can likely just be removed as a whole directory — nothing else was ever in it.)

This is a force-push, hard-to-reverse operation against a shared remote — confirm explicitly before running it, even though it's already been agreed to be necessary.

**This is also what's blocking "Install Demo" from working at all.** `lorefountain.installDemo` (ADR-0031, `src/commands/installDemo.ts`) fetches `demos/` from `AllStoneTech/lorefountain` via unauthenticated GitHub API calls, which return a plain `404` against a private repo — confirmed via `gh repo view` on 2026-07-31. The feature is fully built and unit-tested, just dormant until this repo actually goes public.

## Before `lorefountain` goes public, or ships to any real customer (blocking)

**Replace the stubbed `validateLicense()` with a real check.** `src/licensing/validateLicense.ts` currently always resolves `{ valid: true }` regardless of the key given — added 2026-07-28 specifically so the rest of the client-side license flow (`src/licensing/licenseState.ts`'s caching/grace-period logic, the `enterLicenseKey`/`showLicenseStatus`/`clearLicenseKey` commands, gating the pro module load in `extension.ts`) could be built and tested locally while the real backend is being built separately (see `lorefountain-business/licensing/IMPLEMENTATION_PLAN.md`, being implemented against the AllStoneTech.com project).

Right now, anyone who runs "Enter License Key" with literally any text unlocks the full paid tier — this is fine for local development, not fine for anything ships-to-a-customer. Swap `validateLicense`'s body for a real `fetch` call to the AllStoneTech.com endpoint once it exists; per that function's own doc comment, nothing else in `licenseState.ts` should need to change, since it's already written against that endpoint's documented contract.

## Blocked on `lorefountain` going public

**Build "Check for LoreFountain Updates" — the extension checking for and installing a newer version of itself.** the project owner, 2026-08-11. Distinct from the existing **"Check for LoreFountain File Updates"** command (`src/commands/checkFileUpdates.ts`), which only checks whether a workspace's scaffolded `agents/*`/`AGENTS.md`/README files have drifted from the templates bundled with the *currently installed* extension — it has no way to know whether a newer extension build exists at all. A real self-update command needs a release channel to check against (e.g. GitHub Releases) and a way to compare the installed `vscode.extensions.getExtension(...).packageJSON.version` against it, then download and `code --install-extension` the new `.vsix` — none of which is possible until this repo is actually public, since there's nowhere to publish a checkable release yet. Once built, **it should probably absorb or demote "Check for LoreFountain File Updates"** — a user asking "is LoreFountain up to date" naturally means the extension first, in-project files second — but the exact relationship (one command with two modes, vs. two commands with the file-check demoted to a submenu of the update check) needs deciding when this is actually scoped, not assumed now.

## Non-blocking, not yet scoped

**Story Overview's body field should default to a rendered Markdown view, not a raw textarea.** the project owner, 2026-07-31: the panel should show the body as rendered Markdown when it already has content, only dropping into the raw-text `<textarea>` once the user explicitly asks to edit (click-to-edit, not always-editing) — closer to how Notion/Obsidian handle a Markdown body. Current state (`storyOverviewHtml.ts`) is always a plain editable textarea, no rendering at all. Explicitly deferred, not approved to build yet: doing this properly means bundling a Markdown-to-HTML renderer (e.g. `markdown-it`) into the webview and sanitizing its output before injecting into the DOM — a real jump from the webview's current posture of static HTML/CSS/JS with zero external libraries and a tight CSP. Revisit together before starting; don't build unprompted.
