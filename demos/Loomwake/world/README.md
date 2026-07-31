# world/

The campaign world — one Markdown file per entity: a character, location, faction, object, concept, or arc. Each file is plain YAML frontmatter plus a short prose description.

In VS Code with the LoreFountain extension, these open as a form (a "Story Card") instead of raw text, and any mention of an entity's name elsewhere is linked automatically.

If you're an AI working in this project, see `agents/world-builder.md` at the project root for the exact file format.

Two subfolders here are different from the rest:
- **`glossary/`** — homebrew terminology, not full entities.
- **`notes/`** — this campaign's live prep pile: real unresolved hooks, not just half-formed scratch ideas.

A third, `timeline/`, holds in-world events rather than the entities that take part in them.

## A note on secrets

A few `character` entities in this project have `relations[]` entries carrying two fields the real LoreFountain schema doesn't formally support yet: `production_code` (the session where this becomes known to the table) and `participants` (which specific player characters already know it, if it isn't table-wide). Treat an entry with a `production_code` later than "now" — or one scoped to `participants` that doesn't include everyone — as something the GM knows and the players don't, at least not all of them. Don't read those aloud at the table before their session arrives.
