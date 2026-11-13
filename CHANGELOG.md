# Changelog

All notable changes to LoreFountain are documented here. This project follows
[Semantic Versioning](https://semver.org/).

## [Unreleased] - after 1.1.0

Merged into `main` on 2026-11-13, after the 1.1.0 work. Parsing comes from LoreFountain-Core 0.2.0.

### Added

- **Project type** (ADR-0051, built on Core's ADR-0007). `lorefountain.config.json`
  gains an optional `project_type`: `screenplay`, `tv_series`,
  `serialized_universe` (a long-running original series whose arcs carry across
  seasons), `audio_drama`, `comic`, `prose`, `tabletop` or `custom`. It names
  how a project is written, never how it is rendered, and it only records and
  recommends: nothing is switched off and no explicit setting is overridden.
  A **What kind of project is this?** dropdown asks once for an existing
  project that has a config file but no type (after an update), straight away
  when **Initialize Workspace** creates a new project, and any time through
  **LoreFountain: Set Project Type**. Skipping is remembered, a config with a
  syntax error is never rewritten, and only the `project_type` line is added.
  `lorefountain.notifications.projectType` turns the automatic prompt off. The
  demos record their types, the config schema offers the values, **Project
  Type: What It Means** opens a full help page, and `AGENTS.md` (version 7)
  tells an AI agent to read it. Needs a Core release that exports
  `config/projectType` (0.3.0).
- **Narrated comics: panels as shots** (ADR-0046, built on Core's ADR-0003).
  With the new project setting `comic.panelsAsShots: true` (default false), a
  comic script with no `SHOT:` lines gets a derived `<script>.shots.json` with
  one shot per panel, so a narrated or motion comic (panel art with voice and
  sound over it) can go to LoreFountain-Producer unchanged. A panel can carry
  an explicit `PANEL: [tag]` (otherwise a tag like `1x03-p7-2` is derived),
  `DURATION:` and a new `MOVE: slow zoom in` camera-move line, and a `TURN`
  page marks its first panel as a page-turn reveal. Balloons become spoken
  lines, a caption a voice-over line for its speaker or `NARRATOR`. A repeated
  panel tag is a warning (`duplicate-panel-tag`); explicit `SHOT:` lines win
  and say so (`panels-not-derived`). `.pages.json` gains the matching panel
  fields (still schema version 1). Highlighting and snippets cover `MOVE:`
  and the panel tag; the agent docs, help pages and the config schema document
  it (`AGENTS.md` 6, `script-writer.md` 7, `validate.js` 7, Scripts README 7).
- **Comic scripts: `PAGE:` and `PANEL:`** (ADR-0043, built on Core's ADR-0001).
  A script with a `PAGE: 7 (SPLASH)` line is read as a comic: pages, numbered
  panels, `CAPTION:`, `SFX:` and `LAYOUT:` lines and ordinary dialogue as
  balloons, with word counts. It is plain Fountain, so any other app still
  opens it. Every comic script gets a derived `<script>.pages.json` sidecar
  next to it, rebuilt on every save and removed when the pages go (it is
  git-ignored like the other sidecars and follows a renamed script).
- **Pages in the Scripts view** (ADR-0043): expanding a comic script shows a
  `Pages` section before its other files, with one row per page (`Page 7`,
  flags such as `SPLASH`, panel and word counts) and its panels beneath
  (`Panel 1` plus the start of its description, lettering counts). Clicking a
  row opens the script at that line; pages and panels with warnings get a
  warning icon and list the issues in the tooltip. Read lazily from the
  `.pages.json` sidecar; scripts without pages look the same as before.
- **Page checks** in the Problems panel, the Output channel and
  `node agents/validate.js`: duplicate or out-of-order page numbers, a panel
  with no page and lettering outside a panel are warnings; page-number gaps,
  empty pages and word-budget notes are notes (`misread-as-character` is a
  warning, below).
  None fail a validator run, which also prints the pages, panels and
  lettered words in the project.
- **Quick fixes for `misread-as-character`** on an all-caps `PAGE: 7` that
  other Fountain apps would read as a character cue; **Fix All Script
  Formatting Issues** includes it (see the `!` entry below).
- Syntax colouring and `page`, `panel`, `caption`, `layout` snippets for the
  new lines; the Fountain Syntax help, the scaffolded scripts README, the AI
  agent docs (`AGENTS.md` and `agents/script-writer.md`, now version 4 and 5)
  and `docs/FOUNTAIN-EXTENSIONS.md` describe the convention. Existing projects
  are offered the updated docs by **Check for LoreFountain File Updates**.
- **Script export, free** (ADR-0050): **Export Script…** (editor title bar,
  a script's or season's right-click menu in the Scripts view, or the Command
  Palette) exports to **PDF**, **Fountain**, **Final Draft (.fdx)**, a **web
  page**, **Word** or a dialogue **transcript**, one script or a whole season.
  Presets choose what goes in: **Pure Fountain** (every LoreFountain line,
  tag and title key removed), **Production draft** (everything), **Audio
  draft** (sound cues and pauses), or your own **Custom** choice of shot
  lines, sound cues, pauses, comic lines, tags, notes, sections, synopses,
  boneyard and scene numbers (as written, automatic or none). The PDF uses the
  industry screenplay layout on US Letter or A4, with `(MORE)`/`(CONT'D)`
  across pages, in Courier Prime with a Noto Sans Mono fallback so every
  letter prints, Yoruba's included. `SHOT:` lines become Final Draft Shot
  paragraphs. Choices are remembered in `lorefountain.config.json`, and files
  go to an `exports/` folder by default. New help page: **Script Export: How
  to Use This Feature**.
- **Convention lines can start with Fountain's `!`** (ADR-0049), Fountain
  1.1's way to force a line to be action: `!SHOT: CLOSE-UP` keeps a stacked
  all-caps shot block from printing as a character speaking in other Fountain
  apps, and they don't print the `!`. Shots, cues, pages and the validator
  all read it.
- **`misread-as-character` now warns on every script**, not only comics: an
  all-caps convention line with text directly under it. Its quick fixes add
  the `!` (preferred, and what Fix All uses) or insert a blank line after it.

### Fixed

- **A script with a lyric directly under a character name no longer fails to
  load.** The Fountain parser crashed on it; LoreFountain now reads it as a
  lyric (Core ADR-0005).
- **Lines the Fountain parser rewrites are no longer dropped** from shot maps
  and cues: forced lines, backslash escapes, tab-indented action, two-space
  lines inside dialogue, and multi-line blocks in files with Windows line
  endings.
- Syntax colouring no longer shows backslash-escaped `\*` or `\_` as emphasis,
  and colours every title-page key the parser knows (`Date`, `Revisions`).

- **Comic `SFX:` is lettering by default** (ADR-0044): in a comic panel an
  `SFX:` line is no longer written to the `.cues.json` audio sidecar or
  checked against `audio.json`. A project that makes a narrated or motion
  comic sets `"comic": { "sfxAsCue": true }` in `lorefountain.config.json` and
  gets both. `MUSIC:` and `AMB:` are always cues; screenplays and audio
  dramas are unchanged.
- **Comic word-budget presets** (ADR-0044): the notes for too many panels,
  balloons or words follow a per-project preset (`western`, `manga`,
  `european`, `webtoon`, `custom`) set by `comic.preset`, with any single
  limit overridable (or switched off with `null`) in `comic.limits`. The
  VS Code setting `lorefountain.comic.defaultPreset` sets your default for
  projects that don't choose. Each note names the limit and preset that
  fired. The numbers are guidance, not standards. The `comic` block is in the
  config file's schema and is read tolerantly (a bad value is reported and
  dropped, never fatal).

- **The Story Overview is now `world/overview.lf.md`** (ADR-0048). Existing
  projects are renamed automatically the first time the extension opens them
  after the update: `OVERVIEW.md` becomes `overview.lf.md`, content untouched,
  never overwriting (if both exist you get a warning and nothing changes). Old
  names still work everywhere until then. New projects, Try LoreFountain and
  the demos use the new name. The folder `README.md` files keep their names.
  Also fixed: the Notes list in the World view no longer shows the folder
  README as a note. `agents/world-builder.md` (now version 6),
  `agents/initiator.md` (version 3) and the world README (version 4) describe
  it.

- **The `.lf.md` naming convention and a guided style bible editor** (ADR-0047,
  Core's ADR-0004). LoreFountain's own project documents that aren't entities
  end in `.lf.md` and are never indexed as entities, glossary terms, events or
  notes, wherever they sit; the style bible is `world/style.lf.md`, so a real
  entity called Style (`world/style.md`) is fine. The style bible opens in a
  form: media chips (none selected means all media), a palette with colour
  pickers that always saves valid quoted hex, reference images chosen with a
  project file picker with missing-file warnings, avoid chips, per-medium
  format presets (aspect ratios; comic, manga, album, webtoon and book trims;
  each marked sourced or unsourced guidance), lettering notes, and the
  template's headings as labelled boxes plus Additional notes so nothing is
  lost. Unknown fields round-trip, an untouched file is never rewritten, undo
  works, and **Open as text** is one click away. Changing a field in the form
  drops `#` comment lines in the frontmatter.

- **A project style bible, `world/style.lf.md`** (ADR-0045, built on Core's
  ADR-0002): one optional file for how the project looks and feels in every
  medium, so comics, video and illustrated books share a brief. A short
  frontmatter block (`medium`, `art_style`, `palette`, `reference_images`,
  `avoid`, `format`, `lettering`, `era_reference`, all optional) plus free
  Markdown. **LoreFountain: Open Style Bible (Create If Missing)** writes a
  template and opens it in a guided form; a **Style Bible** row then appears at
  the top of the World view. It is never indexed as an entity.
  `node agents/validate.js` fails on a malformed one and notes a reference
  image that doesn't exist; the Output channel reports the same on each save.
  New help topic, `agents/world-builder.md` (now version 5), `validate.js`
  (version 8) and the world README (version 3) describe it; existing projects
  are offered them by **Check for LoreFountain File Updates**.

### Changed

- **Comic default limits are now 3 balloons per panel and 35 words per panel**
  (were 5 and 40; 9 panels per page and 25 words per balloon are unchanged).
  The scaffolded `AGENTS.md` (5), `agents/script-writer.md` (6),
  `agents/validate.js` (5) and scripts README (6) describe the new settings.
- **The parsing code and config reading now come from LoreFountain-Core**
  ([AllStoneTech/lorefountain-core](https://github.com/AllStoneTech/lorefountain-core)),
  a separate MIT package shared with LoreFountain-Producer, so both read a
  project identically. Nothing changes for writers: scripts, sidecars,
  checks and fixes behave exactly as in 1.1.0 (ADR-0042).

## [Unreleased] - 1.1.0

Not yet released.

### Added

- **Script problems in the Problems panel.** Script warnings and notes now
  show as diagnostics on the line they're about (warnings as warnings,
  notes as information), alongside the existing Output-channel log.
- **Quick fixes** (Ctrl+. / Cmd+.), each one standard Fountain correction:
  join an orphaned `(beat)` back to the previous speech, re-cue the speaker
  with `(CONT'D)` when a `SHOT:` or other line interrupts a speech, or turn
  a standalone `Beat.` into `PAUSE:`.
- **Fix All Script Formatting Issues** applies every safe fix across the
  project in one refactor preview, where each change can be reviewed and
  unticked before anything is written.
- **A What's New page** that opens by itself once after a minor or major
  update (never for patch releases or fresh installs), and a once-per-project
  summary offering Fix All when a project's scripts have fixable issues. Both
  can be turned off under `lorefountain.notifications`.
- The World view's **…** menu is reordered by how often each item is used,
  with **Check for LoreFountain File Updates**, **Check for LoreFountain
  Updates** and **What's New** grouped at the bottom.

- **Shot maps.** A `SHOT:` line can now carry an optional `[tag]`
  (`SHOT: [1x01-basement-wide] WIDE, establishing`), the same stable handle
  cues use, mapped to the still or clip that fills the shot in a new
  hand-authored `assets/manifests/shots.json`
  (`{ file, kind: still|clip, motion?, source?, license?, prompt? }`).
  Every script with shots gets a derived `<script>.shots.json` sidecar —
  each shot's line range, what's heard in it (dialogue with speaker and
  extensions, parentheticals such as `(exhales)` with their wording kept,
  pauses, lyrics, overlapping dual dialogue), its action blocks, its
  on-screen text (Fountain centered text), the transition at its end, the
  entities it mentions, its scene heading broken into INT./EXT., setting,
  time of day and resolved locations, and pointers to the cues that start
  in it — so a video pipeline can assemble an episode without parsing
  Fountain. Every heard, action and on-screen entry carries its script
  line, so they merge into one timeline.
- **`PAUSE:` for scene pauses**, with an optional length (`PAUSE: 2s`). A
  character's own pause stays a `(beat)`-style parenthetical.
- **New validator checks**, in `node agents/validate.js` and the Output
  channel: `unmapped-shot-tag`, `shot-kind-mismatch` and
  `orphaned-parenthetical` warnings (the last catches a `(beat)` after a
  blank line, which Fountain reads as action), and a new informational
  **notes** section that never fails a run: `bare-pause-line`,
  `ambiguous-location`, `unused-shot-tag`, and `unforced-transition` (a
  transition such as `FADE IN:` or `CUT TO BLACK.` that the Fountain spec
  only recognizes when it starts with `>`; the quick fix and Fix All add
  the `>`).
- Highlighting for cue and shot tags and `PAUSE:`, plus `shot-tag` and
  `pause` snippets.
- Updated project docs and agent files (`scripts/README.md`,
  `assets/README.md`, `AGENTS.md`, `agents/script-writer.md`,
  `agents/validate.js`) — existing projects are offered the update.
- **A Fountain syntax tutorial and quick reference** help page
  (`resources/help/fountainSyntax.md`): every Fountain 1.1 element and every
  LoreFountain convention (`SHOT:`/`POSE:`/`LIGHT:`/`DURATION:`, `PAUSE:`,
  `SFX:`/`MUSIC:`/`AMB:`, tags, `Order:`/`Production Code:`), with an example
  of each. Open it from the Command Palette, the Scripts view's **…** menu,
  or the **…** menu of any open `.fountain` script. It replaces the shorter
  tutorial that was at the end of the Scripts view help. Help pages now
  render tables with borders.
- **A license notice for LoreFountain Pro** (`LICENSE-PRO.md`). The free tier
  stays MIT; the compiled Pro module is proprietary and is now described as
  such in the package and the README.

### Changed

- A shot's `[tag]` is no longer part of its description, including in
  Export Shot List.

### Fixed

- **Nothing inside a boneyard (`/* ... */`) is read as data any more.**
  `SFX:`/`MUSIC:`/`AMB:` lines there no longer become cues (so they stay out
  of the `.cues.json` sidecar, Cue Sheet and BBC Radio Script exports and
  validator checks), and names there no longer count as mentions, scene
  presence or Structured Search hits. Boneyard text also no longer throws
  off the line numbers of identical text after it. Hover, autocomplete and
  Rename Entity still work inside a boneyard.
- Script line numbers after a multi-line action block came out too low,
  which also misplaced cues in Cue Sheet and BBC Radio Script exports.
- Transcript Export no longer shows an all-caps `SHOT:` line (misread by
  Fountain as a character cue) as a speaker.
- **Reviewing a file in Check for LoreFountain File Updates no longer blocks
  the diff.** The "Replace with Current Template" prompt was a modal dialog
  that froze the window the moment the diff opened, so the changes couldn't
  be read before deciding. It is now a notification you answer after
  reviewing; dismissing it keeps your copy.
- **Check for LoreFountain Updates** now appears in the Command Palette; it
  shipped in 1.0.0 but was never listed there.


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
