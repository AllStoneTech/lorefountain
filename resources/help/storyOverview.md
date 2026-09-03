# The Story Overview Editor

The Story Overview editor is the default view for `world/OVERVIEW.md` — the
project's single "what is this story actually about" reference. There's
only ever one per project, unlike every other item in the World view.

## What it covers

Four short, genuinely universal, optional fields: **Title**, **Pitch** (a
one- or two-sentence logline), **Tone**, and **Genre**. That's the entire
schema — only these four are ever validated.

## The body

Everything below the four fields is a large, free-form Markdown text area —
nothing there is checked or enforced. The scaffolded default suggests a few
section headers (Premise, Setting, Key Characters, Synopsis, Themes), but
feel free to adjust them if the project genuinely doesn't fit that shape (a
game world might want "Factions" instead of "Key Characters," for
instance). Write it as a reference document for yourself and any AI coding
tool working in the project, not a form to fill in mechanically.

## Saving

Just a form drawn over a plain text document — the usual dirty dot, undo
(Ctrl+Z), and save (Ctrl+S, or leave autosave on) all work exactly as they
would editing the file directly. The underlying file is always plain
Markdown with a small YAML frontmatter block; a power user can hand-edit it
in any text editor at any time.

If you're using an AI coding tool in this project, see
`agents/world-builder.md` at the project root — its "Story Overview format"
section covers the exact same fields.
