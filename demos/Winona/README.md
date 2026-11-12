<!-- lorefountain-docs-version: 1 -->
# Winona — a comic-book miniseries script

> **CONTENT NOTE.** This demo preserves period language, including racial slurs, because it adapts a historical text (serialized 1902-03, set in the 1850s) faithfully. The novel puts those words in the mouths of slave-hunters, overseers, a mob, a Missouri judge and a white abolitionist innkeeper who uses them while risking his life for the people he says them about, and the comic keeps them in the same mouths. They are never in a caption box. The story also shows whipping, a near-lynching and mob violence, and it keeps the scenes of the slave prison without drawing what the novel says "must not be described". Nothing here endorses any of it.

This project uses **[LoreFountain](https://github.com/AllStoneTech/lorefountain)** — a worldbuilding methodology for Fountain-format writing. At its core, it's just plain Markdown files (with YAML frontmatter) and standard Fountain scripts, checked by a small validator — no proprietary format, nothing locked to one tool. The [LoreFountain VS Code extension](https://github.com/AllStoneTech/lorefountain) is the richest way to use it (hover previews, a form-based editor for entities, one-click rename, structured search), but every file here is readable and editable in any text editor, and an AI coding agent can work in this project with no VS Code involved at all.

## What this demo is — and the use case it shows

**Use case: writing a comic book or graphic novel script in Page/Panel format.** If you script comics rather than screenplays, this is the demo to open. It adapts ***Winona: A Tale of Negro Life in the South and Southwest*** (1902) by **Pauline E. Hopkins** — an adventure serial about a girl on a Lake Erie island who is seized into slavery in Missouri and rescued across the Kansas border war by an English lawyer, her foster-brother and John Brown's camp — as an eight-issue American miniseries, 160 pages, in the PAGE/PANEL convention that LoreFountain reads on top of ordinary Fountain.

### What page/panel gives a comic writer

A comic script is plain Fountain with two more convention lines, `PAGE:` and `PANEL:`, and nothing else new. Everything else is what Fountain already is: scene headings, character cues and dialogue for balloons, `CAPTION:` for narration boxes, `SFX:` for lettered sound effects, `LAYOUT:` and `POSE:`/`LIGHT:` for artist direction. Open any script in `scripts/` in any Fountain app and it still reads as a script. What LoreFountain adds on top:

- **A page map you never write by hand.** Every issue gets a derived `<script>.pages.json` sidecar: pages, panels, balloons, captions, sound effects and lettered words, with the entities each panel's art direction mentions. The validator prints each issue's totals (this project: 160 pages, 750 panels, about 9,500 lettered words).
- **Checks on the things that go wrong in a comic script:** repeated or out-of-order page numbers, a panel before any page, lettering floating outside a panel, a splash page with several panels, and word budgets (more than 9 panels on a page, more than 5 balloons in a panel, a balloon over 25 words, more than 40 words of dialogue in a panel). The scripts here pass with no warnings and no notes.
- **Page-turn and splash marking** in the page header: `PAGE: 17 (SPLASH)`, `PAGE: 20 (TURN)`.
- **A page is not a scene.** Scene headings stay real (`EXT. THE POSSAWATOMIE CLIFFS - DAY`) and run underneath the pages, so "which scenes have both Winona and Judah in them" still works in Structured Search while the pages run on.
- **A cast the tool keeps straight.** Every character, location, group, prop and arc is a file in `world/`, linked automatically wherever its name appears in a panel's art direction or a speaker cue. The Winona/Allen Pinks disguise, a murdered brother whom the source gives the same name as his dying father, and a villain whose last confession reveals three secrets are all tracked with `canon_status` flags and notes.
- **Timeline vs. page order.** `world/timeline/` separates story chronology from where an event lands in the series (`production_code` and `chronological_order` on each event); Young Lord George's murder happens first in the story and is told last, in Issue 8.
- **Adaptation notes you can trust.** `imports/source-material.md` records exactly what this adaptation took from the novel, what it changed, which lines are invented and what the source leaves unsettled.

### The eight issues

| Issue | Title | Novel | Pages | What happens |
|---|---|---|---|---|
| 1 | The Island | Ch. I–II | 20 | The hunters on the island; White Eagle shot; "It is murder!" |
| 2 | Magnolia Farm | Ch. III–V | 23 | The funeral and the promise; the traders' claim; two years in Missouri; the horse and the whipping |
| 3 | The Crescent | Ch. VI–VII | 18 | Warren at the farm; Judah's night plea; the wharf; the escape from the steamer |
| 4 | The Underground Railroad | Ch. VIII–IX | 21 | Steward's cabin; the ride to Brown's camp; the ambush |
| 5 | The Cross-Roads | Ch. X–XII | 22 | The stake; Judah's proposal; the trial; Allen Pinks |
| 6 | Possawatomie | Ch. XIII–XIV | 18 | The jail break; the camp; the peak |
| 7 | The Ledge | Ch. XV–XVI (part) | 18 | The battle; Thomson's fall; Winona stops Judah's second shot |
| 8 | Jubilee | Ch. XVI (part)–XVII | 20 | The confession; the tin box; England; the song |

## What's in each folder

- **`world/`** — the story world: characters, locations, groups, objects, concepts and arcs, one file per entity (40). See `world/README.md`.
- **`world/glossary/`** — period terminology (10 terms). See `world/glossary/README.md`.
- **`world/notes/`** — open questions for the writer and artist (7). See `world/notes/README.md`.
- **`world/timeline/`** — in-world events, separate from the entities that take part in them (29). See `world/timeline/README.md`.
- **`scripts/`** — the eight issue scripts, one folder each. See `scripts/README.md`.
- **`imports/`** — the full public-domain source text and a citation file. See `imports/README.md`.

## A note on the source

The novel was serialized in 1902 and 1903 and published in book form in 1902. It is melodramatic, funny in its dialect comedy and plain about slavery and mob violence. It also has loose ends, among them two characters called Lord George, a date that does not fit, and a villain whose fate after the jail break is never stated. This adaptation keeps the events and the language, keeps the wording of the novel's key speeches, and says where it changed or compressed. See `imports/source-material.md` for exactly what was kept, what was changed, which spoken lines are invented and what is left unsettled.

## Working with an AI

See `AGENTS.md` at the project root — it's the entry point for any AI coding agent working in this project, and points into the `agents/` folder for the exact file formats, conventions (including the comic-script PAGE/PANEL convention in `agents/script-writer.md`) and a headless validator (`node agents/validate.js`) that checks this project's files without needing VS Code at all.

## Working in VS Code

Install the LoreFountain extension for hover previews on any recognized mention, a form-based Story Card editor for entities, a World view listing everything by category, and commands for renaming, structured search, transcript export, and more.
