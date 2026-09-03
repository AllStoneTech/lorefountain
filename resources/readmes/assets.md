<!-- lorefountain-docs-version: 1 -->
# {{ASSETS_FOLDER}}/

Production assets — audio, character/location/object rigs — and the manifests that map a stable id to the file that fulfills it, so the same asset is reused every time it recurs across a season instead of being re-picked or regenerated.

## `{{ASSETS_FOLDER}}/manifests/`

Five optional, hand-authored JSON files, each mapping a key to the asset(s) that fulfill it:

- **`audio.json`** — keyed by a cue's `[tag]` (written in a script as `SFX: [tag] description`, `MUSIC: [tag] ...`, or `AMB: [tag] ...`). Each entry is a single `{ file, source?, license? }`.
- **`characters.json`**, **`locations.json`**, **`objects.json`** — keyed by an existing entity's id (the same id `[[Wikilink]]`s resolve to — check the entity's filename, or its Story Card). Each entry splits a persistent **`versions`** baseline (a scar introduced in Season 2 stays in every later version) from a temporary, swappable variant layer scoped under that entity — **`looks`** for characters (wardrobe, non-permanent makeup), **`dressing`** for locations/objects (a temporary condition like "night" or "broken-desk").
- **`voice.json`** — keyed the same way as `characters.json`, mapping to the voice model/reference that speaks a character's lines. `versions` only, no variant layer.

None of these files are required — a cue or entity with no manifest entry just isn't mapped to an asset yet. A tagged cue with no `audio.json` entry is a non-blocking warning; a `characters.json`/`locations.json`/`objects.json`/`voice.json` key that doesn't match any known entity is reported as an error (a broken reference, same severity as a dangling relation) — both by `node agents/validate.js` and live in the extension.

## Editing them

Open any of the five files in VS Code with the LoreFountain extension installed for a form-based editor (add/remove entries, versions, and looks/dressing rows without hand-editing JSON) — or edit the JSON directly in any text editor; nothing about this convention requires VS Code.
