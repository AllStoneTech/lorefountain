<!-- lorefountain-docs-version: 1 -->
# The Count of Monte Cristo — a prose novel with a story bible

This project uses **[LoreFountain](https://github.com/AllStoneTech/lorefountain)**, a worldbuilding methodology for Fountain-format writing. At its core it is plain Markdown files with YAML frontmatter and standard Fountain files, checked by a small validator. The [LoreFountain VS Code extension](https://github.com/AllStoneTech/lorefountain) is the richest way to use it, but every file here is readable in any text editor, and an AI coding agent can work in this project with no VS Code at all.

> **Content note.** The manuscript in `scripts/` is the **unaltered public-domain text** of the English translation published as Project Gutenberg #1184, including its period language and attitudes. The only changes are mechanical (see `imports/source-material.md`): paragraphs reflowed to one line each, `_italics_` turned into `*italics*`, and illustration placeholders removed. No words were added, removed or modernised.

## What this demo is — and the use case it shows

**Use case: writing a literary novel or serialized prose fiction** — a manuscript plus a living story bible. LoreFountain was built around screenplay structure, and its spec calls prose novelists out of scope because the script parser keys on character cues and scene headings. This demo tests whether a literary author can be served anyway, with **no new parsing engine**, by writing prose chapters *inside* `.fountain` files: one file per chapter, plain paragraphs, headings as Fountain sections.

The source is *The Count of Monte Cristo* (serialized 1844–46) by Alexandre Dumas, in the full 117-chapter translation. It is a stress test: a huge cast, six alternate identities for one man, a plot that depends on who knows what when, and a handful of continuity slips of its own.

What it demonstrates for a novelist:

- **A whole manuscript as 117 manageable files.** One file per chapter in five volume folders. Revise, reorder or hand off a chapter without touching the rest.
- **A living bible linked to the prose.** Names and aliases in the chapters link to entity cards. Across the 117 chapters, a scratch check (a script I wrote to mimic the matcher, not LoreFountain itself) finds about 14,000 mentions. One entity card carries six names: Dantès is also the Count, Sinbad the Sailor, the Abbé Busoni and Lord Wilmore.
- **Story time versus telling order.** `world/timeline/` records what happened when, separately from the chapter that reveals it (Cardinal Spada's death in 1498 is told in chapter 18; Benedetto's birth in 1817 surfaces in chapters 43–45).
- **Continuity flags you can trust.** Where the book contradicts itself, the entity or event is `canon_status: contradicted`, with the chapters quoted. See `world/notes/continuity-ledger.md`.
- **Arcs by chapter.** Each revenge, the escape, and the Morrel rescue lists the chapters it spans.

## What a novelist gets, and what they don't

**What works**

- **Hover and link on any name anywhere in a paragraph.** Matching is plain text and case-insensitive over the whole file, so prose gets the same linking as an action line. Longest name wins, so "Ali Pasha" is not read as "Ali".
- **Aliases for multi-identity characters.** One card answers to every name, with `tracked_fields` for identity and whereabouts over time.
- **The validator.** `node agents/validate.js` checks every file and every relation or arc chapter code.
- **Timeline, arcs, glossary, notes** work exactly as in a screenplay project, because they never depended on the script's structure.
- **The Scripts view**, chapter ordering and unique Production Codes keep working, with the volume folders as groups.

**What doesn't, and why**

- **No presence from character cues.** There are no cues, because dialogue is ordinary quoted prose in a paragraph. Anything that reads "who speaks" (speaker presence, a dialogue-only Export Transcript) has nothing to read. A name inside a paragraph still links, but that only tells you the name was mentioned, not that the character was in the scene.
- **No scene-based continuity.** Chapters contain no scene headings, so views that group by scene have nothing to group. Adding forced headings (a line beginning with `.`) at section breaks might help, but that changes the manuscript and was not tried here.
- **No SFX/MUSIC/AMB cues or SHOT lists.** Those conventions are plain-text prefixes; this book uses none, and no `.cues.json` sidecar is produced (none exists in this folder). The Pro exports built on them are meaningless for a novel.
- **Whole-chapter granularity only.** "Which chapters mention X" is easy; "which paragraph" is up to your own search.
- **Hard-wrapped manuscripts lose some links.** A name split across a line break doesn't match. Reflowing paragraphs to one line each raised the mention count from 13,953 to 14,074, and it is also what VS Code word-wrap expects.
- **Footnote markers glue to words.** In this Gutenberg text a footnote number is printed against the last word ("Pasha13"), which blocks the name from matching. There are only thirty footnotes in the whole book.
- **Shared names are noisy.** "Morrel" is both Pierre and Maximilian and "Morcerf" is both Albert and Fernand, so bare mentions link to two cards. "Ali" also appears inside "Ali Baba". The honest options are a longer alias or accepting the ambiguity.
- **Title-page text is matched too.** A chapter title containing a character's name links it.

**What parses quietly, and what does not.** The Fountain parser read all 117 converted chapters as only action and section tokens, with no accidental cues, headings or transitions. Prose written by a novelist can trip it, and I tested which constructs do. A paragraph whose first line has no lowercase letters (followed by more lines) becomes a character cue with dialogue. A one-line paragraph starting `Int.`/`Ext.`/`Est.` becomes a scene heading, one ending ` TO:` becomes a transition, and lines starting `>`, `~`, `=`, `===`, or a whole line of `[[...]]` become transitions, lyrics, synopses, page breaks or notes. A leading `!` forces all of these back to ordinary action *except* the ` TO:` transition, which has to be reworded. A leading `\` escapes a `[[` note.

## What's in each folder

- **`world/`** — 98 entities: 57 characters, 19 locations, 3 factions, 8 objects and 11 arcs. See `world/README.md`.
- **`world/glossary/`** — fifteen period and domain terms.
- **`world/notes/`** — the continuity ledger (31 places where the book disagrees with itself), who-knows-the-Count, and open questions for a literary author.
- **`world/timeline/`** — 35 events, with chronology separate from telling order.
- **`scripts/`** — the manuscript, 117 chapters in five volumes. See `scripts/README.md`.
- **`imports/`** — the complete Gutenberg text as `the-count-of-monte-cristo.md` and `source-material.md`, which records how the chapters were made and the review against the source.

## A note on how this was built

The chapters were split mechanically from the Gutenberg text (kept in full as `imports/the-count-of-monte-cristo.md`) and checked word for word against it. The story bible was written afterwards, and a second pass then read chapters 43–117 in full and checked every card, term, timeline event and note against the text. Every claim in `world/` is intended to be traceable to a chapter. See the "Review against the source" section of `imports/source-material.md` for what that pass found and fixed, and for the minor characters still without cards.

## Working with an AI

See `AGENTS.md` at the project root. It points into `agents/` for the file formats and a headless validator (`node agents/validate.js`).

## Working in VS Code

Install the LoreFountain extension for hover previews on any recognized mention, a form-based Story Card editor, a World view listing everything by category, and commands for renaming and structured search.
