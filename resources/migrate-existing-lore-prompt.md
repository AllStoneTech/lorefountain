You are helping a writer migrate their existing story bible into LoreFountain, a
worldbuilding format made of plain Markdown files with YAML frontmatter. Follow
these instructions exactly — they work with any coding agent (Cursor,
Copilot, Gemini, or otherwise), not just one in particular.

## What you're doing

Read every existing document in `{{IMPORTS_FOLDER}}/` (bibles, outlines,
character sheets, spreadsheets, scripts — whatever the writer put there).
Identify every distinct **entity** mentioned — a character, location, faction,
object, or concept — and every piece of invented **terminology** (a made-up
word or phrase the setting uses, e.g. a name for a type of magic or a rank).
For each one, create a new file under `{{WORLD_FOLDER}}/` following the format
below.

This is a one-time batch conversion. Do not modify, move, or delete anything
in `{{IMPORTS_FOLDER}}/` or anywhere outside `{{WORLD_FOLDER}}/` — those source
documents stay exactly as they are.

## Ground rules

- **Never invent facts.** Only write down what the source material actually
  says. If a field isn't clearly supported by the text, leave it out entirely
  — an omitted field is fine; a guessed one is not.
- **One file per entity or term.** Filename is the entity's name, lowercased,
  with spaces and punctuation replaced by hyphens (e.g. "The Ark" becomes
  `the-ark.md`). If a file with that name already exists, skip it rather than
  overwriting — a human already started that one.
- **Entities go directly in `{{WORLD_FOLDER}}/`.** Terminology/glossary
  entries go in `{{WORLD_FOLDER}}/glossary/`.
- Every file is Markdown with YAML frontmatter (`---` delimited) followed by a
  body written in your own words summarizing what the source material
  establishes about that entity — a paragraph or two is plenty.

## Entity file format

```markdown
---
name: <the entity's canonical name, exactly as most commonly used in the source>
type: character | location | faction | object | concept
aliases: [<other names/spellings/nicknames used for the same entity, if any>]
pronunciation: <only if the source gives one>
tags: [<a few short freeform labels, if useful>]
canon_status: established
relations:
  - target: <slug of another entity file you're also creating>
    relation_type: <a short label, e.g. sibling, ally, rival, owns, located-in>
    attitude: <optional, only if the source describes one>
---

<A short prose summary of this entity, in your own words, based only on what
the source material says.>
```

`type: character` may also include `sound_motif`, `casting_notes`,
`appears_in` (a list of episode/script identifiers), and `first_appearance` —
include any of these only if the source actually specifies them.

`type: location` may also include `parent_location` (the slug of a
containing location, if this one is inside another) and `mobility`
(`fixed`, `mobile-per-episode`, or `mobile-continuous`) — again, only if
the source specifies it.

`faction`, `object`, and `concept` have no extra fields beyond the ones
listed above.

`relations` should only capture relationships the source material actually
states or clearly implies (e.g. "Sango and Esu are siblings" -> a relation on
each of their files pointing at the other). Every `target` must be the slug
you gave another file you're creating in this same pass — don't invent a
relation to something you haven't created a file for.

## Glossary term format

For invented terminology (not a character/location/faction/object/concept —
just a word or phrase the setting uses), create
`{{WORLD_FOLDER}}/glossary/<slug>.md`:

```markdown
---
term: <the term, exactly as used in the source>
gloss: <a one-sentence definition>
aliases: [<other spellings/forms, if any>]
tags: [<a few short freeform labels, if useful>]
---

<Optional longer explanation, if the source has more to say about it.>
```

## When you're done

List every file you created (or skipped because it already existed), grouped
by type, so the writer can review the batch before doing anything else with
it.
