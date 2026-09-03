# The Story Card Editor

The Story Card editor is the default view for any entity file under
`world/*.md` (character, location, faction, object, concept, or arc) — a
form drawn over the plain Markdown/YAML file, instead of raw text.

## What it covers

- Every base field: **Name**, **Type**, **Aliases**, **Pronunciation**,
  **Tags**, **Canon Status**, **Significance**, and the free-text
  **Description** body.
- Type-specific fields, shown/hidden as you change **Type**: **Sound Motif**
  and **Casting Notes** (Character), **Physical Description** (Character and
  Faction — freeform, useful as raw material for an external AI image
  generator), **Parent Location** and **Mobility** (Location), **Episodes**
  (Arc — a list of script Production Codes this arc spans).
- **Relations** — deliberate, typed links to other entities (target,
  relation type, optional attitude), separate from the automatic mentions
  any entity name gets just by appearing in another file's prose.

## What it doesn't cover

`tracked_fields` (a history-log of noted facts over time) and
`custom_fields` (free-form key/value pairs for anything with no dedicated
field) aren't editable here — both are preserved untouched if already
present, never dropped, just not surfaced in the form. Right-click the
editor tab → **Reopen Editor With…** → **Text Editor** to work with the raw
YAML for those, then reopen normally (or just switch tabs back) to return to
the form.

## Saving

Just a form drawn over a plain text document — the usual dirty dot, undo
(Ctrl+Z), and save (Ctrl+S, or leave autosave on) all work exactly as they
would editing the file directly. Nothing about a Story Card requires VS
Code: the underlying file is always plain, portable Markdown, and a power
user can hand-edit it in any text editor at any time.

## A malformed file

If the file's frontmatter doesn't currently parse — invalid YAML, a schema
violation — the form doesn't try to guess or auto-repair; fix the raw file
(Reopen Editor With… → Text Editor) and the form picks back up once it's
valid again.

If you're using an AI coding tool in this project, see
`agents/world-builder.md` at the project root for the exact file format it
should follow — the same schema this form edits.
