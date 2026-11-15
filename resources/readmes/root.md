<!-- lorefountain-docs-version: 4 -->
# {{PROJECT_NAME}}

This project uses **[LoreFountain](https://github.com/AllStoneTech/lorefountain)** — a worldbuilding methodology for Fountain-format writing. At its core, it's just plain Markdown files (with YAML frontmatter) and standard Fountain scripts, checked by a small validator — no proprietary format, nothing locked to one tool. The [LoreFountain VS Code extension](https://github.com/AllStoneTech/lorefountain) is the richest way to use it (hover previews, a form-based editor for entities, one-click rename, structured search), but every file here is readable and editable in any text editor, and an AI coding agent can work in this project with no VS Code involved at all.

## What's in each folder

- **`{{WORLD_FOLDER}}/`** — the story world: characters, locations, factions, objects, concepts, and arcs, one file per entity. See `{{WORLD_FOLDER}}/README.md`.
- **`{{WORLD_FOLDER}}/glossary/`** — invented terminology and vocabulary. See `{{WORLD_FOLDER}}/glossary/README.md`.
- **`{{WORLD_FOLDER}}/notes/`** — a low-stakes scratch space for half-formed ideas. See `{{WORLD_FOLDER}}/notes/README.md`.
- **`{{SCRIPTS_FOLDER}}/`** — the actual `.fountain` scripts. See `{{SCRIPTS_FOLDER}}/README.md`.
- **`{{IMPORTS_FOLDER}}/`** — a drop-zone for existing source material (an old bible, outlines, spreadsheets). LoreFountain never modifies anything here. See `{{IMPORTS_FOLDER}}/README.md`.
- **`{{ASSETS_FOLDER}}/`** — production assets (audio, character/location/object rigs) and the manifests mapping a cue tag or entity id to the file that fulfills it, so the same asset is reused every time it recurs. See `{{ASSETS_FOLDER}}/README.md`.

## File naming, and what to keep in version control

LoreFountain never touches your source control. This section only tells you which files are yours and which the tool regenerates, so you can set up whatever backup or version-control system you use.

**Files you write. Keep these.**

| Name | What it is |
| --- | --- |
| `*.md` under `{{WORLD_FOLDER}}/` | Story entities, glossary terms, notes and timeline events. |
| `*.fountain` under `{{SCRIPTS_FOLDER}}/` | Your scripts. |
| `*.lf.md` (for example `{{WORLD_FOLDER}}/style.lf.md`, `{{WORLD_FOLDER}}/overview.lf.md`) | LoreFountain project documents: the style bible and the story overview. Your content, never indexed as an entity. |
| `{{ASSETS_FOLDER}}/manifests/*.json` | Hand-authored asset manifests mapping a tag or entity id to a file. |
| `lorefountain.config.json` | Project settings. |
| `{{IMPORTS_FOLDER}}/` | Your own source material, which LoreFountain never modifies. |

**Generated files. Safe to leave out of version control.** LoreFountain rebuilds these from your scripts, so never edit them by hand:

| Name | What it is |
| --- | --- |
| `<script>.shots.json` | The shot map derived from a script's `SHOT:` lines (or panels). |
| `<script>.breakdown.json` | Each scene's cast and looks, locations, objects, sounds and on-screen text, derived from a script's shots and `LOOK:` lines. |
| `<script>.cues.json` | The audio cues derived from `SFX:`, `MUSIC:` and `AMB:` lines. |
| `<script>.pages.json` | The page and panel map derived from a comic script. |
| `.lorefountain/`, `*.lorefountain.db` | The local search index, specific to your machine. |

`AGENTS.md`, `agents/` and the `README.md` files are scaffolded once, then updated only when you run **Check for LoreFountain File Updates**. Keep them: a collaborator, or an AI agent working without the extension, relies on them.

If you do track the generated sidecars, they still work, but a small script edit can produce a large diff in them.

**Files from other tools.** `*.lfp.json` files belong to LoreFountain-Producer. It reads LoreFountain's files, and LoreFountain reads its files, but neither tool edits the other's. Producer files hold production state that cannot be rebuilt from your scripts, so keep them.

## Working with an AI

See `AGENTS.md` at the project root — it's the entry point for any AI coding agent working in this project, and points into the `agents/` folder for the exact file formats, conventions, and a headless validator (`node agents/validate.js`) that checks this project's files without needing VS Code at all.

## Working in VS Code

Install the LoreFountain extension for hover previews on any recognized mention, a form-based Story Card editor for entities, a form-based editor for the `{{ASSETS_FOLDER}}/manifests/` files, a World view listing everything by category, and commands for renaming, structured search, transcript export, and more.
