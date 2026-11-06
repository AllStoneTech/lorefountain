# The Scripts View

The Scripts view lists your `.fountain` scripts — 100% standard Fountain,
fully portable to any other Fountain tool (Highland, Fade In, Final Draft
import, etc.). Nothing LoreFountain-specific is required to make linking to
the world work: any entity or glossary term's name appearing anywhere in a
script (a character cue, an action line, dialogue) is recognized and linked
automatically, the same as in the World view.

## Fountain version

LoreFountain follows [Fountain](https://fountain.io/) 1.1, the current version
of the spec. The [Fountain syntax reference](https://fountain.io/syntax/)
covers everything a script can contain: scene headings, action, characters,
dialogue, parentheticals, transitions, centered text, notes and more.
LoreFountain's own conventions, such as `SHOT:`, `PAUSE:` and `SFX:`, are
ordinary action lines to any other Fountain tool, so your scripts stay
portable.

For a tutorial and quick reference covering every Fountain element and every
LoreFountain convention, with examples, run **LoreFountain: Fountain Syntax:
Tutorial and Quick Reference** from the Command Palette, or pick **Fountain
Syntax** from the `...` menu on this view's title bar or on any open
`.fountain` script.

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
  it. `MUSIC:` cues can carry two independent, optional modifiers: a **Role**
  (`BED`, `STING`, `BRIDGE`, `SOURCE BED` — what kind of musical moment it is)
  and a **Timing** (`IN`, `OUT` — a fade). Either, both, or neither may
  appear, e.g. `MUSIC: BED IN - low, patient, unresolved`.
- Any of the three cue types can also carry an optional **`[tag]`** right
  after the prefix — a stable handle into `assets/manifests/audio.json`,
  mapping that exact tag to the file that fulfills it so the same sound
  design choice is reused every time it recurs, e.g.
  `SFX: [kola-nuts-clatter] kola nuts clatter in a bowl`. Untagged is the
  normal state for a cue whose asset isn't sourced yet. Open
  `audio.json` (or any entity-keyed manifest) for a form-based editor (its
  own title bar has a matching `$(question)` help button) instead of
  hand-editing the JSON.
- A second convention for camera/pre-production — `SHOT:`, `POSE:`,
  `LIGHT:`, and `DURATION:` — works the same way: `SHOT:` starts a new shot
  (freeform framing, e.g. `WIDE`, `CLOSE-UP on SANGO`), and the other three
  set fields on whichever shot is currently open. Shots number sequentially
  within each scene, resetting at every scene heading.
- A `SHOT:` line can carry a **`[tag]`** too, e.g.
  `SHOT: [1x01-basement-wide] WIDE, establishing` — a stable handle into
  `assets/manifests/shots.json` naming the still or clip that fills the
  shot. Prefix episode-specific tags with the production code, leave the
  prefix off recurring shots (`archive-ident`), and never put scene or
  shot numbers in a tag. Every script with shots gets a
  `<script-name>.shots.json` sidecar (line ranges, what's heard, entities,
  cue pointers per shot) for downstream tools; like the cue sidecar, it's
  regenerated on every save.
- Write a scene pause as `PAUSE:` (optionally `PAUSE: 2s`); a character's
  own pause stays a `(beat)` parenthetical inside their dialogue. Keep a
  speech and its parentheticals together with no blank lines — a blank
  line ends a Fountain dialogue block, so a `(beat)` after one becomes
  action, and the validator warns about it.
- Script warnings and notes show in the **Problems** panel and as
  squiggles on the line. Press **Ctrl+.** (**Cmd+.** on a Mac) on one for a
  quick fix: join a `(beat)` back to the previous speech, re-cue the
  speaker with `(CONT'D)`, or turn a standalone `Beat.` into `PAUSE:`.
  **Fix All Script Formatting Issues** (Command Palette) applies every safe
  fix across the project, after you review each change in a preview.
- Both conventions are free to write in any project. Turning them into a
  working export — a cue sheet, a shot list, or a full BBC-style radio
  script — is LoreFountain Pro; see each export's own help panel (Command
  Palette, or the `...` menu next to its icon in this editor's title bar)
  for what it produces.
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
  - `mus` → `MUSIC: BED|STING|BRIDGE|SOURCE BED|IN|OUT description` (pick a Role
    and/or Timing keyword from the dropdown, or none at all)
  - `sfx-tag` / `amb-tag` / `mus-tag` → the same three cues with a leading
    `[tag]` placeholder already in place
  - `shot` → `SHOT: description`
  - `pose` → `POSE: description`
  - `light` → `LIGHT: description`
  - `dur` → `DURATION: description`
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

## Learning Fountain

The **Fountain Syntax: Tutorial and Quick Reference** help page (see
**Fountain version** above for where to open it) walks through every
element of Fountain 1.1 and every LoreFountain convention, with an example
of each. The official [Fountain Syntax Guide](https://fountain.io/syntax/)
at fountain.io has the complete spec.
