<!-- lorefountain-docs-version: 1 -->
# Imperium in Imperio — a feature screenplay

> **CONTENT NOTE.** This demo preserves period language, including racial slurs, because it adapts a historical text (1899) faithfully. The novel puts those words in the mouths of white teachers, judges, mobs and the secret society of Cadeville, Louisiana, and the screenplay keeps them in the same mouths. Nothing here endorses them.

This project uses **[LoreFountain](https://github.com/AllStoneTech/lorefountain)** — a worldbuilding methodology for Fountain-format writing. At its core, it's just plain Markdown files (with YAML frontmatter) and standard Fountain scripts, checked by a small validator — no proprietary format, nothing locked to one tool. The [LoreFountain VS Code extension](https://github.com/AllStoneTech/lorefountain) is the richest way to use it (hover previews, a form-based editor for entities, one-click rename, structured search), but every file here is readable and editable in any text editor, and an AI coding agent can work in this project with no VS Code involved at all.

## What this demo is — and the use case it shows

**Use case: writing a feature-length screenplay.** If you write films rather than episodic series, this is the demo to open. It adapts **[*Imperium in Imperio*](https://www.gutenberg.org/ebooks/15454)** (1899) by **Sutton E. Griggs** — an early work of Black speculative fiction about a secret Black government operating inside the United States — as a feature film in standard Fountain format.

What it demonstrates for a screenwriter:

- **One feature, written in eight sequences.** Each sequence is its own `.fountain` file (`1x01` through `1x08`) inside one `Feature Film` folder, following the classic eight-sequence feature structure. Read them in order and you have the whole screenplay; keep them separate and each is a manageable unit to revise, reorder, or hand to a collaborator.
- **A cast the tool keeps straight.** Every character, location, faction, and prop is a file in `world/`, linked automatically wherever its name appears in the script, with `canon_status` flags where the source contradicts itself or an adaptation choice departs from it.
- **Timeline vs. screen order.** `world/timeline/` separates story chronology from where an event lands in the film.
- **Adaptation notes you can trust.** `imports/source-material.md` records exactly what this adaptation took from the novel and what it changed.

## What's in each folder

- **`world/`** — the story world: characters, locations, factions, objects, concepts, and arcs, one file per entity. See `world/README.md`.
- **`world/glossary/`** — period terminology. See `world/glossary/README.md`.
- **`world/notes/`** — adaptation notes and open questions. See `world/notes/README.md`.
- **`world/timeline/`** — in-world events, separate from the entities that take part in them. See `world/timeline/README.md`.
- **`scripts/`** — the screenplay, eight sequences. See `scripts/README.md`.
- **`imports/`** — the full public-domain source text and a citation file. See `imports/README.md`.

## A note on the source

The novel was written in 1899. It depicts racist violence and uses period language, including racial slurs. This adaptation keeps the events and the language, and it keeps the wording of the novel's key speeches and letters; it is meant to be read as a serious drama about citizenship, loyalty, and the limits of both. See `imports/source-material.md` for exactly what was kept, what was condensed, and which spoken lines are invented.

## Working with an AI

See `AGENTS.md` at the project root — it's the entry point for any AI coding agent working in this project, and points into the `agents/` folder for the exact file formats, conventions, and a headless validator (`node agents/validate.js`) that checks this project's files without needing VS Code at all.

## Working in VS Code

Install the LoreFountain extension for hover previews on any recognized mention, a form-based Story Card editor for entities, a World view listing everything by category, and commands for renaming, structured search, transcript export, and more.
