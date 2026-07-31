# Loomwake

This project uses **[LoreFountain](https://github.com/AllStoneTech/lorefountain)** — a worldbuilding methodology for Fountain-format writing. At its core, it's just plain Markdown files (with YAML frontmatter) and standard Fountain scripts, checked by a small validator — no proprietary format, nothing locked to one tool. The [LoreFountain VS Code extension](https://github.com/AllStoneTech/lorefountain) is the richest way to use it, but every file here is readable and editable in any text editor, and an AI coding agent can work in this project with no VS Code involved at all.

## What this demo is

An original tabletop space-opera campaign — built to demonstrate LoreFountain from a Game Master's chair rather than a novelist's or showrunner's. It uses Starfinder's openly-licensed rules vocabulary (class names, general mechanics terms) as flavor, but the setting, species, factions, and history are entirely original — no published Pact Worlds lore, named species, or proprietary Paizo content appears anywhere in this project.

Unlike the *Of One Blood* demo (a finished, closed adaptation of a public-domain novel), Loomwake is deliberately **unfinished**. It's built to be picked up and continued at the table, not read to an ending: several arcs are mid-thread, `world/notes/` holds live unresolved hooks, and the last written session ends on a real cliffhanger rather than a resolution. That's the more honest demonstration of what this tool is actually for — a GM's world is a living document, not a manuscript.

This project is also the first place a few schema ideas — still in design, not yet part of LoreFountain's real validator — get tried out in actual content before any of them are proposed as real changes: a `production_code` field on individual `relations[]` entries (marking when a secret relationship is revealed to the table, not just whether it's true), and `participants` scoping on those same entries (for secrets known to one player character and not the others). Both are hand-written into these files as plain YAML; the current validator ignores fields it doesn't recognize rather than rejecting them, so nothing here is "invalid" — it's just ahead of what the tool formally understands yet.

## What's in each folder

- **`world/`** — the campaign world: characters (PCs and NPCs), locations, factions, objects, concepts, and arcs. See `world/README.md`.
- **`world/glossary/`** — homebrew terminology. See `world/glossary/README.md`.
- **`world/notes/`** — live, unresolved GM hooks and half-formed ideas — not scratch filler, the actual prep pile. See `world/notes/README.md`.
- **`world/timeline/`** — in-world history, kept separate from when the party actually learns it. See `world/timeline/README.md`.
- **`scripts/`** — Season 01 as pre-written session material (boxed-text narration plus scene structure), not shooting scripts. See `scripts/README.md`.
- **`imports/`** — nothing yet; see `imports/README.md`.

## Working with an AI

See `AGENTS.md` at the project root — the entry point for any AI coding agent working in this project.

## Working in VS Code

Install the LoreFountain extension for hover previews, a form-based Story Card editor, a World view, and more.
