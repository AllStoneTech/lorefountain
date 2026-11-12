<!-- lorefountain-docs-version: 1 -->
# The Heroic Slave — a historical audio drama

This project uses **[LoreFountain](https://github.com/AllStoneTech/lorefountain)** — a worldbuilding methodology for Fountain-format writing. At its core, it's just plain Markdown files (with YAML frontmatter) and standard Fountain scripts, checked by a small validator — no proprietary format, nothing locked to one tool. The [LoreFountain VS Code extension](https://github.com/AllStoneTech/lorefountain) is the richest way to use it (hover previews, a form-based editor for entities, one-click rename, structured search), but every file here is readable and editable in any text editor, and an AI coding agent can work in this project with no VS Code involved at all.

> **Content note.** This project adapts an 1853 text and **preserves its period language faithfully**, including racial slurs spoken by slaveholders, slave-traders, tavern loafers and sailors. They are kept verbatim, in those characters' mouths only, because the source uses them to show how these men speak and think; nothing has been softened or censored. The work depicts whipping, the separation of families, murder and the slave trade.

## What this demo is — and the use case it shows

**Use case: producing a historical audio drama — a voice-and-ocean-driven radio play.** If you make audio fiction, this is the demo to open. It adapts ***The Heroic Slave*** (1853) by **Frederick Douglass**, his only work of fiction, a novella in four parts based on the 1841 revolt aboard the brig *Creole*, as a six-episode radio drama. Its sibling demo *The Comet* is a science-fiction audio drama; this one is historical, built from wind, pine, chains, a roomful of men arguing, and the open Atlantic.

What it demonstrates for an audio producer:

- **Scripts built from cues.** Every scene uses `SFX:`, `MUSIC:` and `AMB:` lines plus parenthetical voice direction, so the script *is* the sound plan. LoreFountain extracts them to a cue sidecar, and **Export Cue Sheet** (Pro) turns them into a session list for your sound designer.
- **A sound world, documented.** `world/notes/the-sound-world.md` tracks recurring motifs (flint on a file, wind in pine becoming wind in rigging, chains), so the mix stays coherent across six episodes.
- **A cast the tool keeps straight.** Characters carry `sound_motif`, `casting_notes` and `physical_description`; locations, objects and concepts are all linked wherever their names appear in a script.
- **Memory versus the present.** The novella tells Madison's past as stories told to others, so the timeline separates when events *happened* from which episode *tells* them.
- **Honest adaptation.** Every fact from outside the text is `canon_status: tentative` or marked as context; `imports/source-material.md` lists every adaptation choice.

## What's in each folder

- **`world/`** — characters, locations, factions, objects, concepts and arcs, one file per entity, plus `OVERVIEW.md`. See `world/README.md`.
- **`world/glossary/`** — period terms, nautical words and real names. See `world/glossary/README.md`.
- **`world/notes/`** — historical context, open questions, the sound world, language and casting. See `world/notes/README.md`.
- **`world/timeline/`** — events in story order. See `world/timeline/README.md`.
- **`scripts/`** — six episodes (`1x01`–`1x06`). See `scripts/README.md`.
- **`imports/`** — the complete public-domain text (`the-heroic-slave.md`, corrected against the 1853 printing), the unchanged Wikisource transcription, the raw 1853 OCR, and a source-material citation. See `imports/README.md`.

## A note on the source

*The Heroic Slave* was published in 1853 and Douglass died in 1895, so it is in the public domain worldwide. The text in `imports/` is from [Wikisource](https://en.wikisource.org/wiki/The_Heroic_Slave), checked against the 1853 first printing and corrected (the scripts were written from the uncorrected transcription; see `imports/source-material.md`, "Comparison with the 1853 original"). The adaptation takes the novella's events and speeches; it never contradicts them. Where it dramatizes something the text only implies (the hold at night, the Nassau sergeant), the choice is listed in `imports/source-material.md`.

## Working with an AI

See `AGENTS.md` at the project root — it's the entry point for any AI coding agent working in this project, and points into the `agents/` folder for the exact file formats, conventions, and a headless validator (`node agents/validate.js`) that checks this project's files without needing VS Code at all.

## Working in VS Code

Install the LoreFountain extension for hover previews on any recognized mention, a form-based Story Card editor for entities, a World view listing everything by category, and commands for renaming, structured search, transcript export, and more.
