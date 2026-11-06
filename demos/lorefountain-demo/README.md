# lorefountain-demo

This project uses **[LoreFountain](https://github.com/AllStoneTech/lorefountain)** — a worldbuilding methodology for Fountain-format writing. At its core, it's just plain Markdown files (with YAML frontmatter) and standard Fountain scripts, checked by a small validator — no proprietary format, nothing locked to one tool. The [LoreFountain VS Code extension](https://github.com/AllStoneTech/lorefountain) is the richest way to use it (hover previews, a form-based editor for entities, one-click rename, structured search), but every file here is readable and editable in any text editor, and an AI coding agent can work in this project with no VS Code involved at all.

## What's in each folder

- **`world/`** — the story world: characters, locations, factions, objects, and concepts, one file per entity. See `world/README.md`.
- **`world/glossary/`** — invented terminology and vocabulary. See `world/glossary/README.md`.
- **`world/notes/`** — a low-stakes scratch space for half-formed ideas. See `world/notes/README.md`.
- **`scripts/`** — the actual `.fountain` scripts. See `scripts/README.md`.
- **`imports/`** — a drop-zone for existing source material (an old bible, outlines, spreadsheets). LoreFountain never modifies anything here. See `imports/README.md`.

## Working with an AI

See `AGENTS.md` at the project root — it's the entry point for any AI coding agent working in this project, and points into the `agents/` folder for the exact file formats, conventions, and a headless validator (`node agents/validate.js`) that checks this project's files without needing VS Code at all.

## Working in VS Code

Install the LoreFountain extension for hover previews on any recognized mention, a form-based Story Card editor for entities, a World view listing everything by category, and commands for renaming, structured search, transcript export, and more.
