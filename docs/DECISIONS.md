# Architecture Decisions

A running log of significant technical decisions and their rationale. Newest
first. Each entry records what was decided, why, and what would trigger a
revisit.

---

## ADR-0037 — First public release: version jumps straight to 1.0.0

**Date:** 2026-08-23 · **Status:** Accepted

The onboarding-buttons feature landed under the existing "minor per shipped feature" convention (ADR-0032), bumping to `0.13.0`. Before publishing to the VS Code Marketplace and Open VSX for the first time, the project owner called this the actual public launch and asked to bump straight to `1.0.0` instead.

1. **`1.0.0` was always reserved for this moment** — CHANGELOG.md's own header has said so since ADR-0032 ("`1.0.0` is reserved for the actual public launch"). Publishing to both real marketplaces, with real users able to install it, is that moment, regardless of whether the source repo itself is public yet — the two are independent milestones (see ADR-0024/`docs/TODO.md`).
2. **Verified before bumping, not assumed**: the actual production `.vsix` (obfuscated, exactly as it would ship) was built, installed into a real VS Code instance, and confirmed working — closing the "not live-tested" gap flagged repeatedly across prior ADRs (ADR-0035 among others) for the packaged artifact specifically. The bundled headless validator, run from inside the extracted `.vsix` itself, correctly parsed a full real demo project with no errors.
3. **`package.json`/`package-lock.json` bumped together** via `npm version 1.0.0 --no-git-tag-version`, matching ADR-0032's own precedent for keeping the lockfile in sync rather than leaving `npm install` to rewrite it later.
4. **License backend deployment is explicitly not a blocker for this release** — the public-launch promo (ADR-0034, `PRO_PROMO_UNTIL = 2027-01-01`) is the deliberate, already-tested mechanism covering that gap, not an oversight being shipped around.

---

## ADR-0036 — Opt-in feature-usage telemetry and a "Send Feedback" command

**Date:** 2026-08-12 · **Status:** Accepted

The project owner wanted visibility into which features (free and Pro alike, not just Pro conversion) people actually use, plus a lightweight way for users to volunteer feedback — while explicitly worried about two things: slowing the editor down, and quietly contradicting the README's existing "files are the source of truth, nothing requires a database, no AI features" local-first pitch. Both concerns shaped the design below more than the data model did.

1. **Opt-in, not opt-out, and gated twice.** `lorefountain.telemetry.enabled` defaults to `false`; even when `true`, `telemetryConfig.ts`'s `isTelemetryOptedIn()` also requires `vscode.env.isTelemetryEnabled` — VS Code's own global switch always wins, this extension's setting can never override it. A one-time, non-blocking consent prompt fires on first activation (`telemetry/consent.ts`), skipped entirely if the global switch is already off. Picking "Learn More" resets the "have we asked" flag rather than counting a click-through as an answer, so the prompt fires again next activation.
2. **Comprehensive by construction, not by remembering to instrument each feature.** `telemetry/trackedCommands.ts`'s `registerTrackedCommand` is a drop-in replacement for `vscode.commands.registerCommand`, used at every command-registration site in the codebase (all of `src/commands/*.ts`, `providers/helpPanel.ts`, `extension.ts`'s own inline registrations, and the `GATED_PRO_COMMANDS` placeholders) — a new command gets tracked automatically just by using the wrapper, and a free-tier user clicking a gated Pro placeholder is itself captured as real demand signal. The one gap: the paid tier's own command implementations live in the separate `lorefountain-pro` submodule, not present in this working tree (`pro/README.md`) — that repo needs the same wrapper added directly; flagged in `docs/TODO.md`, not silently missed.
3. **Hover and completion get a coarser mechanism, for latency, not privacy, reasons.** Recording a real event per hover/completion call would touch `globalState` from a callback VS Code holds to a real latency budget (`providers/hoverProvider.ts`, `providers/completionProvider.ts`). Instead, `eventBuilding.ts`'s `markFeatureUsedThisSession` is a synchronous, zero-I/O `Set.add` — the flag only becomes a real queued event later, via `flushSessionUsageFlags`, called from `extension.ts` right before a send, never from the hot path.
4. **The "pure logic vs. `vscode`-facing glue" split is stricter here than elsewhere in this codebase, for a concrete reason.** `licenseState.ts` already separated pure date-math from `vscode`-facing glue, but its `vscode` import was *incidentally* type-only (no function in that file happens to call a live `vscode.*` global). Telemetry genuinely needs to read `vscode.env.isTelemetryEnabled`/`vscode.env.appName`/`vscode.workspace.getConfiguration` — real runtime calls — and a static `import` executes unconditionally at module-load time regardless of whether the imported binding is ever invoked. That meant the first draft of this feature (a single `telemetryState.ts`/`events.ts` pair) failed every unit test with "Cannot find package 'vscode'" the moment a *test* imported anything from those files, even pure functions like `appendCapped`. Fixed by physically isolating the one real `vscode`-touching function (`telemetryConfig.ts`'s `isTelemetryOptedIn`) into its own file that nothing test-covered imports, and making every function that needs it (`telemetryState.ts`'s `queueEventIfOptedIn`, `sendTelemetry.ts`'s `sendQueuedTelemetry`) take it as a *required* parameter with no default — even an unused default import would have re-introduced the same transitive failure. `events.ts` re-exports `eventBuilding.ts`'s pure surface (`export * from './eventBuilding'`) so every existing call site keeps importing from `'../telemetry/events'` unchanged.
5. **The network call is real, not a stub, following ADR-0034's precedent rather than ADR-0026's.** `sendTelemetry.ts`/`telemetry/feedback.ts` POST to real (undeployed) `AllStoneTech.com` endpoints — `/api/telemetry/ingest` and `/api/feedback/submit` — documented in a prompt handed to a separate AST-scoped session (see `docs/TODO.md`), not built here per the standing cross-repo boundary. Telemetry fails silently and keeps queuing locally (capped at 200 events, oldest dropped first) until that endpoint exists; feedback surfaces a visible retry error instead, since it's explicit and user-initiated — a silently-dropped bug report would be worse than a stub that pretends to work.
6. **Feedback is a deliberately separate code path from telemetry, not a `type: 'feedback'` event.** `telemetry/feedback.ts` has its own schema, its own endpoint, and isn't gated by the telemetry opt-in at all — same posture as "contacting support." Its webview form (`providers/feedbackPanel.ts`/`feedbackHtml.ts`, following `settingsPanel.ts`'s existing CSP/nonce pattern) validates the incoming `postMessage` against `feedbackFormMessageSchema` before ever building a network payload, same "validate at the boundary" posture as every external input elsewhere in this codebase.
7. **Version bumped to `0.12.0`** per the ADR-0032 convention — genuinely new behavior, not a fix. **25 new unit tests** across `telemetryState.test.ts` (queue-cap logic), `eventBuilding.test.ts` (editor/platform detection, event construction, schema), `sendTelemetry.test.ts` (batch/clear-on-success/keep-on-failure, hand-written `fetch` and opted-in stubs), and `feedback.test.ts` (payload construction, form validation, submit) — 563 total, all passing, clean `tsc --noEmit` and `eslint`. The consent prompt, the webview, and the tracked-command wrapper's actual runtime behavior are `vscode`-facing glue, unverified live this session — worth an F5 pass before relying on it, same caveat as prior ADRs.

---

## ADR-0035 — Production builds are obfuscated, not just minified; strength is a one-flag switch

**Date:** 2026-08-12 · **Status:** Accepted

The project owner asked whether `vsce package` obfuscates the shipped code — it only minified. Minification (esbuild's `minify: true`) collapses whitespace and mangles local variable names, but property names, string literals, and overall control flow survive; running the output through a beautifier gets back fairly readable code. For `dist/pro.js` (the paid-tier logic) and `dist/entityGraphClient.js` (the paid-tier webview client), that's a lower bar than intended.

1. **`javascript-obfuscator` runs as a post-processing pass in `esbuild.js`**, after esbuild's own bundle+minify, on the three bundles that ship in the `.vsix`: `dist/extension.js`, `dist/pro.js`, `dist/entityGraphClient.js`. It deliberately does **not** touch `resources/agents/validate.js` — that file is scaffolded into users' own projects specifically to be a plain, human/AI-readable validator script (see ADR-0021), and obfuscating it would defeat its purpose.
2. **Strength is selected with `--obfuscate=<max|balanced|off>`**, defaulting to `max` (so `npm run package` / `vscode:prepublish` ship at `max` with no extra flag). `npm run build:obfuscate-balanced` and `npm run build:obfuscate-off` are the one-line ways to switch, per the project owner wanting this "easily flippable." Two profiles, not a continuum of individual flags, to keep the choice legible:
   - **`balanced`** — string-array encoding (base64) + hexadecimal identifier renaming only.
   - **`max`** — adds control-flow flattening and dead-code injection on top.
3. **Both profiles leave `renameProperties`, `renameGlobals`, and `selfDefending` off.** The bundles are CommonJS with `module.exports.activate`/`deactivate` that VS Code calls by name, and the webview IIFE may expose globals the extension host depends on — renaming either risks a silent runtime break that would only surface as "the extension doesn't activate" in production, with no local repro. `selfDefending` (tamper-detection wrapper) was rejected because it turns any future reformatting of the bundle into a self-inflicted break, and it makes stack traces from user bug reports unreadable — a bad trade against a bar (defeating manual reverse-engineering) obfuscation is already meeting without it.
4. **Measured `.vsix` sizes drove the default choice**, not a guess: minify-only 1.0 MB, `balanced` 1.54 MB (1.5x), `max` 3.64 MB (3.6x). All three are well inside Marketplace practical limits, so size wasn't the deciding factor — `max`'s real cost is runtime overhead from control-flow flattening on every function in `extension.js` (loaded at activation) and `entityGraphClient.js` (loaded on webview open). The project owner chose `max` as the starting point anyway, on the strength of the flip mechanism in point 2 making it a non-decision to walk back later if activation-time complaints surface.
5. **Verified the `max`-obfuscated `dist/extension.js` still loads correctly** — `node -e "require('./dist/extension.js')"` runs the obfuscated bundle through to the point of `require('vscode')` (which fails outside an extension host, as expected — same failure point as the unobfuscated bundle). Not verified inside an actual Extension Development Host this session; worth an F5 smoke test, especially of Pro features and the Entity Graph webview, before the next release ships.
6. **Not yet reflected in `CHANGELOG.md`** — this is a build-tooling change with no user-visible behavior difference, so it wasn't added as a changelog entry; flagging here in case that judgment call is wrong.

---

## ADR-0034 — Real license validation wired up, plus a self-expiring public-launch promo override

**Date:** 2026-08-11 · **Status:** Accepted

Same session as ADR-0033. While the history scrub removed the last blocker to going public, `validateLicense()` was still the "always valid" stub from ADR-0026 — a public repo would have published exactly how to bypass paid-tier gating, and the project owner separately wanted pro features to stay unlocked for everyone for a period after public launch, without leaving that behavior indistinguishable from "we never finished the real backend."

1. **`validateLicense()` now calls the real endpoint** (`POST https://allstonetech.com/api/license/validate`, discovered already built in the sibling `AllStoneTech.com` repo per its own licensing plan) with `{licenseKey, product: 'lorefountain-pro', deviceId}`, validating the response against a Zod schema mirroring that route's documented contract exactly. Non-2xx and shape-mismatched responses both throw — deliberately indistinguishable from a network failure to the caller, so `licenseState.ts`'s existing offline-grace logic (built in ADR-0026 specifically for this day) engages without any changes to that file's control flow.
2. **New `getOrCreateDeviceId`** in `licenseState.ts` — a random UUID generated once and persisted in `globalState` (not `secrets`; it's an install identifier, not a credential), sent with every validation call so the backend's per-tier activation cap has something to key on.
3. **The endpoint is not actually deployed yet.** Confirmed live via a direct `POST` against production (got the real Next.js 404 page, not a route-not-found from an undeployed domain) — and confirmed in the `AllStoneTech.com` repo's own `git status` that every licensing file (the route, the Supabase migration, the admin API) is still untracked, never committed or pushed. No `license_tiers` row exists for `lorefountain-pro` either. Wiring the extension to call it now is still correct and safe — the "unreachable endpoint" path was always the intended behavior for exactly this situation, exercised for real for the first time now (previously only reachable by contrivance, per the pre-existing doc comment on `isWithinGrace`). Deploying that repo's side is out of scope for this session — see `docs/TODO.md`.
4. **`licensing/promoConfig.ts`: one exported date constant, `PRO_PROMO_UNTIL`, plus a pure `isPromoActive(now)`.** `activateProTier` in `extension.ts` checks this before ever calling `getLicenseStatus` — during the promo, Pro activates unconditionally and no network call is made at all, rather than calling an endpoint whose answer can't change the outcome. Deliberately a single, heavily-commented file rather than a flag buried in gating logic: the project owner flagged wanting an easy way to extend the promo, and "change one exported constant, ship a release" is as low-friction as this gets without adding a remote-config dependency this project has otherwise avoided. Placeholder value at the time: 30 days from 2026-08-11 (the actual public-launch date hadn't been set yet). **Update, 2026-08-15: confirmed and set to 2027-01-01.**
5. **Version bumped to `0.11.0`** per the ADR-0032 convention (minor per shipped feature) — real license validation and the promo mechanism are both genuinely new behavior, not a fix.
6. **13 new/changed unit tests** (`validateLicense.test.ts` rewritten for the real fetch-based implementation — request shape, valid/invalid responses, non-2xx and malformed-shape throwing; `licenseState.test.ts` gains `getOrCreateDeviceId` coverage against a hand-written `globalState` stub; new `promoConfig.test.ts` covers the date-boundary logic) — 524 total, all passing, clean `tsc --noEmit` and `eslint`. `extension.ts`'s promo short-circuit itself is `vscode`-facing glue, unverified live this session (same fresh-EDH-window tooling gap as prior ADRs) — worth a manual pass before relying on it.

---

## ADR-0033 — History scrub: product spec removed from every commit, backup tag left outside `main`'s ancestry

**Date:** 2026-08-11 · **Status:** Accepted

`docs/TODO.md` had carried this as a blocking pre-public-launch item since ADR-0024 (spec files removed from the working tree, but every prior commit's blobs still had them). The project owner asked to actually run it as part of a broader push to get the licensing flow production-ready.

1. **`git filter-repo`, run against a fresh `--mirror` clone, never in-place** — filter-repo's own guidance; rewriting a mirror clone and only then force-pushing the result keeps the working repo's untouched state available as a fallback for the entire operation, not just via a tag.
2. **Paths removed:** `docs/LoreFountain_Spec.docx`, `docs/LoreFountain_Spec.md`, `docs/archive/` (whole directory — confirmed nothing else was ever in it). Verified post-rewrite with `git log --all -- <paths>` on the new history returning zero commits, across all 48 commits (count unchanged — rewriting, not squashing).
3. **A backup tag, `pre-history-scrub-2026-08-11`, was pushed to `origin` pointing at the original tip (`daf0264`) *before* the rewrite, then deliberately excluded from the force-push** that replaced `main`. `git filter-repo` rewrites tags along with everything else in whatever clone it's run against — pushing it back would have silently replaced the backup with a copy of the very history it's meant to be a fallback for. Sitting outside `main`'s ancestry, it won't be pulled into a future public clone (`git clone` only follows reachable history from default refs) — real backup, not a second leak.
4. **Force-pushed only `refs/heads/main`** (`git push --force <url> refs/heads/main:refs/heads/main`), not `--mirror` or `--tags`, specifically so nothing else on `origin` — namely the backup tag from point 3 — got overwritten as a side effect.
5. **Repo visibility itself was deliberately left untouched.** This ADR closes the history half of the public-launch blocker; going public is a separate, explicit action still pending — see `docs/TODO.md`.
6. **Not yet reflected in a fresh clone check** — verification here was `git log --all` against the rewritten `origin/main` and the local working copy after `git fetch && git reset --hard origin/main`, not a truly independent third clone. Low risk (filter-repo's rewrite is deterministic and the object count/commit count matched expectations), but worth an independent clone-and-grep before the repo actually flips public, not just before.

---

## ADR-0032 — Real semver for the extension, starting at 0.8.0; changelog starts fresh, not backfilled

**Date:** 2026-08-11 · **Status:** Accepted

`package.json`'s `version` had sat at the esbuild-scaffold default `0.0.1` through all 31 prior ADRs — the entire free tier and all six shipped LoreFountain Pro features. That surfaced while building version tracking for the scaffolded `agents/*.md` files (the fix for Orun's stale docs, see the World View significance/Physical Description work): those files now have their own per-file version counter, which made the extension's own frozen version look wrong by comparison. The project owner: "We're going to need real version numbers when we make this public."

1. **Standard semver, `0.x.y` while pre-public, `1.0.0` reserved for the actual launch.** `0.x` already carries the conventional meaning "no API/schema stability guarantees yet," which is accurate today — nothing has been tagged or published. `1.0.0` is deliberately not claimed now; it's reserved for the real public release, which `docs/TODO.md` already gates behind two blocking items (the product-spec history scrub, real `validateLicense()` backend) that exist independently of this decision.
2. **Jumped straight to `0.8.0` rather than starting at `0.1.0`.** The project owner's explicit call, not a reconstruction of exact history: `0.0.1` badly understated how much is actually built and working (full free tier + all six Pro features + this session's World View and doc-version-tracking work), and continuing to imply "barely started" would be misleading once this becomes a real, tracked number. Going forward: bump minor per shipped feature, patch for fixes, exactly as semver prescribes from here.
3. **`CHANGELOG.md` starts fresh at `0.8.0` rather than backfilling a per-ADR entry for everything already shipped.** The project owner's explicit call. The `[0.8.0]` entry summarizes current functionality at a high level instead — full rationale for every decision behind it stays in this file (`docs/DECISIONS.md`), which the changelog entry points to rather than duplicates. Reduces ongoing maintenance burden (this file already has one confirmed duplicate ADR number, 0028, from manual upkeep drifting) and avoids committing to changelog accuracy for history that was never tracked as it happened.
4. **The extension's version and the `AGENT_FILE_VERSIONS` doc-tracking counters (added the same session) are deliberately independent** — bumping one never bumps the other. They answer different questions (is this build of the extension newer, vs. is this specific scaffolded reference doc current) and change on different schedules; conflating them would make either signal less precise for no real benefit.
5. `package.json` and `package-lock.json` (both the root and self-referencing `packages[""]` entries) updated together so `npm install` doesn't immediately want to rewrite the lockfile. No code changes — this ADR, the version bump, and the changelog rewrite are the entire scope.

---

## ADR-0031 — Install Demo: fetch a full demo world from GitHub on demand, don't bundle it

**Date:** 2026-07-31 · **Status:** Accepted

Demos were previously only reachable by whatever shipped in the `.vsix` — and `demos/**` had just been excluded from packaging entirely (fixing a leak: 232 files / 2.16MB → 31 / 702KB), which meant a fresh install had no way to reach them at all. The project owner's proposal: an "Install Demo" button that fetches demos on demand from GitHub instead. Scoped with three quick questions before building, all pointing at the same shape: keep `demos/` in the main repo (rather than splitting it into its own repo) and fetch it live via the GitHub API; trigger via both a Command Palette command and a walkthrough step; always download to a brand-new folder and open it in a new window, never touching whatever's currently open.

1. **`demos/` stays in `AllStoneTech/lorefountain`, fetched from `main` at install time** (`src/demos/demoCatalog.ts`) — this also settles the standing open question of whether `demos/` belongs in the main repo at all: yes, and now it's load-bearing (the install command's actual source), not just sample content sitting in the tree. The tradeoff, accepted deliberately: a user always gets whatever's on `main` right now, not whatever shipped with their installed extension version — fine for demo content that isn't expected to break compatibility with older extension versions.
2. **GitHub Contents API for directory listing, plain `download_url` GETs for file bytes** (`src/demos/demoDownloader.ts`) — not the Git Trees/Blobs API, and not a whole-repo tarball/zip download. A demo is a few dozen files; one API call per subdirectory (rate-limited, but a single install only needs a handful) plus one unauthenticated GET per file (served from `raw.githubusercontent.com`, a different limit entirely) is simple, needs zero new dependencies, and stays two small, independently-testable functions. `fetchImpl` is threaded through as a parameter rather than imported at module scope specifically so the unit suite can stub it — this project's tests never make live network calls.
3. **Download to a staging folder next to the chosen target, `fs.rename` into place only on full success** (`src/commands/installDemo.ts`) — same-directory rename is always atomic and same-volume (critical on Windows, where `fs.rename` fails across drives), so a failed or cancelled download can never leave a half-written folder sitting at the exact name/location the user picked. On any failure the staging folder is removed and the error is surfaced; nothing partial is left for the user to find later.
4. **Always a brand-new folder, always a new window** (`{ forceNewWindow: true }` on `vscode.openFolder`) — same non-destructive posture as the existing `tryLoreFountain` sample-workspace command, and the option explicitly preferred over installing into the currently-open workspace, which risked colliding with real project content already there.
5. **Surfaced both ways**: `lorefountain.installDemo` in the Command Palette, and a 5th step ("Explore a Full Demo World") appended to the existing Getting Started walkthrough, `resources/walkthrough/install-demo.md` — for a brand-new user who hasn't found the Command Palette yet.
6. **5 new unit tests** (`demoDownloader.test.ts`) covering recursive directory flattening, a failed directory-listing request, a missing `download_url`, writing nested files to a temp directory, and a failed file download — 391 total. Clean `tsc --noEmit` and `eslint`.
7. **Can't actually work yet — `AllStoneTech/lorefountain` is currently a private repo** (confirmed via `gh repo view` while attempting to live-verify this feature: unauthenticated `api.github.com`/`raw.githubusercontent.com` requests against a private repo both return a plain `404`, indistinguishable from "path doesn't exist"). This isn't a bug in `demoDownloader.ts` — every unit-tested code path is correct — it's a real precondition the whole feature depends on that isn't true yet. Deliberately shipped anyway rather than blocked on: the repo going public was already a tracked blocker (`docs/TODO.md`'s history-scrub item) before this feature existed, and that same event now unblocks this too. Revisit and actually run the command against the live repo once that scrub happens and `lorefountain` flips to public — see `docs/TODO.md`.

---

## ADR-0030 — Story Overview restructured: short universal frontmatter fields + one flexible body

**Date:** 2026-07-30 · **Status:** Accepted

ADR-0029 shipped Story Overview as pure freeform Markdown with suggested-but-unenforced section headers. After live use against two real demo projects with genuinely different needs — Of One Blood's literary-adaptation sections vs. Loomwake's TTRPG-flavored "The pitch" / "The central question" / "Why this is unfinished" — the project owner wanted "somewhat structured. Things like title, pitch, tone, etc. Things that are universal to an Overview," while keeping room for a project's own larger sections. Landed on a synthesis rather than picking one side: a handful of fields that are genuinely universal across any story/world (not specific to any genre's section vocabulary) as real frontmatter, and everything else stays exactly what it was — one free Markdown body.

1. **Four optional frontmatter fields — `title`, `pitch`, `tone`, `genre`** (`src/model/storyOverview.ts`, `storyOverviewSchema`, `.catchall(z.unknown())` like every other schema in this project) — chosen because all four apply regardless of genre or format, unlike "Premise"/"Setting"/"Synopsis," which are conventions for a specific kind of story, not universal properties of one. Everything else — Premise, Setting, Key Characters, Synopsis, Themes, or a TTRPG's own headers — stays in the free body, exactly as ADR-0029 shipped it. The template (`resources/story-overview.md`) suggests those default headers; nothing enforces them.
2. **A dedicated Story Card–style custom editor** (`storyOverviewEditorProvider.ts` + pure `storyOverviewForm.ts`/`storyOverviewHtml.ts`, mirroring the existing Story Card's split of pure conversion logic from `vscode`-facing glue) registered under its own view type (`lorefountain.storyOverview`) with a selector precise to `**/world/OVERVIEW.md` — deliberately not reusing the Story Card editor, which is entity-shaped (name/type/relations) and has nothing to do with a singleton project-level document. The World tree's "Story Overview" row now opens this editor explicitly by view type rather than forcing VS Code's generic `'default'` text editor (ADR-0029's original fix for the entity-form collision) — the collision is now solved by giving Story Overview a real, correctly-scoped home instead of routing around Story Card's broader selector.
3. **Backward compatible by construction, not by special-casing.** A pre-existing `OVERVIEW.md` with no frontmatter at all (Loomwake's, at the time of this change) parses cleanly through the same tolerant `parseMarkdownWithFrontmatter` every other schema already uses — all four fields simply come back unset, and the entire original text is preserved as the body. No migration script, no version flag.
4. **The template omits blank placeholder keys** (`pitch:`, `tone:`, `genre:` are not scaffolded at all, only `title` is, via the existing `{{PROJECT_NAME}}` substitution) rather than writing them empty — an empty YAML scalar parses as `null`, and `z.string().optional()` rejects `null` (only `undefined`). Simpler to leave the fields absent until a user actually fills them in via the new card than to special-case null-as-unset in the schema.
5. **9 new unit tests** (`storyOverviewModel.test.ts`, `storyOverviewForm.test.ts`) covering valid/malformed/schema-invalid parsing, the no-frontmatter legacy-file path, catchall preservation, and the form round-trip — 386 total. Clean `tsc --noEmit`, `eslint`, and a full `npm run package` (still 31 files, no `demos/**` leak). **Not yet live-verified**: the new webview itself is `vscode`-facing glue outside the unit suite, same caveat as every prior custom-editor ADR — worth confirming in a fresh EDH or the real install that Loomwake's `OVERVIEW.md` now opens as a structured card with its existing prose intact in the body field.

---

## ADR-0028 — Arc as a sixth entity type; config-driven World-category visibility; a settings screen

**Date:** 2026-07-29 · **Status:** Accepted

The project owner wanted to track story arcs (e.g. one real project's own multi-season arc) independently of Season/Episode — an arc can span several seasons or sit inside just a couple of episodes, so it can't be inferred from the existing folder-per-season script structure (ADR-0023) alone. Discussing that surfaced a second, unrelated want: letting a project hide World-tree categories it doesn't use (no Factions, no Arcs, etc.), which in turn meant building this extension's first configuration screen, since none existed.

1. **Arc is a full entity type, not a lightweight tag.** Three options were compared explicitly before building: a freeform `Arc:` tag on script title pages, an `arc` field on Timeline events, or a full 6th entity type. The first two only *label* episodes/events; they can't carry arc-level metadata (a synopsis, `canon_status`, relations to entities) and don't give the arc anything to browse to on its own. Arc joins `ENTITY_TYPES` (`src/model/entity.ts`) alongside character/location/faction/object/concept, gets a real Story Card, and lives in the World tree under "Arcs" — same posture as every other entity, not Timeline's separate-layer treatment (ADR-0026), because an arc is a first-class worldbuilding thing, not a cross-cutting annotation.
2. **`episodes: string[]` — a list of script Production Codes, not `relations`.** `relations` (Spec §4.5) targets other *entity* ids; a script isn't an entity, so an arc's episode membership needed its own field. Deliberately a flat list of Production Codes rather than a season+order pair or a range, since an arc's episodes don't need to be contiguous or season-bound — exactly the project owner's stated requirement.
3. **A code in `episodes` that doesn't match a real script's Production Code is a new non-blocking warning** (`findDanglingEpisodeCodes`, `src/index/relations.ts`), surfaced through the exact same paths as the existing dangling-relation check — the Output channel and `cli/validate.ts`'s exit-1 behavior. Confirmed explicitly rather than assumed: Timeline's `production_code` already resolves silently to "unset" on a miss (ADR-0026), but that precedent was deliberately *not* followed here, because an arc's entire value proposition is precise episode targeting — a silent typo would defeat the feature outright, unlike Timeline where a missing link only affects one event's sort position.
4. **World-category visibility is config-driven, not a per-entity flag.** `lorefountain.config.json` gains `world.hiddenCategories: string[]` (`src/config/configFile.ts`), read through the same `getWorkspaceFolders` chokepoint every other config value already goes through, and filtered against in `worldTreeProvider.ts`'s `categoryNodesFor`. Deliberately *not* a per-entity `hidden` flag (frontmatter field, migration, per-item context-menu command) — the actual want was "hide whole unused categories per project," which a project-level config array does for free; a per-entity flag was scoped out as a separate, larger feature if ever needed.
5. **A new settings webview panel** (`src/providers/settingsPanel.ts` + `settingsHtml.ts`), the extension's first standalone `vscode.window.createWebviewPanel` — every prior webview was the Story Card's `CustomTextEditorProvider`, bound to an open document; a project-config screen isn't backed by a document the same way. v1 scope is deliberately narrow: one checkbox per World category, bound to `world.hiddenCategories`. Folder-path editing (`folders.*`) was left out — nothing edits those via UI today either, and it wasn't the ask. A new `writeLoreFountainConfig` (`src/config/configFile.ts`) is the first general config writer; the pre-existing `writeDefaultConfigIfAbsent` only ever wrote a file that didn't exist yet. No new `FileSystemWatcher` on `lorefountain.config.json` — the panel is the only writer, so it calls `treeProvider.refresh()` directly after saving instead.
6. **`resources/lorefountain.config.schema.json` updated in lockstep with the Zod schema**, per ADR-0006's own "revisit if more config keys are added" note — both now document `world.hiddenCategories` so hand-edits still get editor autocomplete/validation.
7. **365 unit tests total, all passing** (new coverage: arc schema round-trip, misplaced-field parity, dangling-episode detection at both the full-build and single-file `reindexFile` paths, Story Card form conversion, and the config read/write/merge behavior), plus a clean `tsc --noEmit`, `eslint .`, and `npm run build`. **Not verified live**: the Story Card's new Arc fieldset/episode picker, the World tree's category filtering, and the settings webview panel are all `vscode`-facing glue, same caveat as every prior ADR's UI work — worth a fresh Extension Development Host pass (create an arc, add episodes including one bad code, confirm the warning; open Settings, hide a category, confirm the tree updates) before calling this visually confirmed.

---

## ADR-0029 — Story Overview: `world/OVERVIEW.md`, a free-tier document, not a feature

**Date:** 2026-07-29 · **Status:** Accepted

The project owner, after the Continuity Overview shipped: "that's not what I was thinking" — they wanted a document answering "what is this story/world/series/game actually about," pasting a full example (premise, character overview, detailed synopsis, themes) for a demo project as illustration. Scoped with three quick questions before building, all "Recommended": location, format, and migration integration.

1. **`world/OVERVIEW.md` — free tier, not paid**, and deliberately *not* an entity, a schema, or an index. It's prose with suggested section headers (Premise, Setting, Key Characters, Synopsis, Themes), scaffolded from `resources/story-overview.md` via a new, small `src/config/storyOverview.ts`, sibling to but separate from `readmeFiles.ts` — a README explains what a *folder* is for; this explains what the *story* is. No validation, no frontmatter, exactly the freeform posture already established for `world/notes/`.
2. **Scaffolded everywhere a workspace gets bootstrapped**: `initializeWorkspace` (real projects) and `tryLoreFountainCommand` (the walkthrough's sample workspace, with real sample content matching its existing Nova Reyes/Wayfarer setup) — both via the same "never overwrite what's already there" posture as every other scaffold in this project.
3. **`agents/initiator.md` (the AI-facing migration prompt) now also writes/updates this document** during a "Migrate Existing Lore" pass — the exact scenario that prompted the request (pasting a synopsis for a demo project migrated from an existing novel). Given the same "don't silently overwrite a writer's own content" posture as per-entity files: fill it in fresh if it's empty/still the placeholder template, otherwise report what the import material would change and let the writer decide, same judgment-call framing `initiator.md` already used for entities.
4. **Surfaced in the World tree** as a single, always-first, non-collapsible "Story Overview" row (`worldTreeProvider.ts`) — shown only once `world/OVERVIEW.md` actually exists on disk, so it never links to a file that isn't there yet before `Initialize Workspace` (or a migration pass) has run.
5. **3 new unit tests** for `scaffoldStoryOverviewIfAbsent` — 374 total, up from 371 (ADR-0028's count).

---

## ADR-0028 — Continuity Overview: an at-a-glance health summary

**Date:** 2026-07-29 · **Status:** Accepted

The project owner, after actually using the Continuity view against real Orun data for the first time: "I feel like there needs to be a summary or overview included. Not sure where it should go." Scoped with two quick questions rather than guessed at — both "Recommended" options chosen: summarize Continuity health specifically (not the whole project), and place it as a new top row in the existing Continuity tree (not a new view or a separate dashboard webview).

1. **`pro/src/continuityOverview.ts`** — pure aggregation, no new detection logic. Calls the exact same functions the other four/five categories already call (`buildCanonStatusReport`, `findLocationMismatches`/`findFirstAppearanceMismatches`, `findDoublingConflicts`, `resolveNarrativeOrder`) and just counts the results. `anchoredEventCount` specifically counts events usable by As of Episode viewing (a resolvable narrative position *and* a `chronological_order`) — a preview of how much of the Timeline is actually queryable, not just how many events exist.
2. **A new `overview` category, first in the Continuity tree**, defaulting to **expanded** (`vscode.TreeItemCollapsibleState.Expanded`) unlike every other category — the whole point is a health check visible the instant the view opens, not one more thing to click through. Its five children are one-line summaries, one per category below it: Canon breakdown, Presence (scenes/scripts), Flags (open count), Doubling (conflict count), Timeline (event count + how many are as-of-episode-ready).
3. **6 new unit tests** for `buildContinuityOverview` — 371 total, up from 340 (ADR-0027's count) plus a few more from finishing out that work.
4. **An unrelated lint gap found and fixed in passing**: `eslint.config.mjs` ignored only the single literal path `resources/agents/validate.js` (the scaffolding template), not any copy of that generated file scaffolded elsewhere — a pre-existing, untracked `demos/Of_One_Blood/` sample project (not something built this session) had its own copy at a different path, failing lint with 278 bundled-code violations (`require`/`console`/`process` — expected in generated output, not source). Fixed by broadening the ignore to `**/agents/validate.js`. Not otherwise related to this ADR's feature; fixed because it was blocking a clean lint run.

---

## ADR-0027 — Client-side license-check scaffolding, backend deliberately stubbed

**Date:** 2026-07-28 · **Status:** Accepted (temporary — see caveat)

The project owner asked to stub license verification so the paid tier's gating logic could be built and tested locally while the real endpoint is being built in a separate thread against the AllStoneTech.com project (`lorefountain-business/licensing/IMPLEMENTATION_PLAN.md`). Rather than building nothing until that endpoint exists, the full client-side shape from that plan's Section 4/5 was built now, with only the actual network call faked.

1. **`src/licensing/validateLicense.ts`** — the one function meant to be swapped later. Always resolves `{ valid: true, tier: 'pro' }` regardless of the key given, with a prominent doc comment and a `docs/TODO.md` entry so this isn't forgotten before any real release. Everything else was written against this function's real, documented return contract (`valid`/`tier`/`reason`/`revalidateAfter`) so swapping its body for a real `fetch` later shouldn't require touching any caller.
2. **`src/licensing/licenseState.ts`** — the key lives in `vscode.SecretStorage` (never settings/`globalState`, since it's a credential); the last validation result is cached in `globalState`, keyed by a *hash* of the key, never the raw key. Two pure, unit-tested date-math functions (`isCacheFresh`, `isWithinGrace`) decide whether to trust the cache or re-validate, and whether a real network failure (unreachable today, since the stub never throws — this branch exists for when it can) should still trust a recent last-known-good result during a 30-day offline grace window, matching the plan's "cached locally with periodic re-validation, not on every file operation" requirement.
3. **Three new commands** (`src/commands/licensing.ts`): `lorefountain.enterLicenseKey` (prompts, stores, validates, then asks to reload the window — the pro-load decision happens once at activation, so a runtime key change needs VS Code to re-run it), `lorefountain.showLicenseStatus` (support/debugging), and `lorefountain.clearLicenseKey` (not in the original plan, added because flipping licensed/unlicensed back and forth is exactly what local testing against a stub needs).
4. **`extension.ts`'s pro-tier gating grew a second, independent gate**: previously "is `pro/` bundled at all" was the only check; now activation also awaits `getLicenseStatus` and only calls `proModule.activate(...)` if it's valid. Two distinct placeholder messages replace the old single one, depending on *why* the pro tier isn't active (no submodule vs. no/invalid license) — both the Continuity view's placeholder and `viewAsOfEpisode`'s now share one `registerProPlaceholders` helper instead of duplicating the message in two places.
5. **`activate()` is now `async`** — deciding pro-tier activation waits on `getLicenseStatus`, which is `Promise`-returning even though the stub resolves instantly. This is deliberate: the plan explicitly says never block activation on a real network call, and making this async now (while it's free) means the real endpoint drops in later without restructuring this function again.
6. **The honest caveat, stated plainly rather than buried**: right now, entering *any* text as a license key unlocks the full paid tier — `validateLicense` cannot yet tell a real key from a made-up one. This is correct and intentional for local development, and actively wrong for anything that reaches a real customer. `docs/TODO.md` carries this as a blocking item before any public/customer-facing release, alongside the pre-existing git-history-scrub item.
7. **10 new unit tests** (`isCacheFresh`/`isWithinGrace`'s date-math branches, plus two canary tests on the stub's documented behavior) — 340 total, up from 331 at the end of ADR-0026. The commands and `extension.ts` gating itself are `vscode`-facing glue, unverified live this session (see ADR-0026 point 6's same tooling-access gap — the fresh-EDH-window blocker applies here too, since this landed in the same session).

---

## ADR-0026 — Timeline/Event model (free tier) and As-of-Episode viewing (LoreFountain Pro)

**Date:** 2026-07-28 · **Status:** Accepted

The next paid-tier feature after Continuity Management, chosen specifically because it closes a gap that build deliberately left open: as-of-episode viewing (Spec §22's 5th Continuity bullet) was deferred in ADR-0025 because no Timeline/event model existed to build it on. This ADR builds that model and the feature on top of it.

1. **Timeline events are a new, separate layer, not a 6th entity type** — modeled directly on the glossary precedent (`src/model/glossary.ts`), not folded into `entityFrontmatterSchema`'s discriminated union: `src/model/timeline.ts`'s `timelineEventSchema`, one `.md` file per event under `world/timeline/` (previously a reserved-but-unindexed folder — `ENTITY_EXCLUDED_SUBDIRS` already excluded it from the entity walk; the folder path already existed in `WorkspaceFolders` since ADR-0006). Events stay plain Markdown (no Story Card editor), same posture as glossary.
2. **Four scoping decisions locked with the project owner before writing code** (matching the deliberate-design pattern from ADR-0025's continuity flags, not guessed at):
   - **Narrative position**: optional `production_code` link to the script that depicts the event (resolved against that script's *current* `Order` at query time — Production Codes are permanent, Order isn't, per ADR-0023 — never duplicated onto the event itself), with a manual `narrative_order` integer fallback for events created before any script exists to link to.
   - **Chronological position**: `chronological_order` (a relative-sequencing integer, not a real date) plus an optional free-text `in_universe_date` label — mirrors the shape `trackedFieldEntrySchema` (Spec §4.5a) already used for the same narrative-vs-chronological split, one level up.
   - **Participants**: `participants: string[]` (entity ids) — without this, as-of-episode filtering can't mean "what has *this* character experienced," only a whole-world filter, which wasn't the ask.
   - **As-of-episode algorithm**: for episode E, find the highest `chronological_order` among every event whose resolved narrative position is at or before E, then list every event at or before that cutoff involving the chosen entity (`pro/src/asOfEpisode.ts`). This is a real, deterministic algorithm — not the same kind of undecided design work that got Continuity Flags Rule 1 scoped narrowly — but it was still confirmed explicitly rather than assumed, since it's the exact ambiguity that got this bullet deferred out of the original build.
   - Every field except `name` is optional (same optional-first philosophy as entities, Spec §4.2): an event with an unresolvable narrative position or no `chronological_order` is silently excluded from cutoff derivation, never guessed at.
3. **Full free-tier plumbing added in parallel with glossary's, not bolted on**: `EventRecord` + `upsertEvent`/`removeEventByPath`/`getEventById`/`listEvents` on `IndexStore`; a JSON1-backed `events` table in `sqlJsStore.ts` (no FTS shadow table yet — nothing exposes `searchEvents`, so one wasn't speculatively added); the same CRUD in `memoryStore.ts` (headless validator); a `'event'` `IndexableFileKind`/`MentionKind` added everywhere `'glossary'` already existed in `build.ts`/`workspaceIndex.ts`/`mentions.ts`; a `Timeline` category in the World tree (`worldTreeProvider.ts`) and `lorefountain.newEvent` command, both mirroring glossary's exact pattern (closing the gap `worldTreeProvider.ts` had explicitly flagged since Phase B — the spec's TreeView row always listed "Timeline," it just had nothing to show). `cli/validate.ts`'s report and `IndexStats` both grew an event count.
4. **As-of-episode is a QuickPick command (`lorefountain.viewAsOfEpisode`), not a tree category** — it needs two inputs (which entity, which episode), which doesn't fit a browsable tree node the way the other four Continuity categories do; same interaction style as the free tier's Structured Search. A 5th **Timeline** category *was* added to the Continuity tree view alongside it, for plain dual-order browsing (every event's chronological and narrative position shown side by side) without needing to run the command just to look.
5. **A placeholder command registers when no pro module is loaded** (`extension.ts`), extending the same pattern ADR-0025 established for the Continuity view itself — `lorefountain.viewAsOfEpisode` still needs to exist in `package.json`'s `contributes.commands` unconditionally (declarations are static regardless of which tier actually built), so it must resolve to *something* even with no pro module, rather than a bare "command not found."
6. **Verified: the full free-tier path, live, in a fresh Extension Development Host** — created real event files on disk, confirmed the file watcher picks them up with no manual reindex, confirmed the Timeline category renders under World with correct display names, confirmed opening one shows plain Markdown, confirmed the inline "New Event" button appears. **Not verified live: the Pro-tier Timeline category and `viewAsOfEpisode` command.** The rebuilt `pro.js` needed a fresh EDH window to load (VS Code doesn't hot-reload a require()'d bundle), and this session's computer-use tooling could not regain OS-level focus on that specific window to close and relaunch it — `open_application` only ever re-surfaced an unrelated, already-open normal VS Code window, and the taskbar/File-Explorer access needed to switch windows another way was declined. This is a tooling gap, not a code-correctness question: both `asOfEpisode.ts` (cutoff derivation, filtering, the full pipeline) and the `continuityTreeProvider.ts` Timeline category wiring are covered by unit tests (15 new, exact-algorithm cases including the "no anchor" and "unresolvable narrative position" edge cases), and the wiring pattern is byte-for-byte the same dispatch shape already live-verified for Canon/Presence/Flags/Doubling. Worth an actual fresh-window live check before calling this visually confirmed, same posture as ADR-0025's own caveat.
7. **331 unit tests total** (316 after the free-tier Timeline work alone, +15 for `pro/src/asOfEpisode.ts` and its integration into `computeAsOfEpisode`) — up from 296 at the end of ADR-0025.

---

## ADR-0025 — Continuity Management: the first real paid-tier feature, and the pro-module architecture it validated

**Date:** 2026-07-26 · **Status:** Accepted

First real payload for the `lorefountain-pro` plumbing built in ADR-0024's follow-up (the submodule + conditional-build + runtime-loader mechanism, previously proven only with a stub). Scoped and designed with the project owner across several rounds before any code — the spec's five Continuity Management bullets (§22) turned out to be unequally ready to build, so scope was split deliberately rather than assumed.

1. **Four sub-features shipped, one deliberately deferred.** Canon Status Report, Presence Dashboard, Continuity Flags (two rules), and Doubling-Conflict Detection were built; **as-of-episode viewing was not** — it depends on the Timeline/event model (Spec §4.6), which doesn't exist yet (`world/timeline/` is still reserved and empty). Building it now would have meant quietly building part of a different paid feature first.
2. **Three of the four reuse free-tier data almost entirely** — `canon_status` and `tracked_fields` were already real schema fields with no report over them; `extractScenePresence` (the free tier's own co-presence search primitive) already parsed every scene's occupants, just never persisted across the whole workspace. The actual new paid code is thin: aggregation and a tree view, not new data modeling.
3. **Continuity Flags Rule 1 (location mismatch) is deliberately scoped to declared `located-in` relations only**, not `tracked_fields`'s time-varying position data — resolving "where were they most recently, as of this episode's Order" is real, undecided design work, since `tracked_fields` field names are a convention, not hardcoded (Spec §4.5a). Flagged as a known gap, not guessed at.
4. **Rule 2 (first-appearance mismatch) only fires when `first_appearance`'s free text happens to contain a parseable Production Code (SxEE)** — deliberately not attempting to parse arbitrary prose like "Episode 3 (first mention)" into a comparable value, which would risk false positives off a misread. Silently skipped when unparseable, same posture as every other "collect and continue, don't guess" rule in this project.
5. **Doubling-conflict detection needed a new free-tier schema field, `voice_actor`** (Character-specific, optional) — added to `model/entity.ts` alongside the existing `sound_motif`/`casting_notes` fields, since the project owner chose "add the field, detect true conflicts" over "candidates who could safely be doubled" (which would have needed no new field, but wasn't the literal spec framing).
6. **Architecture lesson learned mid-build**: `git submodule add` clones a *separate* working copy — edits to the original standalone clone used to scaffold `lorefountain-pro` never reached the submodule checkout inside `lorefountain/pro/`, which is the only one that actually matters (it's what `esbuild.js`/`tsconfig.json`/`vitest.config.ts` all point at). Lost about half an hour before catching it via a `git log` mismatch between the two directories. The standalone clone was deleted (file-locked, left for manual cleanup) to remove the footgun going forward — from here on, all `lorefountain-pro` work happens directly inside the submodule checkout.
7. **`ProActivationContext` grew by exactly one field beyond the ADR-0024 stub**: `getStoreForFolder` and a new `onIndexChanged: vscode.Event<void>` — the latter so the pro module can refresh its own views on index changes without `extension.ts` needing to know anything about what those views are. Everything else the Continuity feature needed (types, `extractScenePresence`, `buildMentionCandidates`, `getWorkspaceFolders`) was imported directly via relative paths into `../../src/...`, confirming the ADR-0024 bet that most of the interface between the two repos doesn't need to be a formal, passed-in API surface.
8. **A plain placeholder registers for `lorefountain.continuityView` when no pro module loads** — "LoreFountain Pro required," not VS Code's generic "no data provider" error. Full license-gated "grayed out" treatment (the project owner's earlier decision) is still deferred until the licensing backend exists; this is the minimum viable version of that same idea.
9. **Verified: both build paths** (pro present → bundles into `dist/pro.js` and the packaged `.vsix`; pro absent → silent skip, byte-identical to the free-tier-only build, confirmed via a full remove-and-rebuild of the entire `pro/` directory, not just `pro/src`) and **all 296 unit tests** (24 new, across the four pure-logic modules). **Live Continuity tree view: re-checked and confirmed via a clean, fresh Extension Development Host launch** (not a mid-session folder switch, which is what produced the earlier "section stopped appearing" symptom). All four categories rendered with real demo-workspace data: Canon Status correctly split entities into "Established (1)" (Sango) and "Unset (3)" (Esu, The Ark, The Orisha Pantheon); Presence showed all 4 indexed scripts with real scene-level nodes (e.g. `1x01-pilot.fountain` → "INT. THE ARK — NIGHT — Sango, The Ark"); Flags and Doubling both rendered correctly empty, since this demo data has no location/first-appearance contradictions and no entity has `voice_actor` set yet. Confirms the earlier gap was a window-reuse artifact of that specific debugging session, not a registration bug.

---

## ADR-0024 — Business-sensitive material split into a separate private repo

**Date:** 2026-07-26 · **Status:** Accepted

Raised by the project owner while planning ahead for this repo eventually going public: the free tier is code-complete, but `docs/LoreFountain_Spec.md`/`.docx` (plus `docs/archive/`'s older drafts) were tracked here and describe the entire paid-tier feature list *and* the exact licensing architecture (a license-check endpoint on AllStoneTech.com) — going public with this repo as-is would publish the whole roadmap and monetization plan before a single paid feature or the licensing backend exists.

1. **New private repo, `AllStoneTech/lorefountain-business`**, holding the product spec and the reserved space for the licensing backend — neither is public material, so neither belongs alongside the extension's own source. Paid-tier feature source itself lives in a separate private repo again (see ADR-0025), added to this one as a git submodule so a build without access to it can only ever produce the free tier.
2. **GitHub has no per-folder visibility** — a repo is all-or-nothing public or private — so a genuinely separate repo was the only way to let `lorefountain` go public without also publishing this, rather than e.g. a private subfolder.
3. **`docs/DECISIONS.md` (this file) stays in the public repo.** It's almost entirely engineering rationale for code that's actually here (storage engine, parsing library, folder conventions, the Scripts view) — reads as a genuine engineering-quality signal for an eventual public audience, not a business-sensitive leak. Checked directly before deciding: only one incidental mention of "paid-tier feature" as scoping context, nothing that discloses pricing or the roadmap itself.
4. **Two dangling references fixed** once the spec moved: this repo's own root `README.md` pointed readers at `docs/LoreFountain_Spec.md` for "the full product and technical specification" (removed — the file's gone from here now); ADR-0019's rationale for why the migration prompt is self-contained referenced "this repo's own spec doc" (reworded, since it no longer is one).
5. **Deliberately not decided or done here**: whether to scrub the spec's past versions out of *this* repo's git history (the files are removed going forward, but earlier commits in this still-private repo's history still contain them) — a history rewrite is a force-push-requiring, hard-to-reverse operation, out of scope for a same-session file-relocation task. Worth resolving before `lorefountain` actually flips to public, not before. Tracked as a concrete TODO with the exact file paths in `docs/TODO.md`, so it isn't lost between now and whenever that switch actually gets flipped.

---

## ADR-0023 — Season/Episode script structure, stable Production Codes, and the Scripts tree view

**Date:** 2026-07-26 · **Status:** Accepted

Closed out the multi-turn design conversation on how serialized scripts should be organized, ordered, and identified as they inevitably get renamed and reshuffled — worked through with the project owner before any of it was built, then implemented end-to-end while they were away ("start building... do what you need to do without asking me").

1. **One folder per episode, grouped by season**: `scripts/Season 01/1x03-the-reveal/1x03-the-reveal.fountain`, with anything else about that episode (audio, images, notes) sitting alongside it, unmanaged by LoreFountain — the same "just files, we don't need to know what they are" posture as `imports/`. Confirmed free on the indexing side before building anything: `listFilesWithExtension`'s walk is already unbounded-depth recursive and the file watcher's glob is `**/*.fountain`, so nested episode folders needed zero changes to disk-walking code — only a documented convention plus the season-grouping logic itself.
2. **Identity, order, and label are three separate things, on purpose** — the general pattern behind TV production codes, Scrivener's UUID-backed binder, and Jira/Linear's id-vs-rank split, all cited as precedent mid-conversation: a script's filename-derived id stays exactly as fragile/safe as an entity's (no new alias system — a script is never mentioned by name in prose, so nothing needed preserving across a rename); `Order` is an explicit, mutable integer for display position; `Production Code` (`SxEE`, e.g. `1x01`) is a permanent identifier assigned once and never recomputed, matching real TV convention where production code diverges from broadcast order over a show's life. All three live in the script's own standard Fountain title page — no hidden manifest, consistent with every other "don't invent state outside the files" decision this project has made.
3. **Two new cross-file checks, split by severity to match what's actually at stake**: two scripts in the same season sharing an `Order` is a warning (nothing is lost — display just falls back to filename order); two scripts anywhere sharing a Production Code is an error (an identity collision), surfaced by both the live extension's output channel and `cli/validate.ts` (which now exits 1 on it, same as a dangling relation). A third check — Production Code drift on a single incremental `reindexFile` — warns if a script's code changes between saves, the one check that's genuinely per-file rather than cross-project and so is caught immediately on save rather than only at the next full rebuild.
4. **Scripts are now stored as real records** (`ScriptRecord` in `IndexStore`, implemented in both `sqlJsStore.ts` and `memoryStore.ts`) — previously a script was only ever a mention *source*, with no queryable "list every script." This was the actual prerequisite for the Scripts tree view existing at all, not a side effect of it.
5. **The Scripts tree view uses `vscode.window.createTreeView`, not `registerTreeDataProvider`**, specifically because drag-and-drop (`vscode.TreeDragAndDropController`) is only available through that API — confirmed via research before writing any UI code, since the existing World view uses the simpler registration and would have needed switching too if drag-and-drop were ever added there. Dropping a script onto another one in the same season rewrites `Order` in every affected file's title page directly (via a new `setTitlePageField` editor in `model/script.ts`) and relies entirely on the existing `scripts/` `FileSystemWatcher` to pick up the change — the provider never touches the `IndexStore` itself. Cross-season drag-drop (which would mean moving the file, not just rewriting a field) is a deliberate, documented v1 gap rather than a half-built move operation.
6. **"New Script" auto-assigns `Order` and Production Code — a writer is never asked to type either.** It counts existing episode folders in the target season to derive both, so they can't be mistyped or accidentally duplicated by hand; this is also why the command exists instead of just telling writers to create the folder structure themselves. Agent files (`script-writer.md`) tell an AI the same thing: never hand-assign or change a Production Code, and prefer asking the writer to run "New Script" over replicating its folder/numbering logic by hand.
7. **A real bug surfaced writing the duplicate-order detection**: an early implementation encoded `(group, order)` as a single space-joined string key (`` `${group} ${order}` ``) and split it back apart on the way out — broken the moment a group name (e.g. `"Season 01"`) contains a space itself, ambiguating the split. Worse, a stray NUL byte ended up embedded in the source file during an earlier automated edit to that exact line, corrupting it silently (invisible in a normal read, `grep -c` on the binary-looking file even mis-reported line counts). Both are fixed the same way: replaced the flat string key with a nested `Map<group, Map<order, filePaths[]>>`, which needs no encoding/decoding at all.
8. Live-verified in the Extension Development Host against a seeded fixture (two seasons, a same-season duplicate `Order`, a cross-season duplicate Production Code, and a sibling artifact file): the Scripts view correctly grouped by season, sorted by `Order` with filename tie-breaking, listed the sibling file while hiding the derived `.cues.json` sidecar, opened the script on click, and the Output channel showed exactly the expected warning and error. **Not verified live**: the "New Script" input-box flow past its first prompt, and drag-and-drop reordering — both require typing or drag gestures that this session's computer-use tooling could not perform against VS Code (tier "click": no typing, no key presses, no drag-drop). Both are covered by unit tests on their underlying logic (`setTitlePageField`, the episode-counting/slug math) but not end-to-end through the real UI; flagged here rather than glossed over.

---

## ADR-0022 — `imports/` is a two-way, living folder; agent files resolve folder names from config at read time, not scaffold time

**Date:** 2026-07-25 · **Status:** Accepted

Two related corrections raised by the project owner while reviewing ORUN: (1) `imports/` was documented and prompted as a one-time, one-directional drop zone, but realistically it keeps evolving alongside `world/`/`scripts/`, in both directions; (2) scaffolded agent files baked this workspace's folder names into the file text at write time, so a later `lorefountain.config.json` edit (like ORUN's `imports` → `docs` rename) silently orphans every already-scaffolded instruction file.

1. **`agents/initiator.md` is now safe to re-run**, not a one-time script: before creating a file it also skims `world/` for an existing match, and on a likely revision it reports the discrepancy and asks the writer rather than overwriting — extending `world-builder.md`'s existing "don't overwrite without asking" rule from filename collisions to content conflicts.
2. **The reverse direction (world/scripts changes making `imports/` stale) is documented but deliberately not built.** There's no LoreFountain-specific mechanism possible here: `imports/` holds arbitrary formats (`.docx`, `.xlsx`, etc.) the extension has no parser or writer for. `AGENTS.md`, `imports.md`, and `initiator.md` now say a writer can explicitly ask an AI to update something there to match new canon, but that's generic AI file-editing, not a LoreFountain feature — the invariant that LoreFountain itself never touches `imports/` automatically is unchanged.
3. **Agent-file templates no longer get folder names substituted in at scaffold time.** `scaffoldAgentFilesIfAbsent` now copies `AGENTS.md`/`agents/*` verbatim (`src/config/agentFiles.ts`); the templates say `world/`/`scripts/`/`imports/` as literal defaults, and `AGENTS.md`'s new "Folder names" section instructs the AI to read `lorefountain.config.json`'s `folders` object itself and substitute the real names mentally wherever the other files say the defaults. This matches how `agents/validate.js` already worked (it reads the config live at run time) and closes the exact staleness gap that just bit ORUN — a config rename no longer requires touching already-scaffolded files at all, since they never hardcoded a name to begin with.
4. **`readmeFiles.ts` keeps scaffold-time substitution**, unchanged — human-facing docs are read once by a person who benefits from seeing this project's actual folder name inline, and don't get "acted on" the way an AI following stale instructions would. The `AgentFolderNames` type it depended on moved from `agentFiles.ts` (which no longer needs it) to `folders.ts` as `FolderNames`, alongside the other folder-settings types it's structurally identical to.
5. **ORUN's `lorefountain.config.json` now points `imports` at `docs`** — ORUN already had a pre-existing `docs/` folder holding its real story-bible material, and LoreFountain's own scaffolded (empty) `imports/` folder was redundant; removed. ORUN's already-scaffolded `AGENTS.md`/`agents/*.md` were left stale on purpose — resyncing them is deferred until the `scripts/` subfolder-per-episode structure (raised in the same conversation, not yet decided) is settled, so ORUN isn't synced twice.

---

## ADR-0021 — Headless validator + human-facing READMEs; LoreFountain reframed as a portable methodology

**Date:** 2026-07-25 · **Status:** Accepted

Closed the remaining gaps from the Phase F audit: an AI working file-by-file with no VS Code involved had no way to check its own work, and no human-readable explanation of what any folder was for or why. Implemented as `src/index/memoryStore.ts` + `src/cli/validate.ts` (bundled to `resources/agents/validate.js`) and `src/config/readmeFiles.ts` (`scaffoldReadmesIfAbsent`) + seven bundled templates under `resources/readmes/`.

1. **The validator reuses the real indexing logic, not a reimplementation** — `buildIndexFromDisk`, `parseEntityFile`/`parseGlossaryFile`, and `findDanglingRelations` are all shared with the live extension unchanged. The only new code is `memoryStore.ts`, a second `IndexStore` implementation with zero native/WASM dependency, built specifically so the validator avoids sql.js's `.wasm`-colocation packaging problem (the wasm file must sit wherever `__dirname` resolves post-bundling) — a portable, relocatable single-file script can't reliably replicate that trick inside an arbitrary target project.
2. **Two esbuild targets from one config**: `dist/extension.js` (unchanged, `external: ['vscode']`) and `resources/agents/validate.js` (fully self-contained, no vscode import, no external needed), each with its own build-log prefix (`[esbuild]` vs `[esbuild:validator]`) so the extension's F5 problem-matcher isn't confused by the second target's output.
3. **READMEs are scaffolded to per-folder-configured paths, not a fixed list** — unlike `agentFiles.ts` (always `agents/*.md` regardless of config), a README's target depends on this workspace's actual folder names (`world.md`'s template always lives at a fixed resource path but is written to `<configured world folder>/README.md`). `readmeFiles.ts` uses an explicit per-template target-path resolver rather than forcing this into `agentFiles.ts`'s simpler "same relative path on both sides" model.
4. **Root README frames LoreFountain as a portable methodology, not just a VS Code extension**: entity/glossary files are plain Markdown+YAML and scripts are 100% standard Fountain, checked by a validator that needs no VS Code — the extension is "the richest way to use it," not the only way. This is an accurate description of what was already true structurally, made explicit because the project owner asked whether it was true.
5. **Bug found and fixed during live verification, not by design**: the new README scaffolding wrote `README.md` directly into `world/` and `world/glossary/`, and the existing disk walk (`buildIndexFromDisk` in `build.ts`, plus the file-watcher's `classifyWorldFile` in `workspaceIndex.ts`) had no exclusion for it — every scaffolded README was parsed as a malformed entity/glossary file, in both the live extension's output channel and the headless validator. Fixed by excluding any file named `README.md` (case-insensitive) from both walks, in both places, with a regression test added to `build.test.ts`. Caught by running the validator against the demo workspace immediately after scaffolding, which is exactly the workflow `agents/*.md` now tells an AI to follow after its own edits — the bug would have shown up to any AI following those instructions, not just to manual testing.
6. Verified live in the Extension Development Host: `Initialize Workspace` against the already-populated demo workspace showed the updated modal text (mentioning READMEs and the validator), wrote all seven READMEs to their correct per-folder paths with `{{PROJECT_NAME}}` and folder-name placeholders substituted, and — after the fix in point 5 — `Rebuild Index`'s output-channel summary showed a clean entity/glossary count with no `SKIPPED` warnings for the new files.

---

## ADR-0020 — Phase F: project-level `AGENTS.md` + `agents/*.md` replace the standalone migration-only prompt

**Date:** 2026-07-25 · **Status:** Accepted

Raised by the project owner mid-Phase-F: an AI working in a LoreFountain project needs to know the entity schema and conventions for *every* creation/edit, not just the one-time migration — and that knowledge shouldn't be re-explained inside every prompt separately, or it drifts out of sync. Implemented as `src/config/agentFiles.ts` (`scaffoldAgentFilesIfAbsent`) + four bundled templates (`resources/AGENTS.md`, `resources/agents/{world-builder,script-writer,initiator}.md`), superseding ADR-0019's standalone `migrate-existing-lore-prompt.md`.

1. **Schema knowledge now lives in exactly one place**: `agents/world-builder.md` (entity/glossary format, relations-vs-mentions, ground rules) and `agents/script-writer.md` (Fountain/cue conventions). `agents/initiator.md` — the migration prompt itself — no longer inlines the schema; its first instruction is "read those two files before doing anything." This directly reverses ADR-0019 point 2's original reasoning ("the prompt must be self-contained, since the target project has no reason to contain LoreFountain's spec") — the target project *now* carries that knowledge via `agents/`, so self-containment moved from "one big prompt" to "the project plus a short pointer."
2. **`agents/initiator.md` now explicitly instructs the AI to ask scoping questions before generating anything** — skim the source material and report back what's there, ask how exhaustive the first pass should be, flag real judgment calls (real historical/public figures, conflicting documents) rather than deciding them silently. This directly reverses the gap the project owner flagged: the original migration prompt had no such instruction, and an AI (or a less careful invocation) could have just barreled through and made those calls itself, which is exactly what didn't happen during the actual ORUN migration only because a human was watching closely.
3. **Root `AGENTS.md` is a short index, not the schema itself** — it exists mainly so an AI dropped into the project cold has one obvious entry point, and because several coding tools (Cursor and others) are converging on scanning for that exact filename automatically, without anyone needing to paste a prompt at all.
4. **All four files are scaffolded by `initializeWorkspace`** (the same "create what's missing" step that already handles folders/config), with `{{WORLD_FOLDER}}`/`{{SCRIPTS_FOLDER}}`/`{{IMPORTS_FOLDER}}` placeholders substituted for this workspace's *actual* configured folder names at scaffold time — so every file is immediately readable by any AI with no leftover template syntax. The tradeoff: if folder names are reconfigured later, these files go stale until manually updated; accepted as rare and user-editable, matching `lorefountain.config.json`'s own already-accepted tradeoff.
5. **Never overwrites an existing file** (same contract as `writeDefaultConfigIfAbsent`) — protects a writer's own edits, and also means an unrelated pre-existing `AGENTS.md` from some other tool's convention is left alone rather than silently replaced. Known gap, not fixed here: if such a file already exists, LoreFountain's own instructions never get added to it; documented as an acceptable edge case rather than building markdown-merge logic for it.
6. **`migrateExistingLore` no longer reads its own bundled template** — it scaffolds the files if absent (defensive, in case `initializeWorkspace` was skipped) and then reads `agents/initiator.md` straight from the workspace, so a writer's own edits to that file are what actually gets handed to their AI, not a fixed copy baked into the extension.
7. Verified live in the Extension Development Host: running `Initialize Workspace` against the already-populated demo workspace correctly triggered the existing-folders modal (ADR-0018), and on confirming, wrote `AGENTS.md` + all three `agents/*.md` files with real folder names substituted; running `Migrate Existing Lore` immediately afterward opened that exact scaffolded file, confirming the two commands now share one source of truth.

---

## ADR-0019 — Phase F: migration prompt is a static template + find/replace, not agent-driven generation

**Date:** 2026-07-24 · **Status:** Accepted

Spec §13.5's "Migrate Existing Lore" command implemented as a single static
template (`resources/migrate-existing-lore-prompt.md`) + `src/commands/migrateExistingLore.ts`,
which only substitutes this workspace's actual `imports`/`world` folder
names into the template, copies the result to the clipboard, and opens it
for reference.

1. **The command does not itself read any source documents or generate any
   entity files.** The spec is explicit that this ships as "a premade,
   ready-to-run prompt... AI-agnostic — plain natural-language instructions
   with no tool-specific syntax" — the migration work happens in whichever
   AI coding agent the writer pastes the prompt into, which may not be
   LoreFountain's own host editor at all. Building an in-extension
   generator would be a different, un-asked-for feature (and would tie the
   free tier to a specific AI provider, which the spec explicitly rejects
   for this workflow, citing FictionLab.net's own AI-agnostic positioning
   as precedent).
2. **The template inlines the full entity/glossary schema in plain
   English** (every field from `model/entity.ts`'s discriminated union and
   `model/glossary.ts`, including which fields are type-specific) rather
   than referencing the product spec (which, per ADR-0024, doesn't even
   live in this repo) — the prompt must be self-contained, since the target
   project (someone's own story-bible folder) has no reason to contain
   LoreFountain's spec.
3. **Explicit ground rules against fabrication**: "never invent facts,"
   omit an uncertain field rather than guess it, skip a file that already
   exists rather than overwrite it. These aren't in the spec bullet
   verbatim but follow directly from files-as-truth (§2) and from this
   being a one-time batch conversion of someone's real, often-irreplaceable
   creative material — an agent given this prompt should behave
   conservatively by default.
4. **`{{IMPORTS_FOLDER}}`/`{{WORLD_FOLDER}}` placeholders** are resolved to
   this workspace's actual configured folder names (not hardcoded
   `imports`/`world`) via simple string substitution — no templating
   library needed for two placeholders.
5. Verified live in the Extension Development Host: the command opened an
   untitled Markdown document with both placeholders correctly resolved to
   the demo workspace's actual folder names, and copied the identical text
   to the clipboard.

---

## ADR-0018 — Pre-Phase-F: initialization asks before adopting pre-existing `world`/`scripts` folders

**Date:** 2026-07-24 · **Status:** Accepted

Raised by the project owner immediately before Phase F (the real ORUN dogfood): "this
project should never modify the import directory... if it's pointed into an
existing directory it should not modify any files outside of its core
folders... if there are existing world and scripts folder it should ask
initially." Concrete trigger: ORUN's real project folder has its own `docs/` folder
with existing bible/outline documents that must never be touched, and could
plausibly already have `world`/`scripts` folders of its own by the time
LoreFountain is pointed at it for real.

1. **Audit confirmed the codebase was already compliant except for one
   gap.** `build.ts` only ever walks `folders.world`/`folders.glossary`/
   `folders.scripts` — never `imports/`, never anything else at the
   workspace root — and nothing anywhere writes into `imports/` beyond
   creating it empty once. The one real gap: `initializeWorkspace`
   (`extension.ts`) would `mkdir(recursive: true)` (a safe no-op if the
   folder already exists) and index whatever was there **without ever
   telling the user it was adopting a pre-existing folder it didn't
   create.**
2. **Fix**: `src/config/existingFolders.ts` (pure, `detectExistingCoreFolders`)
   checks whether the resolved `world`/`scripts` paths already exist before
   `initializeWorkspace` does anything. If either does, a **modal**
   warning (`{ modal: true }` — deliberately not dismissible by accident,
   since this is a real "does this fold into my existing project or not"
   decision) names which folder(s) were found and states the invariant
   directly ("LoreFountain never touches anything outside its own
   folders"), with a single affirmative action ("Use Existing Folder(s)");
   anything else (Cancel, Escape, click-away) aborts with zero writes.
3. **Scope stayed tight to what was asked**: the check only gates the
   *initialization* command (the only place that creates anything).
   Normal activation/indexing was already read-only with respect to
   `world`/`scripts` content (only the cue sidecar, E5, writes anywhere
   near a script — and only a new `.cues.json`, never touching the script
   itself) and doesn't need a prompt.
4. Verified live in the Extension Development Host against a throwaway
   test folder built specifically to simulate this scenario (a pre-existing
   `world/some-preexisting-file.md`, `scripts/preexisting.fountain`, and an
   unrelated `docs/notes.txt`): the modal appeared naming both folders;
   **Cancel** left the entire filesystem byte-for-byte unchanged (no
   config, no subfolders, no touched files); **Use Existing Folder(s)**
   created only `imports/`, `world/glossary`, `world/notes`,
   `world/timeline`, and `lorefountain.config.json` — the pre-existing
   `some-preexisting-file.md`, `preexisting.fountain`, and `docs/notes.txt`
   were all confirmed untouched (identical content) afterward.

---

## ADR-0017 — Phase E8: walkthrough substitutes the graph view with World-tree browsing; sample content is original, not ORUN's

**Date:** 2026-07-24 · **Status:** Accepted

Spec §20's walkthrough + sample workspace implemented via
`contributes.walkthroughs` (native VS Code "Get Started" surface, no
webview) + `src/commands/tryLoreFountain.ts` (scaffolds and opens a new
folder).

1. **The suggested flow's third step — "open the graph view" — is
   replaced with "browse the World view.**" The graph view is an
   explicitly paid-tier feature (Spec §1.3) that doesn't exist in this
   build; substituting the actual free-tier capstone (the World tree,
   Phase D4) keeps the walkthrough honest about what this install can
   actually do, rather than promising a feature behind a paywall. A "Try a
   Sample World" step was added ahead of the spec's three, since §20 pairs
   the walkthrough with the sample-workspace command as its natural first
   move.
2. **Each step ships a short Markdown `media` file** under
   `resources/walkthrough/` rather than an image/SVG — no visual assets
   needed, and Markdown media renders directly in the walkthrough's detail
   pane.
3. **Completion events use `onCommand:`/`onView:`** where a natural trigger
   exists (trying the sample, creating any entity type, opening the World
   view); the "Link It in a Script" step has none — there's no reliable
   single command/view event for "wrote a wikilink," so it's left as a
   purely informational step the user can mark done manually, a supported
   walkthrough pattern.
4. **The sample workspace's content is original** (a small sci-fi
   freighter-pilot setup — "Nova Reyes," "The Wayfarer," a "Jump Drive"
   glossary term), not built from the user's own ORUN material used
   elsewhere in this session's manually-created `lorefountain-demo`
   workspace. A shipped, product-bundled sample must never embed a real
   user's creative IP.
5. **`tryLoreFountain` prompts for a parent directory via
   `showOpenDialog`**, creates `<chosen>/lorefountain-sample/`, scaffolds
   it by reusing `resolveWorkspaceFolders` and `writeDefaultConfigIfAbsent`
   (both already `vscode`-free, callable against a path that isn't yet an
   open workspace folder), and opens it via `vscode.commands.executeCommand('vscode.openFolder', ...)`.
   Refuses to silently overwrite an existing same-named folder — asks
   before opening it anyway.
6. Verified live end-to-end: **Help → Open Walkthrough… → "Get Started
   with LoreFountain"** renders with the correct title, description, and
   all four steps; clicking **Try LoreFountain** opened a folder picker
   titled "Choose a location for the sample LoreFountain workspace" with a
   custom "Create Sample Workspace Here" button, created the folder, and
   opened it in a new window with `world/`, `scripts/`, `glossary/`, both
   sample entities, the glossary term, and the sample script all present —
   and, cross-validating two earlier features in the same pass, the git-
   safety banner (ADR-0011) correctly fired for the fresh ungitted folder
   and a cue sidecar (ADR-0014) was auto-generated for the sample script's
   `SFX:` cue. The walkthrough step's own "Try a Sample World" checkbox
   correctly flipped to completed after the command ran.

---

## ADR-0016 — Phase E7: structured search is scenes-by-scene-heading + reused mention-matching, entirely QuickPick-driven

**Date:** 2026-07-24 · **Status:** Accepted

Spec §13.6 asks for co-presence ("Sango and Esu in the same room") and
mention-line search exposed as their own named feature, not left implicit
inside generic full-text search. Implemented as `src/search/structuredSearch.ts`
(pure) + `src/commands/structuredSearch.ts` (vscode-facing).

1. **"Same room" = same scene, and a scene = the span between one
   `scene_heading` token and the next** (or end-of-file), reusing
   `parseFountain`/`mapTokensToPositions` from ADR-0002's groundwork — the
   first real consumer of that position-recovery layer beyond hover. A
   script with no scene headings is treated as one implicit scene rather
   than producing zero results.
2. **Both search modes reuse `index/mentions.ts`'s exact whole-word
   matcher** — `extractMentionTargets` for "who's mentioned anywhere in
   this scene's text", `findMentionOccurrences` for "which lines mention
   this specific candidate" — rather than building separate matching logic.
   This is the same primitive the live index already uses, just applied
   per-scene-span or reported per-line instead of per-file.
3. **"Cross-episode" is read as scoped to `.fountain` scripts only**, not
   `world/` entity/glossary prose — an "episode" is a script; the spec's
   own two examples ("scene", "line") are both script-native concepts with
   no obvious equivalent in a Markdown entity file.
4. **Entirely QuickPick/menu-driven with no free-text input** — mode
   selection, then entity selection(s), all via `showQuickPick` populated
   from `buildMentionCandidates` (already exported from `build.ts` for
   Phase C's hover/completion). This made it the first Phase E command
   fully verifiable in this sandbox with no typing-restriction caveat.
5. Verified live in the Extension Development Host, both modes, via the
   World view's "..." overflow: "scenes with both Esu and Sango" correctly
   found the one scene mentioning both (`1x01.fountain`'s bridge scene);
   "every line mentioning The Ark" correctly found the one line (the scene
   heading itself, `INT. THE ARK - BRIDGE - NIGHT`) with no false positives
   from other entities.

---

## ADR-0015 — Phase E6: transcript export keeps scene headings as section breaks; "dialogue only" excludes everything else

**Date:** 2026-07-24 · **Status:** Accepted

Spec §16's transcript export ("dialogue only, cues stripped") implemented as
`src/export/transcript.ts` (pure — builds entries from a token stream, then
serializes to Markdown) + `src/commands/exportTranscript.ts` (vscode-facing).

1. **"Dialogue only" is read literally**: only `character`/`dialogue`
   token pairs become content. Action lines (where the SFX:/MUSIC:/AMB:
   convention lives, Spec §15), transitions, and parentheticals (performance
   direction, never spoken) are all excluded — not just the cue lines the
   spec bullet names explicitly.
2. **Scene headings are kept as Markdown section headers**, despite not
   being "dialogue" — a deliberate exception, since §16's named audiences
   (accessibility, publishing, show notes) all benefit from knowing where
   one scene ends and the next begins, and a heading is clearly
   distinguishable from spoken content in the output (`##` vs `**NAME:**`).
3. **Target script resolution**: the active editor if it's a `.fountain`
   document, else a `QuickPick` over every script found across all open
   workspace folders (reusing `listFilesWithExtension`, exported from
   `build.ts` for E4's rename command and now reused a second time).
4. **Output goes through `vscode.window.showSaveDialog`**, not a fixed
   path — gives the writer a chance to pick where the transcript lands,
   pre-filled with `<script>.transcript.md` next to the source script as a
   sensible default.
5. **Surfaced via an `editor/title` icon** (`$(book)`) when a `.fountain`
   file is active, in addition to the Command Palette. Verified live: the
   command itself, invoked via a temporary duplicate placement in the
   World view's overflow menu (proven reliable in ADR-0013's testing),
   correctly resolved the active editor's script, opened a save dialog
   pre-filled with `1x01.transcript.md`, and produced a transcript with
   `SFX:`/`MUSIC:` lines correctly stripped and dialogue correctly
   attributed. **The `editor/title` icon's own visibility could not be
   confirmed** in this specific sandboxed dev host — its toolbar row was
   crowded with several other installed extensions' own icons (GitLens,
   Markdown Preview Enhanced, etc.), a plausible and mundane explanation
   distinct from the typing-restriction gaps noted elsewhere, but not
   something this session could fully rule out. The command is reachable
   regardless via the Command Palette (an independent registration path
   from the menu contribution), so this is a coverage gap in one discovery
   surface, not in the feature itself.

---

## ADR-0014 — Phase E5: snippets over a custom completion provider; sidecar regeneration piggybacks on existing script reads

**Date:** 2026-07-24 · **Status:** Accepted

Spec §13.9 (structured cue insertion) + §15 (cue sidecar) implemented as
`resources/fountain-cues.code-snippets` + `src/cues/parseCues.ts` (pure
extraction) + `src/cues/sidecar.ts` (fs-touching, no `vscode` dependency).

1. **Cue insertion uses VS Code's native `contributes.snippets`**, not a
   custom `CompletionItemProvider` like hover/wikilink completion (Phase C).
   The spec's own framing — "the same reasoning that makes a code snippet
   expanding a boilerplate block feel like a convenience" — points straight
   at the stock mechanism built for exactly this, including free tab-stops
   for the variable part and (for MUSIC) a native choice list
   (`${1|IN,OUT,STING,UNDER|}`) with zero custom code.
2. **Sidecar generation piggybacks on every place `build.ts` already reads
   a script's text** (the full-build loop and `reindexFile`'s script
   branch) rather than being a separate pass — the text is already in
   memory, so this is a same-cost addition, and it guarantees the sidecar
   can never observe a different version of the script than the index just
   did. Removal is wired separately into `workspaceIndex.ts`'s script
   delete-watcher, since `build.ts`'s `removeFileFromIndex` is synchronous
   and shared across all three file kinds — kept that contract unchanged
   rather than making it async for this one case.
3. **A sidecar is deleted, not written with an empty `cues` array, once a
   script has no cues left** — avoids leaving an empty, permanently-stale
   `.cues.json` next to every script that happens not to use the
   convention (plausible for non-cue-heavy scenes or early drafts).
4. **`*.cues.json` is gitignored**, consistent with the SQL index's own
   "derived, rebuildable, never authoritative" treatment (Spec §2.2) —
   regenerated automatically on the next activation/rebuild regardless.
5. Verified live in the Extension Development Host: adding `SFX:`, `MUSIC:
   <modifier> - ...`, and `AMB:` lines to the demo script produced a
   correct `1x01.cues.json` on activation (including a plain SFX
   description untouched by the modifier logic, since SFX has none per
   §15.1's table); editing the script while the window stayed open
   triggered the file watcher and regenerated the sidecar with the new cue,
   with no manual rebuild needed. **Not live-tested:** actually typing
   `sfx`/`mus`/`amb` + Tab to confirm the snippet body/choice-list expands
   as authored — same typing restriction as every other input-driven flow
   this session; snippet JSON was validated for correct syntax instead.

---

## ADR-0013 — Phase E4: rename rewrites relations + wikilinks only; plain-text mentions get an alias, not a silent edit

**Date:** 2026-07-24 · **Status:** Accepted

Spec §13.3 asks for a rename command that "rewrites known references (mentions
and typed relations)... where safely detectable," plus a broken-reference
report for what isn't. `src/refactor/renameEntity.ts` (pure) +
`src/commands/renameEntity.ts` (vscode-facing) implement this with a
deliberately narrower definition of "safely detectable" than "anything the
mention engine can find":

1. **Auto-rewritten:** the renamed entity's own file (moved + frontmatter
   `name` updated), every other entity's `relations[].target` matching the
   old id (exact id string match — metadata, unambiguous), and every
   explicit `[[wikilink]]` occurrence of the old name anywhere (world
   bodies, glossary bodies, `.fountain` scripts) — a deliberate, structural
   marker the writer chose specifically to mean "link to this entity."
2. **Never auto-rewritten:** bare plain-text mentions inside prose (a
   script's dialogue/action lines, another entity's free-text body) — found
   using the exact same whole-word matcher `mentions.ts` already uses for
   indexing (so detection isn't the limiting factor), but left untouched on
   principle: a screenplay's own prose shouldn't be silently bulk-edited by
   a rename command. This is the spec's own example of what belongs in the
   broken-reference report.
3. **The old name is kept as an alias** on the renamed entity (deduped,
   case-insensitive) specifically so those untouched plain-text mentions
   *keep resolving* — nothing goes dark the moment a name changes. The
   rename's report is reframed accordingly: it lists files still using the
   old name as "still recognized via alias, update the wording if you'd
   like" rather than "broken," since with the alias in place nothing
   actually is. This is a deliberate enhancement beyond the spec's literal
   wording, judged a strictly better outcome for the writer with no real
   downside (the alias is a normal, editable frontmatter field).
4. **The whole operation is one `vscode.WorkspaceEdit`** (rename-file +
   whole-document `replace` on every touched file), applied and then saved
   atomically — extending the exact whole-document-replace pattern
   `storyCardEditorProvider.ts` already established, to multiple files.
   The file-move is sequenced *before* the content edit (rather than
   content-then-move) specifically to avoid relying on undocumented
   behavior for whether a text edit's dirty buffer survives a same-URI
   rename within one edit — each operation now targets a URI that stays
   stable for its own step.
5. **"Show Broken References" is a separate, standalone command**, not
   just a rename side-effect — it re-exposes the dangling-relation
   detection already built for Phase B4 (`src/index/relations.ts`) as an
   on-demand report, so a writer can check for drift anytime (a relation
   target renamed/deleted outside the tool, a hand-edited file), not only
   immediately after using the rename command. Verified live in the
   Extension Development Host via the World view's "..." menu: a
   deliberately-added dangling relation (`Sango` -> `rival: orunmila`,
   `orunmila` not a real entity) is correctly reported with folder name,
   file path, relation type, and target.
6. **Not live-tested:** the rename command's `showInputBox` flow itself
   (typing a new name) and its right-click context-menu entry (right-click
   is blocked at this sandbox's tier, separate from the typing
   restriction) — same accepted gap as ADR-0009/ADR-0012's creation
   commands. Mitigated by an unusually careful manual code review (this
   command is the most structurally complex one shipped so far) plus full
   coverage of the underlying pure rewrite logic (10 unit tests covering
   wikilink rewriting, stale-mention detection, relation retargeting, and
   alias deduplication).

---

## ADR-0012 — Phase E3: notes stay disk-only (never indexed); tree lists them live; promotion never deletes the source

**Date:** 2026-07-24 · **Status:** Accepted

Spec §13.4's `/world/notes` scratch space turned out to be mostly already
built: `ENTITY_EXCLUDED_SUBDIRS` in `src/index/build.ts` (Phase B) already
excludes `notes/` from entity parsing/validation entirely — free-form
Markdown with no schema was already true before Phase E started. What Phase
E3 actually adds is the writer-facing workflow the spec implies around that
folder: `src/commands/notes.ts` ("New Note", "Promote Note to Entity") and a
new "Notes" category in `WorldTreeProvider`.

1. **The Notes category reads the folder straight off disk on every
   expand**, not from the `IndexStore` like every other category — there's
   nothing to read from the store, since notes are deliberately never
   indexed. `getChildren` is now `async` throughout to support this.
2. **"Promote Note to Entity" never deletes the original note.** Copies the
   note's raw text into the new entity's body (via `createEntity` +
   mutating `entity.body` + `writeEntity`, rather than adding a body
   parameter to `createEntity` itself) and tells the writer the note is
   unchanged. Consistent with `entities/service.ts`'s own stated
   philosophy ("no delete operation... files-as-truth means Explorer
   already covers it") and with this project's general caution around
   destructive actions — an extra orphaned note file is a trivial cleanup;
   silently losing a half-formed idea to a promotion bug is not.
3. **`titleizeSlug` added to `model/slug.ts`** (an approximate inverse of
   `slugify`) since notes have no stored display name — the tree and the
   "Promote" command's default name both need to turn a filename like
   `hidden-fourth-deck.md` back into "Hidden Fourth Deck" for display.
4. Verified live in the Extension Development Host: a note written directly
   to `world/notes/` appears under the new "Notes" category after a
   rebuild, stays out of the indexed entity/glossary/script counts, opens
   as plain Markdown (no Story Card editor), and shows the "Promote Note to
   Entity" inline action. The two `showInputBox`/`showQuickPick`-driven
   flows ("New Note"'s title prompt, "Promote"'s type/name prompts) are
   **not** live-tested, for the same reason as Phase D's creation commands
   (ADR-0009) — this sandbox's browser-automation can click but not type
   into the Extension Development Host. Same accepted gap, not a new one.

---

## ADR-0011 — Phase E2: git-safety check scope, "other backup mechanism" definition, and the "checkbox" as a button

**Date:** 2026-07-24 · **Status:** Accepted

Spec §13.7 requires a persistent warning when a workspace has no git repo and
no other backup mechanism, but leaves "other recognized backup mechanism"
and the dismissal "checkbox" unspecified. Implemented in
`src/safety/backupCheck.ts` (pure) + `src/safety/gitSafetyBanner.ts`
(vscode-facing), wired into `addIndexFor` in `extension.ts` so it runs once
per workspace folder on every activation:

1. **"Other backup mechanism" = git found anywhere at or above the folder
   (not just directly in it — a workspace folder may be a subdirectory of a
   larger repo) OR the folder path contains a recognized consumer
   cloud-sync marker** (OneDrive, Dropbox, Google Drive, iCloud Drive).
   Heuristic and not exhaustive by necessity — the spec doesn't enumerate a
   list — but low-risk (path-string/`.git`-existence checks only, no
   network calls) and documented here as the concrete definition.
2. **The dismissal "checkbox" is implemented as a second button** ("Don't
   ask again for this workspace") on the same `showWarningMessage`, not a
   literal checkbox — VS Code's non-modal notification API has no checkbox
   control. Functionally equivalent: persists a per-workspace-folder flag in
   `context.workspaceState`, keyed by folder URI so multi-root workspaces
   dismiss independently.
3. **"Initialize Git" delegates to the built-in Git extension's own
   `git.init` command** rather than shelling out to the `git` binary
   ourselves — reuses the user's existing Git integration (handles
   multi-root prompts, PATH resolution, etc.) instead of duplicating it.
4. **Scoped to folders that already have a `scripts` or `world` folder on
   disk** (per the spec's own wording), so a workspace that hasn't run
   `initializeWorkspace` yet doesn't get warned before it has anything to
   protect.
5. Verified live in the Extension Development Host: an ungitted, non-cloud
   workspace shows the banner every fresh launch; clicking "Don't ask again"
   suppresses it on a full process restart (not just for the current
   session), confirming the `workspaceState` persistence.

---

## ADR-0010 — Phase E1: hand-written TextMate grammar, shape-heuristic only, no runtime toggle

**Date:** 2026-07-24 · **Status:** Accepted

Fountain syntax highlighting (deferred from Phase C per ADR-0008) is now
shipped via a hand-written `resources/fountain.tmLanguage.json`, registered
in `package.json`'s `contributes.grammars` for the `fountain` language id.

1. **Written fresh against the public Fountain spec (fountain.io), not
   copied from Better Fountain's grammar.** Scene headings, transitions, and
   character cues are matched by *shape* (ALL CAPS, `INT./EXT.` prefixes,
   `TO:` suffixes) rather than by the full two-pass "preceded/followed by a
   blank line" Fountain rule — TextMate grammars tokenize per-line and can't
   reliably express that cross-line context. This is the same heuristic
   every other Fountain syntax highlighter (including Better Fountain) uses;
   our own `src/fountain/parse.ts` still does the real, position-accurate
   parse for hover/completion/mentions, so this file is presentation-only.
2. **The SFX:/MUSIC:/AMB: cue convention (§15.1) gets its own scope**
   (`support.function.cue-prefix.lorefountain`) distinct from plain action
   text, plus the MUSIC modifiers (IN/OUT/STING/UNDER) — a deliberate,
   product-specific touch beyond generic Fountain highlighting, since this
   convention is load-bearing for the cue sidecar (Phase E5).
3. **No runtime enable/disable setting**, unlike hover/completion
   (ADR-0003). VS Code's `contributes.grammars` is a static contribution
   with no `when` clause and no `vscode.languages.register*`-style API for
   grammars — there is no mechanism to conditionally register or unregister
   one at runtime. Ships default-on; if a user has Better Fountain installed
   too, VS Code's own extension-priority rules (undocumented, generally
   last-registered-wins) decide which grammar renders — same accepted risk
   already noted in ADR-0003 for the `fountain` language-configuration.
4. Verified visually in the Extension Development Host (not unit-testable):
   scene headings, transitions, character cues (incl. `(V.O.)` extensions),
   parentheticals, `[[notes]]`, `/* boneyard */`, centered text, lyrics,
   title-page keys, cue prefixes + modifiers, and `*italic*`/`**bold**`/
   `_underline_` emphasis all render distinctly against a throwaway test
   fixture, then removed.

---

## ADR-0009 — Phase D scope: Story Card editor is entity-only; selector matches the default `world/` layout only

**Date:** 2026-07-23 · **Status:** Accepted

**Decisions made while implementing Phase D (entity CRUD, creation commands,
the Story Card custom editor, the World TreeView):**

1. **The Story Card `CustomTextEditorProvider` is entity-only** — glossary
   terms (Spec §4.7) stay plain Markdown with no custom editor, consistent
   with their own "lightweight... just a definition" characterization.
   Building a second, lighter-weight custom editor for glossary terms was
   judged not worth the additional surface for what §4.7 already frames as a
   file simple enough to hand-edit directly. Creating a term via the tree's
   "New Glossary Term" command opens it as plain text, not a form.

2. **`customEditors` selector matches `**/world/*.md`** (direct children of a
   folder named `world` only) rather than `**/world/**/*.md`. This is
   deliberate, not an oversight: VS Code's `customEditors` contribution is
   static (evaluated before the extension activates), so it can't be scoped
   to the user's *configured* `world` folder name (ADR-0006) at runtime — this
   selector targets the *documented default* layout. The specific glob was
   chosen because a single `*` (not `**`) between `world/` and the filename
   naturally excludes `world/glossary/`, `world/timeline/`, and `world/notes/`
   (all one level deeper) without needing negative-match glob syntax, which
   `filenamePattern` doesn't support. The known gap: an entity file nested in
   a user-created subfolder under `world/` (e.g. `world/characters/sango.md`
   — which `build.ts`'s recursive walk already indexes fine) won't get the
   Story Card editor as its *default*, though "Reopen Editor With…" still
   works for any `.md` file broadly speaking once the extension is active.
   Revisit if real dogfooding shows subfolder organization is common enough
   to be worth a dynamic, per-workspace registration.

3. **The TreeView (Spec §6) omits the "Timeline" category** the spec's table
   names alongside Characters/Locations/Factions — no Event/timeline entity
   model exists yet (`world/timeline/` has been explicitly unindexed since
   Phase B). Shown once that model exists, not as an empty placeholder now.

**Verified manually in the real Extension Development Host** (click-based
checks only — text-input edits and the creation commands' name-prompt flow
are blocked by this session's click-tier sandboxing, not exercised live):
the World tree renders all 6 categories with correct icons and inline
"New X" buttons; a Character and a Location entity both opened correct,
fully-populated Story Cards with the right type-specific fields shown/hidden;
the relationship picker listed every entity across all types; editing it via
clicks (add/select-target/save) round-tripped correctly to disk, including
the exact "drop a relation row missing a relation type" rule confirmed by
unit tests; a glossary term opened as plain text, not a Story Card.

**Revisit if:** the entity-creation commands' name-prompt flow (`showInputBox`)
turns out to have an issue only visible via real typed input — this remains
the one meaningfully untested path in Phase D and should get a pass whenever
this session's tooling allows typed interaction, or via the user's own
dogfooding.

---

## ADR-0008 — Phase C scope: hover/completion broader than literal spec wording; no syntax grammar yet

**Date:** 2026-07-23 · **Status:** Accepted

**Decisions made while implementing Phase C (parse, hover, completion, backlinks):**

1. **Hover fires on any recognized mention anywhere in a `.fountain` file**
   (character cues, dialogue, action lines, scene headings, `[[wikilinks]]`) —
   not literally restricted to "character cue" as §6's table row names it.
   Mentions are already defined as automatic/lightweight/no-manual-step
   (§4.5); restricting hover to only one syntactic position would be an
   arbitrary carve-out of that same mechanism, not a meaningfully different
   feature. Implemented as one pass over the raw document text via
   `index/mentions.ts`'s `findMentionOccurrences` — no Fountain-structural
   parsing needed to find a hover target.

2. **Wikilink completion (`[[`) is registered for `{ language: 'markdown' }`
   broadly**, not narrowed to files under the configured `world/` folder
   specifically, even though §13.2 frames it as "inside scripts and inside
   world files." A dynamic per-workspace glob (since `world/` is a
   user-configurable path, ADR-0006) would need re-registration on every
   config change for marginal benefit — offering entity links from any
   Markdown note in a LoreFountain-enabled workspace is a reasonable,
   low-risk superset, not a meaningfully wrong behavior.

3. **No TextMate grammar shipped yet.** ADR-0003 committed to eventually
   shipping our own syntax highlighting (with a `lorefountain.highlighting.enabled`
   toggle, mechanism TBD). Phase C ships the `fountain` language
   registration + `language-configuration.json` (needed for hover/completion
   to target the language at all) but not the grammar itself — a
   `.fountain` file with only this extension installed shows as unstyled
   plain text. This is a real, visible gap for a user without Better
   Fountain also installed, not hidden — revisit before considering the free
   tier UI-complete.

**C1 (`src/fountain/parse.ts`) is built but not yet consumed by hover/completion** —
those work directly against raw text via `mentions.ts`, which needs no
Fountain-structural awareness to find a match. The parse module (token
stream + position recovery, verified against dual dialogue, a `(V.O.)`
extension, and boneyard-comment exclusion) exists as promised groundwork for
future structural features (outline, folding, a presence/cue index), per its
own module doc comment.

**C4 extends mentions to `.fountain` scripts** as mention *sources* (never
targets, never stored as a record) — a script contributing to an entity's
backlinks the same way an entity/glossary body does. Verified manually: a
script's own repeated mentions of an entity correctly appear once in that
entity's "Mentioned in" hover line.

**Revisit if:** dogfooding on the real ORUN corpus shows hover firing on
every scene-heading location name is noisy rather than useful, or shows
completion polluting unrelated Markdown notes — both are easy to narrow later
since the underlying candidate/matching logic doesn't change.

---

## ADR-0007 — Mentions (Spec §4.5): full rebuild is exact, incremental reindex is per-file only

**Date:** 2026-07-23 · **Status:** Accepted

**Decision.** `src/index/mentions.ts` detects automatic mentions via a single
Unicode-aware, whole-word, case-insensitive regex built from every known
entity/glossary name + alias (`src/index/build.ts`'s `buildMentionCandidates`).
A full `buildIndexFromDisk` pass always recomputes every source's outgoing
mentions against the complete, final candidate list — cross-file mentions are
exactly correct after a full rebuild. An incremental `reindexFile` (the
file-watcher path) only recomputes the *changed* file's own outgoing mentions
against whatever candidates are currently known. If that file introduces a
brand-new entity name, other files that already mention that name in plain
prose do not retroactively gain a mention edge until they are themselves
reindexed or a full rebuild runs.

**Why.** This is a deliberate v1 simplification, not an oversight. Recomputing
every other file's mentions whenever one entity is added/renamed would mean
re-reading and re-scanning the entire indexed corpus on every keystroke-driven
save — disproportionate cost for a case (an old file's plain-text mention of a
name that only later became a real entity) that's inherently rare and already
self-corrects on the next full rebuild. "Rebuild Index" is the documented,
always-correct escape valve, consistent with the index being disposable and
rebuildable by design (Spec §2.2, ADR-0001).

**Also decided:** dangling `relations` targets (Spec §4.5 — deliberate, typed
links, distinct from automatic mentions) are detected the same way — a full
pass across every entity after a full build, or immediately for a single
entity on incremental reindex — and reported via `IndexBuildSummary`/
`ReindexFileResult`, never rejected (Spec §23).

**Verified:** 99 unit tests (mentions matching edge cases, dangling-relation
detection, sql.js mentions/backlinks CRUD) plus a manual Extension Development
Host check — a real dangling relation (`target: ghost-entity`) was correctly
flagged while a valid one (`target: sango`) was not.

**Revisit if:** real dogfooding on the ORUN corpus shows the "reindex to fully
propagate" lag is actually disruptive in practice — the fix would be scoped to
`buildMentionCandidates`'s caller, not the matching algorithm itself.

---

## ADR-0006 — `lorefountain.config.json` replaces VS Code settings for project config; activation triggers on it (or a bare `.fountain` script)

**Date:** 2026-07-22 · **Status:** Accepted

**Decision.** All customizable LoreFountain options (currently just `folders`)
live in a single project-owned `lorefountain.config.json` at the workspace
root, not VS Code's `lorefountain.folders.*` settings (removed). The extension
activates on `workspaceContains:lorefountain.config.json` **or**
`workspaceContains:**/*.fountain` (the project owner, 2026-07-22, chose the OR over
config-file-only, to smooth onboarding for an existing script-only project).
A `lorefountain.initializeWorkspace` command scaffolds the standard folders and
writes a default config file for a brand-new, completely empty workspace —
necessary because activation events can't fire on a workspace with neither
signal yet, but VS Code auto-activates any extension the moment one of its
contributed commands is invoked from the Command Palette, independent of
`activationEvents`.

**Why the pivot.** The original `activationEvents` (`workspaceContains:world/**`,
`workspaceContains:scripts/**`) were a real bug, caught via manual testing in
the Extension Development Host: `scripts/` is an extremely common folder name
in totally unrelated JS/TS/Python repos (build/deploy scripts), so the
extension would have activated in countless projects that have nothing to do
with LoreFountain. A dedicated config file is a deliberate, precise signal
instead of a folder-name heuristic — and, per Spec §2.1's files-as-truth
principle, a plain project-owned JSON file is more portable and more
AI-agent-readable than editor-specific settings.json.

**Supporting pieces added:**
- `src/config/configFile.ts` — pure, tolerant read (`readLoreFountainConfig`,
  never throws on missing/malformed/invalid-schema) and
  `writeDefaultConfigIfAbsent` (never clobbers an existing file).
- `resources/lorefountain.config.schema.json` + a `contributes.jsonValidation`
  manifest entry, so editing the file in VS Code gets autocomplete/validation
  without needing an in-file `$schema` reference (which can't portably point
  at the extension's own install path from the user's workspace).

**Verified (manual, Extension Development Host, 2026-07-22):** a workspace
with only a generic `scripts/` folder + `package.json` no longer activates the
extension (confirmed absent from Running Extensions). A workspace with a
hand-authored config setting `folders.world` to `"bible"` activated and
correctly indexed the entity file found there (not under `world/`).

**Revisit if:** more config keys are added beyond `folders` — the schema/Zod
validation is already structured to extend without a breaking change
(`catchall(z.unknown())` preserves unknown keys today).

---

## ADR-0005 — Full-text search: FTS3 (via sql.js) for v1, not FTS5

**Date:** 2026-07-22 · **Status:** Accepted

**Decision.** The local index's full-text search (Spec §2.2) uses FTS3, not
FTS5, for v1 — keeping `sql.js` (ADR-0001) rather than swapping engines.

**Context.** Implementing B3 surfaced that the default `sql.js` npm package is
compiled with `ENABLE_FTS3` but not `ENABLE_FTS5` (see the correction on
ADR-0001). Two ways to get real FTS5 were evaluated:
- `sql.js-fts5` (community fork, MIT) — last published 2022, unmaintained; ruled
  out.
- [`@sqlite.org/sqlite-wasm`](https://github.com/sqlite/sqlite-wasm) — the
  official SQLite project's own WASM build, actively maintained, zero
  transitive dependencies, confirmed working (FTS5 + `DELETE ... WHERE
  unindexed_col = ?` + JSON1 all tested directly). The blocker: its Node entry
  relies on `import.meta.url` internally, which breaks once esbuild bundles it
  into our CJS `dist/extension.js` (confirmed via a standalone bundle repro —
  fails with `ERR_INVALID_ARG_VALUE` on `createRequire(import.meta.url)`). It
  would have to stay external and ship as a real `node_modules` folder inside
  the `.vsix`, loaded via a runtime dynamic `import()` — a permanent, one-off
  exception to the "everything bundled" packaging model used everywhere else.

**Why FTS3 instead.** FTS is only load-bearing for the structured search
feature (§13.6), which is Phase E — not the core loop, not the dogfood path.
The indexed corpus is small (hundreds of rows per workspace), where FTS5's
headline advantage — `bm25()` relevance ranking — matters far less than at
scale. FTS3 still supports `MATCH`, phrase, and prefix queries. The one
concrete risk considered was FTS5's `unicode61` tokenizer folding diacritics
(relevant to ORUN's Yoruba terms, e.g. matching "Orunmila" against
"Ọ̀rúnmìlà") — but that only matters inside the not-yet-built §13.6 feature,
so it's deferred to be tested against the real ORUN corpus rather than
decided on a hypothetical now.

**Revisit if:** building §13.6 against the real ORUN corpus shows FTS3 cannot
adequately match diacritic variants or another concrete search-quality gap
appears. The `IndexStore` interface (`src/index/store.ts`) exists precisely so
swapping the engine at that point doesn't touch callers.

---

## Toolchain note — `moduleResolution: "bundler"` requires explicit `types: ["node"]`

**Date:** 2026-07-22

Using a `node:`-prefixed import (e.g. `import * as path from 'node:path'`) under
`tsconfig.json`'s `moduleResolution: "bundler"` (TypeScript 6.0.3) fails with
`TS2591: Cannot find name 'node:path'` even though `@types/node` is installed —
`bundler` resolution does not auto-include `@types/node` the way legacy
`node10` resolution did. Fix: add `"types": ["node"]` to `compilerOptions`
(confirmed via an isolated repro: fails without it, passes with it, same
TypeScript/`@types/node` versions). Already applied in `tsconfig.json`.
**Revisit if:** a future TypeScript release changes `bundler` resolution's
default type inclusion.

---

## ADR-0004 — Entity schema: strict per-type discriminated union, non-blocking misplaced-field warnings

**Date:** 2026-07-22 · **Status:** Accepted

**Decision.** `entityFrontmatterSchema` (`src/model/entity.ts`) is a Zod
`discriminatedUnion` on `type`, with one variant per entity type
(`character`/`location`/`faction`/`object`/`concept`), superseding the initial
single fully-permissive schema. A known type-specific field present on the
*wrong* type (e.g. `sound_motif` — a Character field, §4.3 — set on a
`location`) is not rejected: the value still parses and round-trips via that
variant's `catchall`. Instead, `parseEntityFile`'s success branch now returns a
`warnings: EntityWarning[]` array flagging the mismatch for a future
UI/diagnostics layer, alongside the entity.

**Context.** Only 2 of the 5 entity types have bespoke fields: Character
(`sound_motif`, `casting_notes`, `appears_in`, `first_appearance`, §4.3) and
Location (`parent_location`, `mobility`, §4.4). Faction/Object/Concept are
base-only. The initial implementation used one permissive schema where every
field was optional on every type, on the reasoning that §4.2/§23 favor
forgiveness over rejection. Revisited once the project owner clarified: entity frontmatter
is populated **programmatically** (the Story Card form, the migration command)
rather than hand-typed by a person, so strictness here catches a bug in *our*
code or the migration AI's output — it does not punish freehand human input, so
the forgiveness argument for full permissiveness didn't actually apply.

**Why the hybrid instead of hard rejection.** A pure strict union (rejecting
misplaced fields outright) would still satisfy the type-safety goal, but
conflicts with §23 ("index rebuild must skip/flag... never crash") and
files-as-truth (never silently drop a field). The chosen middle path gets both:
compile-time safety for all *downstream* code (`entity.frontmatter.mobility`
does not type-check until narrowed to `type === 'location'`), while the
file-parsing layer stays tolerant and non-destructive, surfacing a reporting
signal instead of an error.

**Revisit if:** a Phase D/UI decision is made about *where* `warnings` actually
surface (Problems panel diagnostic vs. the orphan-style status-bar count from
§6.2 vs. folded into the §13.3 broken-reference report) — this ADR only
establishes that the model layer produces the signal, not its UI treatment.

---

## ADR-0003 — Self-sufficient at runtime; every BF-overlapping feature is individually disable-able

**Date:** 2026-07-22 · **Status:** Accepted

**Decision.** LoreFountain ships everything its own features require and never
depends on Better Fountain (or any other extension) at runtime. Coexistence with
BF is expected and supported; *dependence* on it is not.

- **Self-register the `fountain` language.** All our editor providers bind to
  `{ language: 'fountain' }`. That language id + `.fountain` association must be
  contributed by an extension, so LoreFountain contributes its own `languages`
  entry + `language-configuration.json` and activates on `onLanguage:fountain`.
  Without this we would silently depend on BF to register the language — with BF
  uninstalled, our hover/completion would do nothing. When both are installed,
  VS Code merges the language contribution by id without conflict (verify in the
  §11 cross-fork/coexistence pass).
- **Every BF-overlapping feature is individually toggle-able** via a
  `lorefountain.<feature>.enabled` setting (default `true`), so a user who
  prefers BF's version can disable ours per-feature and avoid duplication.

**Implementation.** Provider-based features (hover, completion, definition,
folding, document symbols, decorations, cue snippets) are registered
*conditionally* on their setting and re-evaluated on configuration change — a
clean runtime toggle.

**Caveat.** Syntax highlighting is a static TextMate grammar contribution, which
VS Code cannot unregister at runtime via a setting. We ship the grammar
(default on) with a `lorefountain.highlighting.enabled` setting and will validate
the exact "off" mechanism in Phase C (likely: detect another Fountain grammar/BF
and defer gracefully, plus honor the setting for any semantic-token layer).

**Rationale.** The project owner, 2026-07-22: assume BF coexistence is common, but never
depend on it, and let users disable any overlapping feature.

---

## ADR-0002 — Fountain parsing: depend on `fountain-js`, do not fork Better Fountain

**Date:** 2026-07-21 · **Status:** Accepted

**Decision.** Use [`fountain-js`](https://github.com/jonnygreenwald/fountain-js)
(MIT, v1.2.4) as a direct npm dependency for Fountain parsing. Do **not** fork
Better Fountain, and do **not** depend on the full `afterwriting` package.

**Context / evidence (spike A3).**
- `fountain-js`: MIT, **zero runtime dependencies**, ships TypeScript types,
  ~110 KB. A parse test confirmed it emits the full typed token stream we need:
  `scene_heading` (+ `scene_number`), `character`, `dialogue`, `parenthetical`,
  dual-dialogue markers, `action` (carries `SFX:`/`MUSIC:`/`AMB:` cue text
  intact for sidecar extraction), `note`, `transition`, `section`, `synopsis`.
- `afterwriting`: MIT but unsuitable as a dependency — pulls in jquery, d3,
  pdfkit, handlebars, lodash, even snyk. Its parser core is the separate
  `aw-parser` (MIT); its pagination is `aw-liner` (MIT).
- Better Fountain is an *editing* extension (highlighting, preview, PDF, outline).
  LoreFountain is additive — a worldbuilding layer alongside the editor, not a
  replacement (Spec §1.2). A fork would mean maintaining a large codebase that
  mostly duplicates what Better Fountain already provides free.

**Known gap.** `fountain-js` tokens carry **no source positions** (line/column).
Editor features (hover, completion, decorations) need document ranges, so the
`src/fountain/` module adds a small **line-based position scanner** alongside the
token tree. Fountain is line-oriented, so this is minimal, reliable code — not a
Better Fountain fork.

**What we defer (not lose).** afterwriting's real value is screenplay **PDF
pagination**. The industry-standard PDF export (Spec §16, free tier) is not part
of the core loop or the dogfood milestone. When we build it, revisit
`aw-parser` + `aw-liner` + `pdfkit` specifically — not the full afterwriting app.

**Revisit if:** we need afterwriting-grade PDF/BBC-format pagination fidelity, or
`fountain-js` proves insufficient for a specific parse case.

---

## ADR-0001 — Local index storage: `sql.js` (WASM) behind a replaceable interface

**Date:** 2026-07-21 · **Status:** Accepted

**Decision.** Implement the rebuildable local index (Spec §2.2) on
[`sql.js`](https://sql.js.org) (SQLite compiled to WebAssembly) for v1. Place all
index access behind a thin storage interface so the engine can be swapped without
touching callers.

**Context / evidence (spike A2).** Ran each installed fork's bundled runtime as
Node and tested `node:sqlite` + FTS5 + JSON1:

| Editor | Electron | Node | `node:sqlite` | FTS5 | JSON1 |
|---|---|---|---|---|---|
| VS Code 1.128 | 42.5.0 | 24.17.0 | stable | yes | yes |
| Cursor 3.5.38 | 39.8.1 | 22.22.1 | experimental | yes | yes |
| Antigravity | 41.0.2 | 24.14.0 | experimental | yes | yes |

`node:sqlite` is viable today but: (1) it only exists once a fork ships Node
≥22.5 (~VS Code ≥1.102), which would force an `engines.vscode` floor bump and
break older/ lagging forks — against Spec §11 and §2.3; (2) it is still flagged
*experimental* ("API may change") on 2 of 3 current forks; (3) FTS5 relies on
each fork's SQLite build (true today, not guaranteed for future forks).

`sql.js` runs identically on any host Node with no floor bump, ships a known-good
SQLite build, and needs no native binaries — directly serving the cross-fork
requirement. The index is explicitly *disposable and small* (§2.2), so sql.js's
in-memory + rebuild-from-files model is a clean fit; the manual-persistence
downside barely applies.

**Correction (2026-07-22, during B3 implementation):** this ADR originally
claimed sql.js gives "guaranteed FTS5 + JSON1." That was wrong. Empirically
testing the actual npm `sql.js` package (v1.14.1) during B3 showed its default
WASM build's `PRAGMA compile_options` includes `ENABLE_FTS3` but **not**
`ENABLE_FTS5` — `CREATE VIRTUAL TABLE ... USING fts5(...)` fails with
`no such module: fts5`. JSON1 is unaffected (SQLite's JSON functions are
built in by default since 3.38, independent of the FTS compile flag). See
ADR-0005 for the resulting decision to use FTS3 rather than swap engines.

**Revisit if:** the supported `engines.vscode` floor rises past ~1.102 across all
target forks and `node:sqlite` is stable there (native perf, real on-disk file),
or if a future multi-writer tier moves to Postgres (§2.4) — the strict-columns +
JSON pattern maps to both. The storage interface exists to make either swap cheap.
