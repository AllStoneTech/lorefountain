# Architecture Decisions

A running log of significant technical decisions and their rationale. Newest
first. Each entry records what was decided, why, and what would trigger a
revisit.

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
SQLite build (guaranteed FTS5 + JSON1), and needs no native binaries — directly
serving the cross-fork requirement. The index is explicitly *disposable and
small* (§2.2), so sql.js's in-memory + rebuild-from-files model is a clean fit;
the manual-persistence downside barely applies.

**Revisit if:** the supported `engines.vscode` floor rises past ~1.102 across all
target forks and `node:sqlite` is stable there (native perf, real on-disk file),
or if a future multi-writer tier moves to Postgres (§2.4) — the strict-columns +
JSON pattern maps to both. The storage interface exists to make either swap cheap.
