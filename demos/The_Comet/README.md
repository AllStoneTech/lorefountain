<!-- lorefountain-docs-version: 1 -->
# The Comet — a six-part audio drama

This project uses **[LoreFountain](https://github.com/AllStoneTech/lorefountain)** — a worldbuilding methodology for Fountain-format writing. At its core, it's just plain Markdown files (with YAML frontmatter) and standard Fountain scripts, checked by a small validator — no proprietary format, nothing locked to one tool. The [LoreFountain VS Code extension](https://github.com/AllStoneTech/lorefountain) is the richest way to use it (hover previews, a form-based editor for entities, one-click rename, structured search), but every file here is readable and editable in any text editor, and an AI coding agent can work in this project with no VS Code involved at all.

> **CONTENT NOTE.** This project adapts a historical text from 1920. It preserves the source's period language faithfully, including a racial slur spoken by two of its characters and the period terms "Negro" and "colored." Nothing has been censored or softened, because the language is part of what the story shows. If you work on this demo, keep it that way.

## What this demo is — and the use case it shows

**Use case: producing an audio drama.** If you make sound-driven fiction (cues, ambience, music, a small cast), this is the demo to open. It adapts **["The Comet"](https://www.gutenberg.org/ebooks/15210)** (1920) by **W.E.B. Du Bois** — a short story in his collection *Darkwater* about a Black bank messenger and a rich white woman who survive a comet's passage over New York and spend a night believing they are the last two people alive — as six episodes in standard Fountain format.

What it demonstrates for an audio producer:

- **Cues as first-class script text.** Every episode is dense with `SFX:`, `MUSIC:` and `AMB:` lines in the script itself. LoreFountain extracts them into a cue sidecar (`*.cues.json`) next to each script, which Export Cue Sheet (LoreFountain Pro) turns into a session cue list for the mixer. See `scripts/Season 01/1x04-the-switchboard/` for the longest unanswered-sound stretch.
- **Silence as a scene.** The story is mostly silence, so the scripts write silence as AMB and SFX cues (stopped clocks, one dripping pipe, a dead switchboard) rather than leaving gaps for the editor to guess at. `world/the-return-of-sound.md` tracks the sound arc across all six episodes.
- **A small cast the tool keeps straight.** Jim, Julia, Fred, Julia's father, Jim's wife and a narrator, with pronunciation notes, casting notes and `sound_motif` fields on each character.
- **A real map of a real place.** Wall Street, Broadway, Fifth Avenue, Madison Square, Harlem and the Metropolitan Tower are locations the scripts link to wherever they are named.
- **A timeline with production codes.** `world/timeline/` places each event in story order and tags it with the script that depicts it.
- **Honest adaptation notes.** `imports/source-material.md` records what the audio drama took from the story and what it added, and `world/notes/` holds the open production questions.

## What's in each folder

- **`world/`** — the story world: characters, locations, a faction, objects, concepts, and arcs, one file per entity. See `world/README.md`.
- **`world/glossary/`** — period and place terminology. See `world/glossary/README.md`.
- **`world/notes/`** — production questions (how to deliver the slur, what the comet did, running time). See `world/notes/README.md`.
- **`world/timeline/`** — in-world events, in story order. See `world/timeline/README.md`.
- **`scripts/`** — the audio drama, six episodes in `Season 01`. See `scripts/README.md`.
- **`imports/`** — the full *Darkwater* text from Project Gutenberg (the story is chapter X) and a citation and adaptation file. See `imports/README.md`.

## A note on the source

"The Comet" was first published in *Darkwater: Voices from within the Veil* in 1920. W.E.B. Du Bois died in 1963, so it is in the **public domain in the United States**; it may not be in the public domain in countries where copyright runs life plus seventy years. Anyone using this demo outside the US should check local law.

The story is short, so this adaptation does not pad it: the plot and the dialogue are Du Bois's, expanded only by sound design, a narrator, and small connective lines that are listed openly in `imports/source-material.md`. Anything in `world/` that is inferred rather than stated in the text is marked `canon_status: tentative`.

## Working with an AI

See `AGENTS.md` at the project root — it's the entry point for any AI coding agent working in this project, and points into the `agents/` folder for the exact file formats, conventions, and a headless validator (`node agents/validate.js`) that checks this project's files without needing VS Code at all.

## Working in VS Code

Install the LoreFountain extension for hover previews on any recognized mention, a form-based Story Card editor for entities, a World view listing everything by category, and commands for renaming, structured search, transcript export, and cue-sheet export.
