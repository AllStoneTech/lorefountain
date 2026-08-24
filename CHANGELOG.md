# Changelog

All notable changes to LoreFountain are documented here. This project follows
[Semantic Versioning](https://semver.org/) — pre-1.0 releases (`0.x.y`) make
no API/schema stability guarantees. `1.0.0` is reserved for the actual
public launch; see `docs/TODO.md` for what's still outstanding before then.

## [Unreleased]

## [0.13.0] - 2026-08-23

### Added

- **Onboarding buttons in the World and Scripts sidebar views.** When no
  LoreFountain project is found in the open folder (or before any project
  content has been indexed), both views now show "Try LoreFountain (Sample
  Workspace)" and "Install a Demo World..." buttons directly in the panel,
  instead of leaving it blank until the commands are found via the Command
  Palette.

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
