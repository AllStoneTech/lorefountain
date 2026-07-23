# Architecture Decisions

A running log of significant technical decisions and their rationale. Newest
first. Each entry records what was decided, why, and what would trigger a
revisit.

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

**Rationale.** the project owner, 2026-07-22: assume BF coexistence is common, but never
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
