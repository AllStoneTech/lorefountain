# Changelog

All notable changes to LoreFountain are documented here. This project follows
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **A license notice for LoreFountain Pro** (`LICENSE-PRO.md`). The free tier
  stays MIT; the compiled Pro module is proprietary and is now described as
  such in the package and the README.


## [1.0.0] - 2026-09-24

First public release, published to the VS Code Marketplace and Open VSX.

### Added

- **Onboarding buttons in the World and Scripts sidebar views.** When no
  LoreFountain project is found in the open folder (or before any project
  content has been indexed), both views now show "Try LoreFountain (Sample
  Workspace)" and "Install a Demo World..." buttons directly in the panel,
  instead of leaving it blank until the commands are found via the Command
  Palette.
- **Asset manifests, keyed to reuse the same production asset every time it
  recurs.** `SFX:`/`MUSIC:`/`AMB:` cues can now carry an optional `[tag]`
  (e.g. `SFX: [kola-nuts-clatter] ...`), a stable handle into a new
  `assets/manifests/audio.json` mapping that tag to the licensed/generated
  file that fulfills it — so a recurring sound design choice is reused
  across the season instead of re-picked or regenerated each time it
  appears. A tagged cue with no matching entry is a non-blocking warning.
- **Entity-keyed manifests for characters, locations, objects, and voice.**
  `assets/manifests/characters.json`, `locations.json`, `objects.json`, and
  `voice.json` key off an entity's existing id rather than a fresh tag,
  splitting each entry into a persistent `versions` baseline (a scar
  introduced in Season 2 stays in every later version) and, for
  characters/locations/objects, a named `looks`/`dressing` variant layer for
  temporary/swappable conditions. A manifest key with no matching entity is
  now reported as an error, the same severity as a dangling relation target.
- **A form-based editor for all five manifest files**, matching the Story
  Card editor's pattern — add/remove entries, versions, and looks/dressing
  rows, with an entity-id picker for the four entity-keyed kinds, instead of
  hand-editing JSON.
- **Dedicated help panels for the Asset Manifest, Story Card, and Story
  Overview editors** — a `$(question)` icon in each editor's own title bar,
  the same idea as the World/Scripts/Continuity views' title-bar help, now
  extended to custom text editors.
- **`assets/` joins `world/`/`scripts/`/`imports/` as a configurable
  workspace folder** (`lorefountain.config.json`'s `folders.assets`),
  scaffolded by "Initialize Workspace" with its own README, same as the
  other three.
- **"Check for LoreFountain File Updates" now offers to create tracked files
  it's never seen before, not just update stale ones.** A project set up
  before a given agent doc, README, or `agents/validate.js` existed (or
  before the `assets/` convention did at all) previously had that file
  silently skipped — now it's reported as "not created yet" alongside
  everything stale, with the same per-file diff/confirm flow, and any
  missing parent folder is created along with it.

- **Cue Sheet export (Pro) now includes each cue's tag and its resolved
  asset.** A tagged cue's `[tag]` and the matching `audio.json` manifest
  entry — asset file, source, and license — appear as columns in both the
  CSV and Markdown output, so a sound designer no longer cross-checks the
  manifest by hand.
- **"Check for LoreFountain Updates" command.** Compares the installed
  version against the newest GitHub Release and, if there's a newer one,
  offers the release notes or the Extensions view. It only ever reports —
  Marketplace and Open VSX installs update themselves, so nothing is
  downloaded or side-loaded.
- **The Story Overview body now shows as rendered Markdown** and only drops
  into the raw text box when you click **Edit** or double-click the text,
  the way a Markdown body reads in Notion or Obsidian. An empty body still
  opens straight into the editor.
- **Pro commands are now covered by the opt-in usage tracking** the free
  tier's commands already used (still off by default, still subject to VS
  Code's own telemetry setting).

### Fixed

- **"Check for LoreFountain File Updates" no longer leaves a stray diff tab
  open, and closing it no longer prompts to save.** The diff's "current
  template" side used to be an in-memory `untitled:` document — closing it
  automatically (rather than leaving it open indefinitely) still triggered
  VS Code's "save your changes?" prompt on every review, since an untitled
  document is considered dirty the moment it has content. It's now a
  read-only virtual document instead, which has no save state at all, so the
  tab closes silently once you accept or decline the update.
- **`agents/validate.js`'s tracked version was left at 1 despite gaining real
  audio-manifest validation logic**, so an already-scaffolded copy would
  never have been flagged as stale. Bumped to 2.

## [0.12.0] - 2026-08-12

### Added

- **Opt-in, anonymous feature-usage telemetry.** Off by default
  (`lorefountain.telemetry.enabled`), and gated by VS Code's own global
  telemetry switch regardless of this setting. Covers every command (free
  and Pro alike, via a `registerTrackedCommand` wrapper used at every
  registration site) plus coarse "used at least once this session" flags
  for hover/completion. Never includes file names, entity names, workspace
  paths, or file contents — see the new "Telemetry & Feedback" README
  section for the full disclosure. `LoreFountain: Show Telemetry Queue`
  shows exactly what's queued to send; `LoreFountain: Disable Telemetry`
  turns it off and clears the queue.
- **"Send Feedback" command**, opening a small webview form (bug/feature
  suggestion/general thoughts, plus an optional reply email) — explicit and
  user-initiated, independent of the telemetry opt-in.
- Both features' network calls target dedicated `AllStoneTech.com` endpoints
  (`POST /api/telemetry/ingest`, `POST /api/feedback/submit`); until that
  backend is live, telemetry queues events locally and feedback surfaces a
  clear retry error rather than failing silently.

## [0.11.0] - 2026-08-11

### Changed

- **License validation is real, not a stub.** `validateLicense()` now calls
  the actual `POST /api/license/validate` endpoint (AllStoneTech.com),
  sending a stable per-install device id so the backend can enforce each
  license tier's activation cap. A non-2xx response or an unexpected
  response shape is treated as "endpoint unreachable," falling back to the
  existing offline-grace window rather than locking a user out.
- **Public-launch promo window added** (`licensing/promoConfig.ts`): every
  user gets Pro unlocked with no license key until a single, clearly-labeled
  date constant — bypasses the license check entirely while active, no
  network call made.
- Repo history scrubbed of the product spec files that used to block making
  `lorefountain` public — see ADR-0033.

## [0.10.0] - 2026-08-11

### Changed

- Renamed **"Check for Agent File Updates"** to **"Check for LoreFountain
  File Updates"** and folded README drift-checking into it — it previously
  only checked `AGENTS.md`/`agents/*`; the scaffolded human-facing READMEs
  (`resources/readmes/*` → `README.md`/`world/README.md`/etc.) had zero
  staleness detection of any kind until now. Both categories share one
  report, one review flow, and one command.

### Added

- A future **"Check for LoreFountain Updates"** (extension self-update, not
  just in-project file drift) is now tracked in `docs/TODO.md` — blocked on
  this repo actually going public, since there's nowhere to check a release
  against yet.

## [0.9.0] - 2026-08-11

### Added

- Help panels for the five Pro features that had none: Entity Graph,
  Story-Bible Export, BBC Radio Drama Export, SFX/Cue-Sheet Export, and
  Shot List Export — reachable from the Command Palette and a "How to Use
  This Feature" item next to each feature's own command.
- `agents/world-builder.md` and `agents/script-writer.md` (docs-version 2)
  now guide an AI on *when* to act on its own judgment: distinguishing
  fact invention (never) from editorial synthesis from evidence already in
  the project (expected when asked — e.g. grouping entities by
  significance, or adding SFX/MUSIC/shot annotations that fit a scene).

## [0.8.0] - 2026-08-11

This is the first entry tracked under real version numbers — it summarizes
current functionality rather than reconstructing a step-by-step history.
Nothing has been tagged or published before this. See `docs/DECISIONS.md`
for the full decision log behind everything below (ADR-0001 through
ADR-0031).

### Added

- **Free tier**: Fountain scripts linked to a structured, persistent world —
  entity files (character, location, faction, object, concept, arc) with
  typed relationships, canon status, and significance grouping (Main /
  Supporting / Minor); a glossary; a dual-ordered Timeline (narrative order
  and in-universe chronology); hover previews and wikilink completion;
  automatic entity-mention linking; a Story Card editor (including a
  freeform Physical Description field for characters and factions); a
  structured Story Overview document; Rename Entity with reference
  propagation; Structured Search; broken-reference detection; transcript
  export; a headless `validate.js` for CI/AI-agent use with no VS Code
  dependency; project-level `AGENTS.md` + `agents/*.md` AI-agent
  instructions, now with per-file version tracking and a "Check for Agent
  File Updates" command to keep them current as the templates evolve.
- **LoreFountain Pro**: Continuity Management (Canon Status Report,
  Presence Dashboard, Continuity Flags, Doubling-Conflict Detection,
  Continuity Overview), Timeline/As-of-Episode viewing, an Entity Graph
  view, Story-Bible Export (Markdown/Word), BBC Radio Drama Export,
  SFX/Cue-Sheet Export, and Shot List Export.
- Client-side license-key entry and caching, gating the Pro module load.

### Known limitations

- License validation (`validateLicense()`) always succeeds regardless of
  the key entered — the real backend check is stubbed pending
  AllStoneTech.com's licensing endpoint. See `docs/TODO.md`.
- This repo's commit history still contains the removed product-spec
  documents in old blobs; a history rewrite is required before the repo
  can be made public. See `docs/TODO.md`.
