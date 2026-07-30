# world/

The story world — one Markdown file per entity: a character, location, faction, object, concept, or arc. Each file is plain YAML frontmatter plus a short prose description; nothing here is proprietary, and it's readable in any text editor.

In VS Code with the LoreFountain extension, these open as a form (a "Story Card") instead of raw text, and any mention of an entity's name elsewhere — in another entity's description or in a script — is linked automatically.

If you're an AI working in this project, see `agents/world-builder.md` at the project root for the exact file format.

Two subfolders here are different from the rest:
- **`glossary/`** — invented terminology, not full entities.
- **`notes/`** — free-form scratch space for ideas that aren't ready to be entities yet.

A third, `timeline/`, holds in-world events rather than the entities that take part in them.
