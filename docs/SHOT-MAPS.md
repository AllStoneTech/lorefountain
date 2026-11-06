# Shot Maps — Spec

Status: proposed, Nov 4, 2026 · Author: Louis Alston

## Summary

A shot map does for visuals what `audio.json` does for sound. It links each `SHOT:` in a script to the still or clip that fills it, so a video pipeline can assemble an episode straight from the script, and the validator can report shots that have no asset yet.

The change has three parts, each modeled on an existing cue feature:

1. An optional `[tag]` on `SHOT:` lines gives a shot a stable id, the same syntax cues already use.
2. A derived `<script>.shots.json` sidecar, regenerated on every save like `.cues.json`, holds each shot with its line range, narration and the entities it mentions.
3. A hand-authored `assets/manifests/shots.json` maps each shot tag to its file, the same way `audio.json` maps a cue tag.

Existing projects keep working unchanged. Tags are optional, and an untagged shot is never an error.

## The problem

Today a shot's only identity is its position, "Scene 2, Shot 3" (`parseShots.ts` resets the counter at each scene heading). Position is fine for a shot list, but it can't key a manifest. Inserting one shot renumbers every shot after it in that scene, so a map keyed by position would silently point at the wrong images.

`parseCues.ts` already solved the same problem for sound. A cue gets a stable `[tag]`, and its doc comment rules out fuzzy or positional matching "so a rename never silently maps to the wrong asset." Shots should follow the same rule.

Two more gaps matter for a video pipeline:

- **Which words belong to which shot.** Shot timing has to come from the recording, so a pipeline needs each shot's narration and dialogue text to align against the audio. ORUN's `DURATION:` values run far below the real reads; 1x01 is about 2,900 words across 31 shots.
- **Which characters and places are in a shot.** That's what lets a pipeline pick the right reference sheets. LoreFountain already auto-links entity names in `POSE:` text, but it doesn't export those links per shot.

## Design 1: shot tags in scripts

A `SHOT:` line can carry an optional `[tag]` right after the prefix, with exactly the syntax and rules cues use:

```text
SHOT: [archive-ident] WIDE, abstract — the Archive Presence (recurring ident, no character)
SHOT: [1x01-basement-wide] WIDE, establishing — LUCIEN's basement office
SHOT: MEDIUM, on LUCIEN
```

**Rules**

- **Pattern:** the existing `CUE_TAG` regex, lowercase letters, digits and single hyphens (`[a-z0-9]+(?:-[a-z0-9]+)*`). Move it to a shared module so the two can't drift apart.
- **Optional:** an untagged shot is valid. It still appears in the sidecar with its position, but it can't be mapped to an asset.
- **Project-wide scope:** a tag means the same asset in every script. Recurring shots (the Archive ident, the Odù glyph bumper) reuse one tag across episodes and resolve to one file, which is the same reuse philosophy as the audio manifest.
- **Repeats within a script are allowed.** Cutting back to the same image is a normal editing choice.
- **No positional fallback.** Matching is exact on the tag, never on scene and shot number.
- **`POSE:`, `LIGHT:` and `DURATION:` are unchanged.** They take no tags.

**Naming convention (recommended, not enforced):** prefix episode-specific shots with the production code (`1x01-basement-wide`). Leave the prefix off recurring shots (`archive-ident`). Never put scene or shot numbers in a tag, since numbers are exactly what changes when a shot is inserted.

## Design 2: the shot sidecar

Every script with at least one `SHOT:` gets a `<script>.shots.json` beside it, generated the same way as `.cues.json`. It's regenerated on every save and every reindex, never hand-edited, safe to delete, and removed when a script has no shots. It belongs in `src/shots/sidecar.ts`, mirroring `src/cues/sidecar.ts`, and is called from the same place in `index/build.ts`.

The sidecar is the contract between LoreFountain and any downstream tool. A pipeline reads it and never has to parse Fountain itself.

**Per-shot fields**

| Field | Type | Meaning |
| --- | --- | --- |
| `scene` | number | Scene number, as today |
| `shot` | number | Shot number within the scene, as today |
| `tag` | string? | The stable `[tag]`, when one is written |
| `sceneHeading` | string | The scene heading text |
| `description` | string | `SHOT:` text with the tag removed |
| `pose` / `light` | string? | As today |
| `durationText` / `durationSeconds` | string? / number? | As today: the estimate as written, and parsed seconds |
| `lines` | `{ start, end }` | 0-based line range, from the `SHOT:` line to the line before the next shot or scene heading |
| `spoken` | `[{ speaker, extension?, text }]` | Dialogue inside the shot, in order. `extension` keeps `V.O.`, `FILTERED` and similar. Parentheticals like `(beat)` are dropped from `text` but kept as `{ pause: true }` markers, since a pause matters for timing. |
| `entities` | `string[]` | Ids of every entity mentioned in the shot's description, pose, light, action and speaker names (not dialogue), deduplicated |
| `location` | string? | Entity id matched from the scene heading, when one matches |
| `cues` | `number[]` | Line numbers of the `SFX:`, `MUSIC:` and `AMB:` cues inside the shot, pointing into `.cues.json` |

**Why `spoken` and `entities` belong here rather than in a pipeline:** both depend on LoreFountain's own knowledge. Fountain tokenizing, including the character-cue quirk `parseShots.ts` already works around, and the entity index that resolves names and aliases to ids both live in LoreFountain. Re-deriving them outside would duplicate that logic and drift.

**Text before the first `SHOT:` in a scene** isn't lost. It's reported as an implicit shot 0 for that scene (`shot: 0`, no description), so no line of narration goes missing from alignment.

## Design 3: the shot manifest

`assets/manifests/shots.json` is the sixth manifest. It's hand-authored, read-only from LoreFountain's side, read tolerantly through the existing `readManifestFile`, and fine to leave missing. It lives in `src/assets/shotManifest.ts`, next to `audioManifest.ts`.

```json
{
  "archive-ident": {
    "file": "shots/archive-ident.mp4",
    "kind": "clip",
    "source": "Veo 3.1 Fast, Google Flow"
  },
  "1x01-basement-wide": {
    "file": "shots/1x01/basement-wide.png",
    "kind": "still",
    "motion": "ken-burns-in",
    "source": "Nano Banana 2",
    "prompt": "Illustrated, not photorealistic. A finished basement office at night..."
  }
}
```

**Entry fields**

| Field | Required | Meaning |
| --- | --- | --- |
| `file` | yes | Path relative to the `assets` folder |
| `kind` | yes | `still` or `clip`. This is what tells a pipeline whether to apply motion or cut a clip. |
| `motion` | no | How to move a still, as freeform text. Recommended values: `ken-burns-in`, `ken-burns-out`, `pan-left`, `pan-right`, `drift`, `parallax`, `none`. Ignored for clips. |
| `source` | no | What made it: model, tool or vendor. Same as `audio.json`. |
| `license` | no | Same as `audio.json`. |
| `prompt` | no | The prompt that generated the asset, kept so it can be regenerated or matched later |

**Where LoreFountain stops.** LoreFountain records which file fills a shot and how it should move, and checks the manifest's shape. It never renders, moves or measures anything. `motion` is freeform for the same reason `SHOT:` is: camera-move vocabulary doesn't reduce to a clean enum, and the interpretation belongs to whatever pipeline reads it.

**Why one project-wide file, not one per episode:** recurring shots need one entry that every episode can point at, and `audio.json` already set that pattern. Episode-specific shots stay organized through the tag prefix and the file path (`shots/1x01/...`).

## Validation, docs and agent files

**New checks** (in both `node agents/validate.js` and live in the extension)

| Code | Severity | Fires when |
| --- | --- | --- |
| `unmapped-shot-tag` | Warning | A tagged shot has no entry in `shots.json`. Same posture as `unmapped-cue-tag`: a shot can be written before its image exists. |
| `invalid-shot-manifest` | Error | `shots.json` is malformed JSON or fails the schema, reported the same way the other five manifests are |
| `shot-kind-mismatch` | Warning | `kind` contradicts the file extension, e.g. `still` pointing at `.mp4` |

Untagged shots are never flagged, and the validator doesn't check whether asset files exist on disk, matching `audio.json` today.

**Files to update**

- `src/shots/parseShots.ts`: parse the tag, and collect spoken lines, entities, location and cue lines per shot.
- `src/shots/sidecar.ts` (new), wired into `src/index/build.ts` beside the cue sidecar.
- `src/assets/shotManifest.ts` (new), plus the cross-check in `build.ts` and `src/cli/validate.ts`.
- The shared tag pattern, moved out of `src/cues/parseCues.ts`.
- The manifest editor (`manifestForm.ts`, `manifestHtml.ts`, `manifestEditorProvider.ts`) gets a `shots.json` form with the same add and remove rows as `audio.json`. This can ship in phase 2.
- Generated project docs: `assets/README.md`, `scripts/README.md` and `agents/script-writer.md` describe shot tags and the new manifest. Bump their docs versions through the existing `readmeVersions.ts` and `agentFileVersions.ts`, so projects see the "files updated" prompt.
- Unit tests mirroring the existing cue, sidecar and manifest tests, including the case of a tagged `SHOT:` line that Fountain misreads as a character cue.

**Pro boundary.** The cue sidecar is free and Cue-Sheet Export is Pro. The same split applies here: shot tags, the sidecar, the manifest and the validator are free, and Export Shot List stays Pro. Export Shot List can gain a column for the mapped file at no extra cost.

## Worked example: 1x01

The opening of ORUN's 1x01 as it would read once tagged. The only change to the script is the two tags. This is an illustration; ORUN's files stay untouched until a decision is made to tag them.

```text
SHOT: [archive-ident] WIDE, abstract — the Archive Presence (recurring ident, no character)
POSE: A slow drift through layered Odù binary glyphs, suspended in dark space, pulsing faintly in time with the score
LIGHT: Deep black background, glyphs lit from within in cool blue-white, no other source
DURATION: ~6s

               THE ARCHIVE
     (V.O., FILTERED — not Lucien)
You found us. We have been here. Ten thousand years of signal, waiting for the receiver to be ready.

     (beat)
You are ready.

...

INT. LUCIEN'S BASEMENT — WEST ORANGE, NJ — NIGHT

SHOT: [1x01-basement-wide] WIDE, establishing — LUCIEN's basement office
POSE: LUCIEN rises from his desk chair, a laptop & 3 monitors behind him, and heads for a woven mat
DURATION: 5s

SFX: A desk chair creaks as someone gets up from it.

               LUCIEN
I'm not supposed to be doing this.
```

The sidecar entry generated for the second shot (abridged):

```json
{
  "scene": 2,
  "shot": 1,
  "tag": "1x01-basement-wide",
  "sceneHeading": "INT. LUCIEN'S BASEMENT — WEST ORANGE, NJ — NIGHT",
  "description": "WIDE, establishing — LUCIEN's basement office",
  "pose": "LUCIEN rises from his desk chair, a laptop & 3 monitors behind him, and heads for a woven mat",
  "durationText": "5s",
  "durationSeconds": 5,
  "lines": { "start": 40, "end": 52 },
  "spoken": [
    { "speaker": "LUCIEN", "text": "I'm not supposed to be doing this." },
    { "pause": true },
    { "speaker": "LUCIEN", "text": "I'm a tech guy from Newark. I'm a Capricorn..." }
  ],
  "entities": ["lucien-david-fisher-iii"],
  "location": "west-orange-nj",
  "cues": [45]
}
```

A video pipeline now has everything it needs for this shot without parsing Fountain. The narration to align against the recording is in `spoken`, the reference sheets to pull come from `entities` and `location`, the file comes from looking up the tag in `shots.json`, and the sound comes from following `cues` into `.cues.json` and `audio.json`.

## Compatibility

- Existing scripts parse exactly as before. A `SHOT:` line without a tag behaves as it does today, so every existing project stays valid with no changes.
- A new sidecar file appears next to each script that has shots. It's derived data, like `.cues.json`, so projects that commit cue sidecars should treat it the same way.
- No change to the five existing manifests, the entity model, or the rename refactor. Tags aren't entity ids, so renaming an entity never touches them.

## Phases

1. **Core:** shot tags, the sidecar, `shots.json` reading, the three validator checks, doc and agent-file updates, and tests. This is everything a pipeline needs.
2. **Editor:** the `shots.json` form in the manifest editor, and a hover on a tagged `SHOT:` line showing the mapped file with a thumbnail for stills.
3. **Pipeline (outside LoreFountain):** a video pipeline (vidkit) reads `.shots.json` and `shots.json` in place of its own shot list.

## Open decisions

- [ ] **Free or Pro.** Proposed: tags, the sidecar and the manifest are free, following the cue precedent.
- [ ] **Implicit shot 0.** Text before a scene's first `SHOT:` counts as shot 0 (proposed), or attaches to the previous shot?
- [ ] **Pause markers.** Keep `(beat)` as `{ pause: true }` in `spoken` (proposed), or drop parentheticals entirely?
- [ ] **Unused manifest entries.** Warn when a `shots.json` key isn't used by any script? `audio.json` doesn't, so it's left out.
- [ ] **Version.** Ship as 1.1.0 (a new feature, fully backward-compatible)?
