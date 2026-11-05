<!-- lorefountain-docs-version: 2 -->
# {{ASSETS_FOLDER}}/

Production assets — audio, shot stills and clips, character/location/object rigs — and the manifests that map a stable id to the file that fulfills it, so the same asset is reused every time it recurs across a season instead of being re-picked or regenerated.

## `{{ASSETS_FOLDER}}/manifests/`

Six optional, hand-authored JSON files, each mapping a key to the asset(s) that fulfill it:

- **`audio.json`** — keyed by a cue's `[tag]` (written in a script as `SFX: [tag] description`, `MUSIC: [tag] ...`, or `AMB: [tag] ...`). Each entry is a single `{ file, source?, license? }`.
- **`shots.json`** — keyed by a shot's `[tag]` (written in a script as `SHOT: [tag] description`), one file for the whole project so a recurring shot is one entry every episode points at. Each entry is `{ file, kind, motion?, source?, license?, prompt? }`: `file` is relative to this folder, `kind` is `still` or `clip`, `motion` says how to move a still (freeform; recommended values `ken-burns-in`, `ken-burns-out`, `pan-left`, `pan-right`, `drift`, `parallax`, `none`; ignored for clips), and `prompt` keeps the generation prompt for provenance and regeneration. LoreFountain records and checks these; it never renders, moves or measures anything.
- **`characters.json`**, **`locations.json`**, **`objects.json`** — keyed by an existing entity's id (the same id `[[Wikilink]]`s resolve to — check the entity's filename, or its Story Card). Each entry splits a persistent **`versions`** baseline (a scar introduced in Season 2 stays in every later version) from a temporary, swappable variant layer scoped under that entity — **`looks`** for characters (wardrobe, non-permanent makeup), **`dressing`** for locations/objects (a temporary condition like "night" or "broken-desk").
- **`voice.json`** — keyed the same way as `characters.json`, mapping to the voice model/reference that speaks a character's lines. `versions` only, no variant layer.

None of these files are required — a cue, shot or entity with no manifest entry just isn't mapped to an asset yet. A tagged cue with no `audio.json` entry, a tagged shot with no `shots.json` entry, and a `shots.json` `kind` that contradicts its file's extension (a `still` pointing at an `.mp4`) are non-blocking warnings; a `shots.json` entry no script uses is only a note; a `characters.json`/`locations.json`/`objects.json`/`voice.json` key that doesn't match any known entity is reported as an error (a broken reference, same severity as a dangling relation) — both by `node agents/validate.js` and live in the extension.

## Editing them

Open `audio.json`, `characters.json`, `locations.json`, `objects.json` or `voice.json` in VS Code with the LoreFountain extension installed for a form-based editor (add/remove entries, versions, and looks/dressing rows without hand-editing JSON) — or edit the JSON directly in any text editor; nothing about this convention requires VS Code. `shots.json` is edited as plain JSON for now.
