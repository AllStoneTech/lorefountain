<!-- lorefountain-docs-version: 4 -->
# {{WORLD_FOLDER}}/

The story world — one Markdown file per entity: a character, location, faction, object, concept, or arc. Each file is plain YAML frontmatter plus a short prose description; nothing here is proprietary, and it's readable in any text editor.

In VS Code with the LoreFountain extension, these open as a form (a "Story Card") instead of raw text, and any mention of an entity's name elsewhere — in another entity's description or in a script — is linked automatically.

If you're an AI working in this project, see `agents/world-builder.md` at the project root for the exact file format.

**`overview.lf.md`**, right here in this folder, is different from everything else: a single "what is this story actually about" reference, meant to be the first thing a new collaborator reads and kept current as the story evolves. It opens as its own structured card — short fields for title, pitch, tone, and genre, plus one large freeform section (premise, setting, key characters, synopsis, themes, or whatever a project actually needs).

**`style.lf.md`** is an optional second singleton (the `.lf.md` ending marks a LoreFountain project document, which is never an entity, so a character named Style would be a separate `style.md`): the project's style bible, one file for how it should look and feel in every medium it appears in (comic, video, illustrated book): art style, palette, reference images, things to avoid, lettering, format notes, as a short frontmatter block plus free prose. It doesn't exist until you create it: Command Palette, "LoreFountain: Open Style Bible (Create If Missing)". It opens as a guided form ("Open as text" shows the raw file), and a "Style Bible" row appears at the top of the World view once it exists. Each character's own look still belongs in that character's file.

Two subfolders here are different from the rest:
- **`glossary/`** — invented terminology, not full entities.
- **`notes/`** — free-form scratch space for ideas that aren't ready to be entities yet.
