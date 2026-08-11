# The Scripts View

The Scripts view lists your `.fountain` scripts — 100% standard Fountain,
fully portable to any other Fountain tool (Highland, Fade In, Final Draft
import, etc.). Nothing LoreFountain-specific is required to make linking to
the world work: any entity or glossary term's name appearing anywhere in a
script (a character cue, an action line, dialogue) is recognized and linked
automatically, the same as in the World view.

## Layout

Each script lives in its own folder, one level under an optional season
folder — for example `scripts/Season 01/1x03-the-reveal/1x03-the-reveal.fountain`.
Anything else about that episode (audio, images, notes) belongs alongside it
in that same folder; LoreFountain doesn't require any particular set of
files there beyond the script itself.

## Populating it

- Use the **"New Script"** command (Command Palette, or the **+** button on
  this view's title bar) to create one. It assigns the episode's position
  (**Order**) and a permanent **Production Code** for you, so those never
  collide with an existing episode — creating scripts this way instead of
  by hand keeps that numbering consistent.
- Drag an episode within this view to reorder it within its season; that
  updates its Order without touching its Production Code (which is
  permanent once assigned).
- A sound-cue convention — lines starting `SFX:`, `MUSIC:`, or `AMB:` — is
  parsed automatically into a `<script-name>.cues.json` sidecar next to each
  script. That file is derived data, regenerated on every save; never hand-edit
  it.
- Hover any recognized character/location/glossary mention in a script to
  preview its Story Card. The editor toolbar's **Export Transcript** button
  exports a script's dialogue/action text on its own.
  
## Fountain Tips;

### What LoreFountain adds by default

- **Word wrap is on** for every `.fountain` file, so long action and
  dialogue lines wrap in the editor instead of running off-screen — no
  per-file setup needed.
- **Syntax highlighting** for every element above (scene headings, character
  cues, transitions, title-page keys, `SFX:`/`MUSIC:`/`AMB:` cue prefixes,
  emphasis) via the bundled Fountain grammar, colored per your current
  color theme.
- **Snippets** — type the prefix and press Tab/Enter:
  - `sfx` → `SFX: description`
  - `amb` → `AMB: description`
  - `mus` → `MUSIC: BED|STING|BRIDGE|SOURCE BED|IN|OUT description`
- **Auto-closing/surrounding pairs** for `[[` `]]`, `(` `)`, and `"` — select
  text and type `[[` to wrap it, same for parentheticals and quotes.
- **`[[Entity Name]]` explicit links** — use this when a mention wouldn't
  otherwise be recognized automatically (a nickname, a pronoun-only
  reference), or to force a link from inside dialogue.
- **Hover previews** — hovering a recognized character, location, or
  glossary mention shows its Story Card. Toggle with the
  `lorefountain.hover.enabled` setting.
- **Autocomplete** — typing `[[` offers every known entity/glossary name.
  Toggle with the `lorefountain.completion.enabled` setting.

### Customizing it

- Turn off word wrap, hover, or autocomplete per the settings above if you'd
  rather rely on a different Fountain extension (like Better Fountain) for
  any of them — LoreFountain is designed to coexist, not to be the only
  Fountain tool in your setup.
- The `.fountain`/`.spmd` file associations, grammar, and snippets all come
  from this extension; disabling LoreFountain (or a conflicting Fountain
  extension taking priority) falls back to whatever else is installed.

If you're using an AI coding tool in this project, see `agents/script-writer.md`
at the project root for the exact conventions it should follow.

## Tutorial: Fountain syntax and LoreFountain's defaults

Fountain is plain text with a handful of formatting conventions inferred
from context — no markup tags, nothing to click through a toolbar to apply.
Everything below is 100% standard Fountain; LoreFountain never changes the
format, only adds linking, hover, and autocomplete on top of it.

### The building blocks

- **Title page** — optional, at the very top of the file, one `Key: value`
  pair per line, ended by a blank line:
  `Title:`, `Credit:`, `Author`/`Authors:`, `Source:`, `Draft date:`,
  `Contact:`, `Copyright:`, `Notes:`, `Revision:`. Keys are case-insensitive.
- **Scene headings** — a line starting `INT.`, `EXT.`, `EST.`, `INT./EXT.`,
  or `I/E.` (case-insensitive), e.g. `INT. KITCHEN - NIGHT`. Force any other
  line to be treated as a scene heading by starting it with a single `.`
  (e.g. `.LATER`) — useful for a heading that doesn't fit the INT/EXT pattern.
- **Action** — any plain paragraph that isn't one of the other elements
  below. This is the default; most of a script is action lines.
- **Character cues** — a line in ALL CAPS naming who speaks next, e.g.
  `SANGO`. Add `(V.O.)`, `(O.S.)`, `(CONT'D)`, etc. in parens after the name
  for an extension, or a trailing `^` for simultaneous/dual dialogue with
  the character above.
- **Dialogue** — the plain-text line(s) immediately following a character
  cue.
- **Parentheticals** — a line wrapped in `(...)` between a character cue
  and their dialogue (or mid-dialogue), e.g. `(quietly)`, for a brief
  performance note.
- **Transitions** — either an ALL-CAPS line ending in `TO:` (e.g.
  `CUT TO:`) or a line starting `>` without a matching `<` (e.g. `> Fade out.`).
- **Centered text** — a line wrapped `>like this<`, for a title card or
  similar.
- **Lyrics** — a line starting `~`.
- **Section headings** — `#`, `##`, up to `######`, purely structural/for
  navigation (an outline), never printed in a finished script.
- **Synopsis** — a line starting `=` (not `==`), a short note about the
  scene/section above it, also never printed.
- **Page break** — a line of three or more `=` characters on its own
  (`===`).
- **Boneyard (comments)** — text wrapped `/* ... */`, excluded from output
  entirely.
- **Notes** — text wrapped `[[ ... ]]`, Fountain's own inline-note
  convention. LoreFountain reuses this exact bracket syntax for explicit
  entity/glossary links (see below) — the two roles overlap by design, since
  `[[Some Character]]` reads naturally as both "a note to self" and "a link."
- **Emphasis** — `*italic*`, `**bold**`, `***bold italic***`, `_underline_`.

### Further reading

This covers the elements you'll use day to day. For the complete spec —
indentation rules, forced elements (`@`, `!`, `~`), scene numbering, and
every edge case — see the official
[Fountain Syntax Guide](https://fountain.io/syntax/) at fountain.io.

