# The Asset Manifest Editor

The Asset Manifest editor is the default view for the five files under
`assets/manifests/` — `audio.json`, `characters.json`, `locations.json`,
`objects.json`, and `voice.json`. Each maps a stable key to the actual
licensed/generated file that fulfills it, so a recurring asset — a specific
sound effect, a character's likeness, a location's look — is reused every
time it recurs across a season instead of being re-picked or regenerated.

## Two shapes, one editor

**`audio.json`** is flat: each entry is a cue **tag** — written in a script
as `SFX: [tag] ...`, `MUSIC: [tag] ...`, or `AMB: [tag] ...` — mapped
directly to one `File`, plus optional `Source`/`License`.

**`characters.json`**, **`locations.json`**, **`objects.json`**, and
**`voice.json`** are entity-keyed: each entry's key is picked from a
dropdown of matching entities already in your World view (character,
location, or object) — not free text, so a typo can't silently create an
orphaned entry. Each entry splits two axes:

- **Versions** — the entity's persistent baseline over story-time. If
  Lucien gets a scar in Season 2, that's a new version, not a variant —
  every later reference should resolve to the new version, while earlier
  episodes keep resolving to the old one. Required: every entry needs at
  least one.
- **Looks** (characters) or **Dressing** (locations/objects) — a
  temporary, swappable condition layered on top of whichever version is
  current: wardrobe or non-permanent makeup for a character, a set
  condition like "night" or "broken-desk" for a location/object. Optional,
  and scoped under that one entity — a "night" dressing on one location
  doesn't collide with "night" on another. `voice.json` has no variant
  layer at all — just versions.

Every version/variant row also takes optional **Source** and **License**
fields, for tracking provenance.

## Editing

- **+ Add Entry** adds a new row — a free-text tag field for `audio.json`,
  or an entity picker (already excluding ids used by another row in the
  same file) for the other four.
- **+ Add version** / **+ Add Looks** / **+ Add Dressing** add a sub-row
  under an entry. **✕** removes any row or sub-row.
- A row you're still filling in is never dropped from what you see — it
  only disappears from the saved file if it's still entirely blank (no key,
  or no version/file filled in yet) once you move on.
- Nothing here requires VS Code: every file is plain, hand-editable JSON,
  and a power user can always **Reopen Editor With…** → **Text Editor**.

## Validation

- **A tagged cue with no matching `audio.json` entry** is a non-blocking
  warning — a cue can legitimately exist before its asset is sourced.
- **A `characters.json`/`locations.json`/`objects.json`/`voice.json` key
  with no matching entity** is an error — since the key is supposed to
  already be a real entity's id, a mismatch is always a broken reference
  (a typo, or a rename that wasn't followed through), never a "not sourced
  yet" situation. This is the same severity as a dangling relation target.

Both checks run via `node agents/validate.js` (no VS Code needed) and live
in the extension on every rebuild.

## A note on renaming

Renaming an entity (LoreFountain's "Rename Entity" command) updates
`relations[].target` and `[[Wikilink]]`s, but does **not** touch
`assets/manifests/*.json` — a manifest key is a plain JSON object key, not
something the rename command knows to look for. Update the entry's key
yourself (the dropdown will show the entity under its new name once it's
renamed) after a rename, or run `node agents/validate.js` to catch a
stale key you missed.

If you're using an AI coding tool in this project, see
`agents/script-writer.md` (for `audio.json`/cue tags) and
`agents/world-builder.md` (for the entity-keyed manifests) at the project
root.
