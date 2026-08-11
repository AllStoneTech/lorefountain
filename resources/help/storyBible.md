# Story-Bible Export (LoreFountain Pro)

Story-Bible Export is a paid-tier feature: compiles your World, Glossary,
Timeline, Story Overview, and an Episode Index into one presentable
reference document. If running **"Export Story Bible (Pro)"** instead
prompts for a license key, run **Command Palette → "LoreFountain: Enter
License Key"** to unlock it.

## Running it

Command Palette, or the World view's `...` overflow menu → **"Export
Story Bible (Pro)."** You'll be asked for a format — **Markdown**,
**Word (.docx)**, or **Both** — then one save dialog. Choosing Both
writes the `.docx` as the primary file and a `.md` sibling alongside it
automatically, no second dialog.

## What's in it, and in what order

1. **Story Overview** (only if `world/OVERVIEW.md` exists) — its pitch,
   tone, genre, and body.
2. One section per non-empty entity category, in the same order as the
   World view (Characters, Locations, Factions, Objects, Concepts, Arcs)
   — each entity's aliases, canon status, and prose body, with relations
   written out as readable sentences ("Ally of Esu (trusts)") rather than
   raw frontmatter. `tracked_fields` history and raw `custom_fields`
   aren't included — this is a presentable reference, not a data dump.
3. **Glossary**, alphabetized.
4. **Timeline**, sorted by chronological order (events with no
   `chronological_order` set are listed last, not omitted).
5. **Episode Index** — every script's Production Code, title, and Order,
   as an appendix table.

Categories you've hidden from the World view (gear icon → Settings) are
excluded here too — hiding is a navigation preference the export
respects, not something you need to redo per export. `Notes` never
appears; it's never indexed.

## The Word version's Table of Contents

The `.docx`'s Table of Contents is a live field, not precomputed text —
Word only fills in real page numbers after you accept the "update
fields" prompt the first time you open it (or right-click the ToC →
**Update Field**). This is normal Word/OOXML behavior, not a broken
export — the command's confirmation message reminds you of this whenever
a `.docx` was written.
