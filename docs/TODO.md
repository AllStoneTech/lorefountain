# TODO

Things that need to happen but don't yet, tracked here so they survive between sessions. Not a changelog or a decision log — see `docs/DECISIONS.md` for the rationale behind each of these.

## Before `lorefountain` goes public (blocking)

**~~Scrub the product spec's history out of this repo~~ — done 2026-08-11.** See ADR-0033. `docs/LoreFountain_Spec.docx`/`.md` and the whole `docs/archive/` directory are gone from every commit on `main`, verified via `git log --all -- <paths>` returning nothing. A backup tag, `pre-history-scrub-2026-08-11`, points at the original unfiltered tip (`daf0264`) on `origin` in case anything needs recovering — not part of `main`'s ancestry, so it won't leak into a future public clone.

**Still blocking: the repo itself is still private.** The scrub only removed a *prerequisite* for going public — visibility hasn't been flipped yet. That's a separate, deliberate action (GitHub repo settings), not automatic from the scrub.

**Add a funding/sponsor link once a platform is decided.** No URL is set yet — once one is, wire it into `package.json`'s `funding` field and the README.

**This is also what's blocking "Install Demo" from working at all.** `lorefountain.installDemo` (ADR-0031, `src/commands/installDemo.ts`) fetches `demos/` from `AllStoneTech/lorefountain` via unauthenticated GitHub API calls, which return a plain `404` against a private repo — confirmed via `gh repo view` on 2026-07-31, reconfirmed 2026-08-11. The feature is fully built and unit-tested, just dormant until this repo actually goes public.

## Before `lorefountain` goes public, or ships to any real customer (blocking)

**~~Replace the stubbed `validateLicense()` with a real check~~ — code done 2026-08-11, backend deployment still outstanding.** See ADR-0034. `src/licensing/validateLicense.ts` now calls the real `POST /api/license/validate` endpoint with Zod-validated responses; `licenseState.ts` generates and sends a per-install device id. **Not usable yet** — three things still need to happen on the `AllStoneTech.com` side before a real key can actually validate:

1. Commit and deploy the licensing code that's currently sitting untracked in that repo (`src/app/api/license/`, `src/lib/license/`, `src/app/admin/licenses/`, `src/app/api/admin/licenses/`, `supabase/migrations/20260728000000_licensing.sql`) — confirmed via `git status` in that repo on 2026-08-11 that none of it has ever been committed or pushed.
2. Apply that migration against production Supabase.
3. Seed a `license_tiers` row for product `lorefountain-pro` with a real payment-processor product id — needs an actual paid listing to exist first, which is a product decision, not something to fabricate.

A public-launch promo window (`licensing/promoConfig.ts`) unlocks Pro for everyone regardless of license status until `PRO_PROMO_UNTIL` (set to **2027-01-01**) — bypasses the real check entirely while active, so the three items above aren't blocking for the promo period itself, only for real enforcement after it ends.

## Before publishing to either extension marketplace

**~~No marketplace icon exists~~ — done 2026-08-12.** `resources/icon.png` (512×512, AI-generated from a prompt describing the existing activity-bar glyph's exact shape) is wired in via `package.json`'s `"icon"` field and confirmed accepted by a real `vsce package` run.

**Neither publisher account is verified against a real login yet.** `package.json`'s `"publisher": "allstonetech"` was an assumed convention (per the project's identity notes) — needs an actual Azure DevOps + Marketplace publisher registration, and a separate Open VSX namespace claim. See `docs/PUBLISHING.md` for the full one-time setup on both.

**`.github/workflows/release.yml` builds and attaches a `.vsix` to a GitHub Release on any `v*` tag push, but doesn't publish anywhere yet** — the `vsce publish`/`ovsx publish` steps are commented out pending `VSCE_PAT`/`OVSX_PAT` repo secrets. Also note: the Release's asset isn't publicly downloadable until this repo itself goes public (same gate as the item above about `installDemo`).

## Non-blocking, but currently dormant

**Telemetry and feedback need two new `AllStoneTech.com` endpoints before either does anything.** See ADR-0036. `src/telemetry/sendTelemetry.ts` POSTs to `https://allstonetech.com/api/telemetry/ingest`; `src/telemetry/feedback.ts` POSTs to `https://allstonetech.com/api/feedback/submit`. Neither exists yet — telemetry silently queues locally (capped at 200 events) until it does; "Send Feedback" shows the user a visible "couldn't reach the feedback service" error. A prompt describing the exact endpoint contracts, table schemas, and the rate-limiting/sanitization/retention protections they need was handed to a separate AST-scoped session — not built here, same cross-repo boundary the licensing backend work follows (`AllStoneTech.com` changes happen in that repo's own sessions, not from here). Neither feature is blocking for `lorefountain` going public — both degrade gracefully with the endpoints absent — but telemetry is of limited use until it can actually report anywhere.

**The paid tier's own commands aren't covered by `registerTrackedCommand` yet.** `lorefountain-pro`'s command registrations live in the separate, private submodule (not present in this working tree — see `pro/README.md`) and need the same tracked-command wrapper (`src/telemetry/trackedCommands.ts`) added there directly once that repo is being worked on. Until then, only the free tier's commands and the six Pro *placeholder* commands (shown when Pro isn't active) are actually tracked.

## Blocked on `lorefountain` going public

**Build "Check for LoreFountain Updates" — the extension checking for and installing a newer version of itself.** Raised 2026-08-11. Distinct from the existing **"Check for LoreFountain File Updates"** command (`src/commands/checkFileUpdates.ts`), which only checks whether a workspace's scaffolded `agents/*`/`AGENTS.md`/README files have drifted from the templates bundled with the *currently installed* extension — it has no way to know whether a newer extension build exists at all. A real self-update command needs a release channel to check against (e.g. GitHub Releases) and a way to compare the installed `vscode.extensions.getExtension(...).packageJSON.version` against it, then download and `code --install-extension` the new `.vsix` — none of which is possible until this repo is actually public, since there's nowhere to publish a checkable release yet. Once built, **it should probably absorb or demote "Check for LoreFountain File Updates"** — a user asking "is LoreFountain up to date" naturally means the extension first, in-project files second — but the exact relationship (one command with two modes, vs. two commands with the file-check demoted to a submenu of the update check) needs deciding when this is actually scoped, not assumed now.

## Non-blocking, not yet scoped

**Story Overview's body field should default to a rendered Markdown view, not a raw textarea.** Raised 2026-07-31: the panel should show the body as rendered Markdown when it already has content, only dropping into the raw-text `<textarea>` once the user explicitly asks to edit (click-to-edit, not always-editing) — closer to how Notion/Obsidian handle a Markdown body. Current state (`storyOverviewHtml.ts`) is always a plain editable textarea, no rendering at all. Explicitly deferred, not approved to build yet: doing this properly means bundling a Markdown-to-HTML renderer (e.g. `markdown-it`) into the webview and sanitizing its output before injecting into the DOM — a real jump from the webview's current posture of static HTML/CSS/JS with zero external libraries and a tight CSP. Revisit together before starting; don't build unprompted.
