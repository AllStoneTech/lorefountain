<!-- lorefountain-docs-version: 1 -->
# The Conjure Woman — an anthology TV series

This project uses **[LoreFountain](https://github.com/AllStoneTech/lorefountain)** — a worldbuilding methodology for Fountain-format writing: plain Markdown files with YAML frontmatter plus standard Fountain scripts, checked by a small validator. The VS Code extension is the richest way to use it, but every file here is readable in any text editor.

## Use case: writing a TV series

**If you write episodic television — especially an anthology — this is the demo to open.** It adapts **[*The Conjure Woman*](https://www.gutenberg.org/ebooks/11666)** (1899) by **Charles W. Chesnutt** as a seven-episode season in the spirit of *The Twilight Zone* and *The Outer Limits*: each tale is a self-contained eerie half-hour with a twist, and [[Uncle Julius McAdoo]] is the framing host who opens and closes every episode.

What it shows a series writer:

- **A season, one script per episode.** `1x01` through `1x07`, each with a title page, `Order`, and a permanent `Production Code`.
- **A recurring frame plus a new cast every week.** The frame cast (John, Annie, Julius) persists; every tale brings its own characters, places, and objects, all tracked in `world/`.
- **Arcs across a season.** Arcs such as *The Julius Method* list their episodes by production code.
- **Audio cues for tone.** Scripts use the optional `SFX:`, `MUSIC:`, and `AMB:` convention.

## CONTENT NOTE

This project adapts a historical text faithfully. **It preserves period language, including racial slurs and heavy dialect, in characters' dialogue**, as the source does. The story depicts slavery and its violence: whippings, family separation, sale, and murder. Nothing has been censored or softened; the goal is a faithful adaptation of how Chesnutt's characters speak, not an endorsement.

## What's in each folder

- **`world/`** — characters, locations, factions, objects, concepts, and arcs. See `world/README.md`.
- **`world/glossary/`** — conjure terms, dialect, and period vocabulary.
- **`world/notes/`** — open questions about the adaptation.
- **`world/timeline/`** — in-world events, with frame events kept apart from the tales.
- **`scripts/`** — Season 01, seven episodes.
- **`imports/`** — the full public-domain source text and `source-material.md`.

## Working with an AI

See `AGENTS.md` for the entry point, and `agents/` for formats and the headless validator (`node agents/validate.js`).

## Working in VS Code

Install the LoreFountain extension for hover previews, a form-based Story Card editor, a World view, renaming, structured search, and transcript export.
