# The World View

The World view lists everything that makes up your story's world — one plain
Markdown file per item, organized into categories down the sidebar.

## Categories

- **Characters, Locations, Factions, Objects, Concepts, Arcs** — full
  entities. Each gets a "Story Card" — a structured form (name, relationships,
  tracked fields, canon status, etc.) instead of raw text, though you can
  always edit the underlying Markdown file directly too.
- **Glossary** — invented terminology and setting-specific vocabulary that
  isn't a full entity: just a term and a short definition, no relationships
  or timeline data.
- **Timeline** — in-world events, separate from entities. Each event can
  carry two independent positions: where it's revealed to the audience
  (which episode) and where it falls in the story's own internal
  chronology — the two don't always match.
- **Notes** — a low-stakes scratch space. Free-form Markdown, no schema, not
  validated. Use it for a half-formed idea before it's ready to become a
  real entity, then right-click → **Promote Note to Entity** to carry the
  text across.
- **Story Overview** (if present) — sits above every category. A single
  "what is this story actually about" reference: short fields for title,
  pitch, tone, and genre, plus one large freeform section for premise,
  setting, key characters, synopsis, or themes.

## Populating it

- **Command Palette → "LoreFountain: New Character/Location/Faction/..."**,
  or the **+** button next to a category, creates a new item. Creation only
  ever asks for a name — everything else you fill in at your own pace,
  through the Story Card form or the file directly.
- Any mention of an entity or glossary term's name elsewhere — in another
  entity's description or in a `.fountain` script — is recognized and linked
  automatically; hover a recognized mention to preview its Story Card.
- Right-click an entity for actions like **Rename**, which updates every
  known reference across the workspace, not just the one file.
- Categories you don't use can be hidden from this view via the gear icon
  (**LoreFountain: Open Settings**) — they stay untouched on disk, just out
  of the way.
- Set **Significance** (Main / Supporting / Minor) on a Story Card to group
  that category's sidebar list into sections, so leads don't get lost among
  the rest of the cast. A category with no significance set on anything in
  it stays a flat list, unchanged. Characters and Factions also get a
  **Physical Description** field — freeform text for appearance/visual
  identity, useful as raw material for an external AI image generator
  (LoreFountain itself never generates images).

## Saving

- **Story Cards and Story Overview** are just a form drawn over a plain
  Markdown file — the usual dirty dot, undo/redo, and save behavior apply.
  Save with **Ctrl+S** (or leave VS Code's autosave on) exactly as you would
  for any other file.
- **Settings** (the gear icon) is different: it isn't backed by a document,
  so it has its own **Save** button inside the panel that writes to disk
  immediately when clicked. There's no dirty dot, and Ctrl+S does nothing
  there — use the panel's own Save button.

If you're using an AI coding tool in this project, see `agents/world-builder.md`
at the project root for the exact file format it should follow.
