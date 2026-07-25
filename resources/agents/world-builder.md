# LoreFountain — World-Building Reference

Read this before creating or editing any file under `{{WORLD_FOLDER}}/`. It works with any coding agent — no tool-specific syntax required.

## Where things go

- Characters, locations, factions, objects, and concepts go directly in `{{WORLD_FOLDER}}/` — one file per entity.
- Terminology/glossary entries go in `{{WORLD_FOLDER}}/glossary/`.
- Never write into `{{IMPORTS_FOLDER}}/` — that folder holds the writer's own source material and is never modified by LoreFountain or by an AI working in this project.
- Filename is the entity's name, lowercased, with spaces and punctuation replaced by hyphens (e.g. "The Ark" becomes `the-ark.md`). If a file with that name already exists, don't overwrite it without asking — a human or an earlier pass may have already started it.

## Entity file format

```markdown
---
name: <the entity's canonical name>
type: character | location | faction | object | concept
aliases: [<other names/spellings/nicknames, if any>]
pronunciation: <only if known>
tags: [<a few short freeform labels, if useful>]
canon_status: established | tentative | contradicted
relations:
  - target: <slug of another entity file — never a glossary term>
    relation_type: <a short label, e.g. sibling, ally, rival, owns, located-in>
    attitude: <optional>
---

<A short prose summary of this entity, in your own words.>
```

`type: character` may also include `sound_motif`, `casting_notes`, `appears_in` (a list of episode/script identifiers), and `first_appearance`.

`type: location` may also include `parent_location` (the slug of a containing location) and `mobility` (`fixed`, `mobile-per-episode`, or `mobile-continuous`).

`faction`, `object`, and `concept` have no extra fields beyond the ones listed above. For structured reference data that doesn't fit any named field (a spreadsheet row's worth of attributes, for example), use `custom_fields` — a free-form map of key/value pairs, e.g.:

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

## Ground rules

- **Never invent facts.** Only write down what's clearly supported by source material or explicit instruction from the writer. An omitted field beats a guessed one.
- **Relations vs. mentions.** `relations` are deliberate, typed links you're intentionally drawing between two entities (siblings, allies, factions, owns, located-in). A name simply appearing in another entity's prose body, or in a script, becomes an automatic "mention" on its own — you don't need to do anything for that to work, and you shouldn't add a formal relation just because two names appear near each other.
- **A `relations[].target` must be another entity's slug** (its filename without `.md`) — either one that already exists, or one you are creating in this same pass. It is never a glossary term; cross-references to glossary terms work automatically as mentions, or explicitly via a `[[Term Name]]` wikilink in the body text.
- **Renaming.** If an entity that already has other files pointing at it needs a new name, prefer LoreFountain's own "Rename Entity" command (or ask the writer to run it) rather than hand-editing every reference yourself — it also keeps the old name working as an alias so nothing already written about it breaks.
