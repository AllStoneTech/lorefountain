# Changelog

All notable changes to LoreFountain are documented here. This project follows
[Semantic Versioning](https://semver.org/) — pre-1.0 releases (`0.x.y`) make
no API/schema stability guarantees. `1.0.0` is reserved for the actual
public launch, which `docs/TODO.md` already gates on (repo history scrub,
real license-backend validation).

## [Unreleased]

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
