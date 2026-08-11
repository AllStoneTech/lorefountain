# LoreFountain — World-Building Reference

Read this before creating or editing any file under `world/`. It works with any coding agent — no tool-specific syntax required.

`world/` here means this project's actual world folder — check `AGENTS.md`'s "Folder names" section for how to find its real name if this project doesn't use the default.

## Where things go

- `world/OVERVIEW.md` is the project's single Story Overview — see "Story Overview format" below. There's only ever one of these per project, unlike every other item in this list.
- Characters, locations, factions, objects, concepts, and arcs go directly in `world/` — one file per entity.
- Terminology/glossary entries go in `world/glossary/`.
- Half-formed ideas that aren't ready to be a real entity yet go in `world/notes/` — free-form Markdown, no frontmatter, no schema, never validated. If the writer describes something too vague to schema-fy ("what if the ship has a hidden deck"), put it here rather than forcing it into an entity file with guessed fields. Promote it to a real entity later, once there's enough to say.
- Timeline events go in `world/timeline/` — see "Timeline event format" below. Only create one when the writer actually describes something that happened (an in-world event), not for general worldbuilding notes — those go in `world/notes/` instead.
- Never write into `imports/` — that folder holds the writer's own source material and is never modified by LoreFountain or by an AI working in this project.
- Filename is the entity's name, lowercased, with spaces and punctuation replaced by hyphens (e.g. "The Ark" becomes `the-ark.md`). If a file with that name already exists, don't overwrite it without asking — a human or an earlier pass may have already started it.

## Entity file format

```markdown
---
name: <the entity's canonical name>
type: character | location | faction | object | concept | arc
aliases: [<other names/spellings/nicknames, if any>]
pronunciation: <only if known>
tags: [<a few short freeform labels, if useful>]
canon_status: established | tentative | contradicted
significance: main | supporting | minor
relations:
  - target: <slug of another entity file — never a glossary term>
    relation_type: <a short label, e.g. sibling, ally, rival, owns, located-in>
    attitude: <optional>
---

<A short prose summary of this entity, in your own words.>
```

Any entity type may set `significance` (`main`, `supporting`, or `minor`) — it groups the World tree's sidebar so leads don't get lost among the rest of the cast. It's about narrative weight, not how often something appears — leave it unset unless the writer actually cares to distinguish this entity from the rest of its category.

`type: character` may also include `sound_motif`, `casting_notes`, `appears_in` (a list of episode/script identifiers), `first_appearance`, `voice_actor` (the actor cast in the role, if known — only fill this in if the writer tells you, never guess), and `physical_description` (see below).

`type: location` may also include `parent_location` (the slug of a containing location) and `mobility` (`fixed`, `mobile-per-episode`, or `mobile-continuous`).

`type: faction` may also include `physical_description` (see below) — a faction's visual identity (heraldry, uniform, colors) rather than a person's.

`type: arc` may also include `episodes` — a list of the script Production Codes (e.g. `["1x03", "1x04", "1x07"]`) this arc spans. An arc's episodes don't need to be contiguous or confined to one season; list exactly the episodes the writer names, never guess which episodes belong to an arc. A code that doesn't match any real script is flagged (not rejected) the same way a dangling `relations` target is.

`object` and `concept` have no extra fields beyond the ones listed above.

**`physical_description`** (character and faction only) is freeform text meant to eventually feed an external AI image generator — LoreFountain itself never generates images. Informal `Key: Value` lines up top are encouraged but not required, e.g.:

```yaml
physical_description: |
  Race: Orc
  Hair: Black, braided
  Eyes: Purple

  Walks with a slight limp from an old wound.
```

A world's own catalog of species/races (Orc, Elf, Human, etc.) belongs as Concept entities or Glossary terms, not a structured field here — `physical_description` is free text precisely because that vocabulary is different for every project.

For structured reference data that doesn't fit any named field (a spreadsheet row's worth of attributes, for example), use `custom_fields` — a free-form map of key/value pairs, e.g.:

```yaml
custom_fields:
  domain: Ocean, motherhood, deep water
  sacred_number: 7
```

## Glossary term format

```markdown
---
term: <the term, exactly as used in the source>
gloss: <a one-sentence definition>
aliases: [<other spellings/forms, if any>]
tags: [<a few short freeform labels, if useful>]
---

<Optional longer explanation.>
```

## Timeline event format

```markdown
---
name: <the event's short descriptive name>
production_code: <SxEE of the script that depicts this event, if any — never guess or invent one>
narrative_order: <a manual whole number, only if there's no production_code yet to anchor it>
chronological_order: <a whole number giving this event's relative in-universe sequence — not a real date>
in_universe_date: <a free-text label, e.g. "three years before the pilot", only if the writer says so>
participants: [<slugs of the characters/locations involved>]
canon_status: established | tentative | contradicted
tags: [<a few short freeform labels, if useful>]
---

<A short prose description of what happens.>
```

Every field except `name` is optional — never guess a `chronological_order`, `production_code`, or `participants` entry the writer hasn't actually told you. An event with only a name is a valid, useful placeholder to backfill later, same as any other entity.

## Story Overview format

`world/OVERVIEW.md` has a small YAML frontmatter block with four optional, genuinely universal fields — `title`, `pitch` (a one- or two-sentence logline), `tone`, `genre` — followed by plain-prose Markdown, same as an entity file's split. Only the frontmatter fields are schema-validated; the body below is free-form and nothing there is checked:

```markdown
---
title: <Project Name>
pitch: <one or two sentences>
tone: <e.g. wry, elegiac, pulpy>
genre: <e.g. speculative drama>
---

## Premise

<One or two sentences: what is this story fundamentally about?>

## Setting

<Where and when does this take place?>

## Key Characters

<A short list of the core cast and their one-line roles.>

## Synopsis

<A few paragraphs covering the overall arc.>

## Themes

<What is this story actually about, underneath the plot?>
```

Feel free to adjust the body's section headers if the project genuinely doesn't fit them (a game world might want "Factions" instead of "Key Characters," for instance) — only the four frontmatter fields above are ever validated; the body is a reference document for humans and AI agents, not a fixed format. Leave a frontmatter field out entirely rather than writing it blank if the writer hasn't told you its value — never guess a pitch, tone, or genre.

## Ground rules

- **Never invent facts.** Only write down what's clearly supported by source material or explicit instruction from the writer. An omitted field beats a guessed one.
- **Relations vs. mentions.** `relations` are deliberate, typed links you're intentionally drawing between two entities (siblings, allies, factions, owns, located-in). A name simply appearing in another entity's prose body, or in a script, becomes an automatic "mention" on its own — you don't need to do anything for that to work, and you shouldn't add a formal relation just because two names appear near each other.
- **A `relations[].target` must be another entity's slug** (its filename without `.md`) — either one that already exists, or one you are creating in this same pass. It is never a glossary term; cross-references to glossary terms work automatically as mentions, or explicitly via a `[[Term Name]]` wikilink in the body text.
- **Renaming.** If an entity that already has other files pointing at it needs a new name, prefer LoreFountain's own "Rename Entity" command (or ask the writer to run it) rather than hand-editing every reference yourself — it also keeps the old name working as an alias so nothing already written about it breaks.
- **Some things only the writer can do.** "Rename Entity," "Show Broken References," and "Structured Search" (Command Palette or the LoreFountain World view) only run inside VS Code — if you're working through file edits alone, you can't invoke them yourself. Tell the writer these exist and when to use them instead of trying to replicate their exact behavior by hand (e.g. don't hand-write a broken-reference report; tell them to run "Show Broken References").
- **Check your own work.** After creating or editing any files, run `node agents/validate.js` from the project root. It reports the same checks LoreFountain runs live — malformed files, dangling relation targets, and dangling arc episode references — with no VS Code needed. Fix anything it reports before telling the writer you're done, and include its final output in your summary.
