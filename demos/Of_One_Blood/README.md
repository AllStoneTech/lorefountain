<!-- lorefountain-docs-version: 1 -->
# Of One Blood

This project uses **[LoreFountain](https://github.com/AllStoneTech/lorefountain)** — a worldbuilding methodology for Fountain-format writing. At its core, it's just plain Markdown files (with YAML frontmatter) and standard Fountain scripts, checked by a small validator — no proprietary format, nothing locked to one tool. The [LoreFountain VS Code extension](https://github.com/AllStoneTech/lorefountain) is the richest way to use it (hover previews, a form-based editor for entities, one-click rename, structured search), but every file here is readable and editable in any text editor, and an AI coding agent can work in this project with no VS Code involved at all.

## What this demo is

A worked example built from **[*Of One Blood; or, The Hidden Self*](https://www.gutenberg.org/ebooks/69255)** (1902–03), the speculative-fiction novel by **Pauline Hopkins** — the first novel by an African American author to feature Africa and African characters as a setting. It's in the U.S. public domain, which is why it was picked: every fact modeled here is free to build on, adapt, and redistribute.

The novel gives LoreFountain real material to demonstrate against: a large cast whose relationships aren't what they first appear to be, a plot split between two very different settings (Gilded Age Boston and the hidden city of Telassar), a chronology that isn't told in order (a decades-old secret gets revealed only near the end), and a mystery-driven structure where "who's related to whom" is the entire engine of the story. That's exactly the kind of continuity load this tool exists to carry.

Everything in `world/` and `scripts/` was written from published plot summaries and the novel's own publication facts, not copied from the original text — it's an original adaptation and interpretation, not a reproduction.

## What's in each folder

- **`world/`** — the story world: characters, locations, factions, objects, concepts, and arcs, one file per entity. See `world/README.md`.
- **`world/glossary/`** — invented and period terminology. See `world/glossary/README.md`.
- **`world/notes/`** — a low-stakes scratch space for half-formed ideas. See `world/notes/README.md`.
- **`world/timeline/`** — in-world events, separate from the entities that participate in them. See `world/timeline/README.md`.
- **`scripts/`** — a 24-episode Fountain adaptation, one script per chapter of the novel. See `scripts/README.md`.
- **`imports/`** — source citations for this demo. See `imports/README.md`.

## Working with an AI

See `AGENTS.md` at the project root — it's the entry point for any AI coding agent working in this project, and points into the `agents/` folder for the exact file formats, conventions, and a headless validator (`node agents/validate.js`) that checks this project's files without needing VS Code at all.

## Working in VS Code

Install the LoreFountain extension for hover previews on any recognized mention, a form-based Story Card editor for entities, a World view listing everything by category, and commands for renaming, structured search, transcript export, and more.
