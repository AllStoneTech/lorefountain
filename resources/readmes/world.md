# {{WORLD_FOLDER}}/

The story world — one Markdown file per entity: a character, location, faction, object, or concept. Each file is plain YAML frontmatter plus a short prose description; nothing here is proprietary, and it's readable in any text editor.

In VS Code with the LoreFountain extension, these open as a form (a "Story Card") instead of raw text, and any mention of an entity's name elsewhere — in another entity's description or in a script — is linked automatically.

If you're an AI working in this project, see `agents/world-builder.md` at the project root for the exact file format.

**`OVERVIEW.md`**, right here in this folder, is different from everything else: a single "what is this story actually about" reference, meant to be the first thing a new collaborator reads and kept current as the story evolves. It opens as its own structured card — short fields for title, pitch, tone, and genre, plus one large freeform section (premise, setting, key characters, synopsis, themes, or whatever a project actually needs).

Two subfolders here are different from the rest:
- **`glossary/`** — invented terminology, not full entities.
- **`notes/`** — free-form scratch space for ideas that aren't ready to be entities yet.
