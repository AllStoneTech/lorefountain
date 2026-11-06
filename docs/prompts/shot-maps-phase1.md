Implement "shot maps" in LoreFountain (phase 1 of 3). Work on a new branch `feature/shot-maps` cut from `main`.

This feature is deliberately modeled on the cue system: `[tag]` syntax, derived sidecar, hand-authored manifest. Follow the existing patterns exactly.

**Ground rule: defer to the Fountain spec.** Fountain and screenwriting industry conventions are outside our control. LoreFountain may *extend* Fountain (prefix lines such as `SHOT:`, `SFX:`, `PAUSE:`, and `[tag]`s after those prefixes), but it never changes how standard Fountain is parsed. If a script doesn't follow the Fountain spec, LoreFountain parses it as Fountain would and warns. It doesn't add heuristics that reinterpret it. Existing demo and ORUN scripts predate this feature and are not a format reference. They will be brought up to standard after this phase.

## Step 0: Read, then report contradictions before coding

Read: CONTRIBUTING.md, docs/DECISIONS.md, src/shots/parseShots.ts, src/cues/parseCues.ts, src/cues/sidecar.ts, src/assets/audioManifest.ts, src/assets/manifestFile.ts, src/index/build.ts, src/cli/validate.ts, src/export/transcript.ts, src/fountain/parse.ts, resources/fountain.tmLanguage.json, resources/fountain-cues.code-snippets, and pro/src/shotList.ts.

Then, before writing any code, tell me anything in the codebase that contradicts or complicates this spec, and wait for my answer. In particular, check:
- whether LoreFountain already matches scene headings to location entities, and how;
- the entity/alias index API you'll resolve names through, and the format of entity ids;
- whether the validator (CLI and extension diagnostics) has an info severity level, which this spec relies on;
- how transcript.ts and the TextMate grammar treat SHOT:/POSE:/SFX: lines, since PAUSE: and shot tags must be treated the same way;
- how fountain-js exposes dual dialogue (`^`), parentheticals, and multiple extensions on a character cue line.

If nothing contradicts the spec, say so and proceed.

## Why

A shot's only identity today is its position ("Scene 2, Shot 3"). Inserting a shot renumbers everything after it, so position can't key an asset manifest. Cues already solved this with optional `[tag]`s and exact matching ("so a rename never silently maps to the wrong asset"). Shots get the same treatment, so a video pipeline can map every SHOT: to the still or clip that fills it, and read each shot's narration, pauses, entities, setting and cues without parsing Fountain itself.

## Decisions already made

- Everything in this phase is **free**: shot tags, PAUSE:, the shot sidecar, shots.json, and the validator codes. This follows the cue precedent (cue sidecar free, Cue-Sheet Export Pro). Export Shot List stays Pro.
- Version **1.1.0** (new, backward-compatible feature).
- No placeholders and no guessing anywhere: a name, tag or location either matches exactly or stays unresolved.

## 1. Script syntax

### Shot tags
- A `SHOT:` line may carry an optional `[tag]` immediately after the prefix: `SHOT: [archive-ident] WIDE, abstract — ...`.
- Use exactly the cue tag pattern `[a-z0-9]+(?:-[a-z0-9]+)*`. Move the tag pattern out of parseCues.ts into a shared module. Export the tag-body pattern and build both parsers' line regexes from it, so they can't drift.
- Tags are optional; an untagged shot is valid. A tag-only shot (`SHOT: [archive-ident]` with no description) is valid; its `description` is `""`.
- Scope is project-wide (the same tag in several scripts means the same asset). Repeats within one script are allowed. Matching is exact on the tag; never fall back to scene/shot position.
- `description` no longer includes the tag.
- POSE:/LIGHT:/DURATION: are unchanged and take no tags.

### PAUSE: (new prefix)
- A `PAUSE:` line is a scene-level pause: a silence that belongs to the scene, not to a speaker. It is a production direction like SHOT:/SFX:, visually separate from dialogue.
- The text after the prefix is optional and parsed leniently, exactly like `DURATION:`, into `durationText` / `durationSeconds` (`PAUSE: 2s`, `PAUSE: long`). A bare `PAUSE:` means an unspecified length. Never guess a number.
- `PAUSE:` takes no `[tag]`.
- A pause *parenthetical* inside a dialogue block is a speaker pause (dialogue coaching) and is a different thing. Recognize exactly these, case-insensitive, after trimming: `(beat)`, `(a beat)`, `(long beat)`, `(pause)`, `(a pause)`, `(long pause)`, `(silence)`. All other parentheticals are dropped from the sidecar.
- A standalone action line such as `Beat.` is ordinary action, not a pause. No magic words in action lines (see validator code `bare-pause-line`).

### Fountain misreading
Keep the existing workaround for Fountain misreading capitalized SHOT: lines as character/dialogue tokens. Make sure it works with tags, and extend it to `PAUSE:` lines, which are all-caps and can be misread the same way when dialogue follows directly.

### Editor support
Highlight shot tags and `PAUSE:` in the TextMate grammar the same way cue tags and the existing prefix lines are highlighted. Add a `PAUSE:` snippet if there are snippets for the other prefix lines. Handle `PAUSE:` in transcript.ts the same way it handles the other production prefix lines.

## 2. Shot sidecar: `<script>.shots.json`

New `src/shots/sidecar.ts`, mirroring `src/cues/sidecar.ts`. It is written next to each script that has at least one explicit `SHOT:` line (an implicit shot 0 alone doesn't count), regenerated on every save and reindex, removed when a script has no shots, and never hand-edited. It has the same `schema_version` / `script` / `generated_by` header. Wire it into `index/build.ts` beside the cue sidecar.

The sidecar JSON uses the short field names below. The `Shot` interface in parseShots.ts keeps its existing field names (`sceneNumber`, `shotNumber`, `sceneHeadingText`, ...). Extend it additively with optional fields only; don't rename or change the meaning of existing fields (except that `description` no longer includes the tag). `pro/src/shotList.ts` consumes `extractShots`, so it must keep compiling and its tests must keep passing unchanged. Don't edit anything under `pro/`; if pro would need a change, stop and tell me.

### Per-shot fields
- `scene`, `shot`: existing numbering; shot resets per scene.
- `tag?`
- `sceneHeading`: the raw heading text.
- Heading breakdown (standard Fountain heading parts):
  - `intExt?`: `"INT"`, `"EXT"`, or `"INT/EXT"` (also accept `I/E`), from the heading prefix. Absent for a forced heading (`.HEADING`) with no prefix.
  - Segments are separated by a hyphen, en dash or em dash with surrounding whitespace (` - `, ` – `, ` — `). Real scripts use all three.
  - `timeOfDay?`: the final segment, kept raw, if it is a recognized time-of-day word: DAY, NIGHT, MORNING, AFTERNOON, EVENING, DAWN, DUSK, CONTINUOUS, LATER, MOMENTS LATER, SAME. An unrecognized final segment (e.g. `SPUNK, 1925`) is part of the setting, not a time of day.
  - `setting: string[]`: the remaining segments, raw, **in heading order**. Writers order them both ways (`LUCIEN'S BASEMENT — WEST ORANGE, NJ` runs specific to general), so make no ordering claim. Strip any scene number (`#12#`).
  - `locations: string[]`: entity ids resolved from `setting`, in the same order. A segment resolves only if it matches exactly one entity through the existing entity/alias index. If it matches none, it is silently left out (many segments are labels like `READING`, not places). If it matches more than one, it is left out and reported (see `ambiguous-location`). Never guess.
- `description`, `pose?`, `light?`, `durationText?`, `durationSeconds?`: existing fields. `description` is absent on shot 0.
- `lines: { start, end }`: 0-based. From the SHOT: line to the line before the next SHOT:, the next scene heading, or the end of the file.
- `spoken`: everything heard in the shot, in script order. Each entry is one of:
  - `{ speaker, speakerEntity?, extensions, text, simultaneous? }`: a dialogue line.
    - `speaker` is the character cue name without its extensions or `^`.
    - `speakerEntity` is the entity id resolved from `speaker` through the alias index, if it resolves to exactly one entity.
    - `extensions: string[]` holds every parenthesized extension on the **character cue line**, in order (`LUCIEN (V.O.) (FILTERED)` gives `["V.O.", "FILTERED"]`), with `CONT'D` / `CONT’D` dropped because it's a continuation marker, not an extension. An empty array if there are none. Extension-like words inside a parenthetical line (`(V.O., reading)`) are not extensions; that's non-standard placement, and the parenthetical is dropped like any other.
    - `text` has parentheticals removed.
    - `simultaneous: true` marks Fountain dual dialogue (`^`): this entry overlaps the entry just before it.
  - `{ pause: "speaker", speaker, speakerEntity? }`: one of the pause parentheticals listed above, belonging to the character whose dialogue block contains it.
  - `{ pause: "scene", durationText?, durationSeconds? }`: a `PAUSE:` line.
- `entities: string[]`: deduplicated ids of every entity mentioned in the shot's description, pose, light, action lines and speaker names, resolved through the existing entity/alias index. Exclude dialogue text, parentheticals and cue descriptions. Don't automatically add the `locations` ids; a location appears in `entities` only if the shot's text mentions it.
- `cues: number[]`: line numbers of SFX:/MUSIC:/AMB: cues whose line falls inside the shot's line range (pointers into `.cues.json`). This means the cue *starts* within this shot, not that it is audible during it. Document that.

### Implicit shot 0
Content in a scene before its first SHOT: becomes an implicit `shot: 0`, so no narration is ever lost. Content means anything other than blank lines: action, dialogue, cues, PAUSE:. Emit shot 0 only when the scene has such content. Its range runs from the scene heading line to the line before the first SHOT:. A scene with no SHOT: at all is entirely shot 0. Shot 0 has no `tag` or `description`. It is produced by the sidecar builder only; `extractShots` does not return it.

Non-title-page content before the first scene heading becomes `scene: 0, shot: 0`, with no `sceneHeading` and empty `setting` and `locations`.

## 3. Shot manifest: `assets/manifests/shots.json`

New `src/assets/shotManifest.ts`, mirroring audioManifest.ts. It is hand-authored and read-only from LoreFountain's side, read through `readManifestFile`, and a missing file is fine. One project-wide file, not one per episode. Its shape is tag -> entry, with a zod schema:
- `file` (required): path relative to the assets folder.
- `kind` (required): `"still"` | `"clip"`.
- `motion?`: freeform string. Document the recommended values ken-burns-in, ken-burns-out, pan-left, pan-right, drift, parallax and none; it is ignored for clips.
- `source?`, `license?`: as in audio.json.
- `prompt?`: the generation prompt, kept for provenance and regeneration.

LoreFountain records and validates; it never renders, moves or measures anything.

## 4. Validation (validate.js CLI and live in the extension)

- `unmapped-shot-tag`: **warning**. A tagged shot with no shots.json entry. Same posture as unmapped-cue-tag.
- `invalid-shot-manifest`: **error**. Malformed JSON or schema failure, reported like the other five manifests.
- `shot-kind-mismatch`: **warning**. `kind` contradicts the file extension. Stills are png, jpg, jpeg and webp; clips are mp4, mov, webm and m4v. Any other extension, gif included, gets no warning.
- `unused-shot-tag`: **info**. A shots.json entry whose tag no script in the project uses. Shots get cut in editing, so stale entries are likely.
- `ambiguous-location`: **info**. A heading setting segment that matches more than one entity, so it was left unresolved. The message names the candidates and suggests a more specific entity name or alias.
- `orphaned-parenthetical`: **warning**. An action block that starts with a parenthetical line, e.g. `(beat)` after a blank line. Under the Fountain spec a blank line ends the dialogue block, so the parenthetical and the speech after it parse as action. Every Fountain renderer will show them that way, and they won't appear in `spoken`. The message explains the two standard fixes: remove the blank line to keep the speech in one dialogue block, or, if a `SHOT:` or other line interrupts the speech, re-cue the speaker with `(CONT'D)`. Parse the script as Fountain does; don't reinterpret it.
- `bare-pause-line`: **info**. A standalone action line that is exactly one of `Beat.`, `A beat.`, `A long beat.`, `Pause.`, `A pause.`, `Silence.`, `A long silence.`, `A moment.` (case-insensitive). The message suggests `PAUSE:`. The line stays ordinary action.

Never flag untagged shots. Don't check that asset files exist on disk (matches audio.json).

## 5. Docs and agent files

Update the generated project docs, assets/README.md, scripts/README.md and agents/script-writer.md to describe:
- shot tags, and the naming convention: prefix episode-specific tags with the production code (`1x01-basement-wide`), use no prefix for recurring shots (`archive-ident`), and never put scene/shot numbers in a tag;
- `PAUSE:` vs. `(beat)`: scene pause vs. speaker pause;
- the shot sidecar, including that `cues` means "starts within this shot";
- shots.json and the recommended motion values.

Bump their versions through readmeVersions.ts / agentFileVersions.ts so existing projects get the "files updated" prompt.

Add a docs/DECISIONS.md entry recording the design choices above and why, including the rejected alternatives:
- keying by scene/shot position;
- `[Beat.]` brackets, which print literally in standard Fountain exports;
- treating bare `Beat.` action lines as magic words;
- a single `location` field, which can't hold "Hollow House / Basement";
- guessing an ambiguous location;
- dual dialogue without a flag, which a pipeline would play sequentially;
- a heuristic that treats an orphaned `(beat)` after a blank line as continued dialogue, rejected because it reinterprets the Fountain spec (record the ground rule: extend Fountain, never change it);
- reading extensions out of parenthetical lines (non-standard placement).

Add a CHANGELOG entry and bump the version to 1.1.0, but mark the entry **Unreleased**. 1.1.0 ships only after the follow-up upgrade-experience phase (what's-new notice, quick fixes, Fix-all, project summary) lands, so users never get the new warnings without the fixes.

## 6. Tests

Mirror the existing cue/sidecar/manifest tests. Cover:
- **Tags:** tagged, untagged and tag-only shots; a tag on a SHOT: line Fountain misreads as a character cue; tag stripped from description; the shared tag pattern used by both parsers.
- **PAUSE::** with and without duration; a PAUSE: line Fountain would misread as a character cue; scene vs. speaker pauses; the exact parenthetical list, with other parentheticals dropped.
- **Line ranges,** including the last shot ending at end of file.
- **Spoken:** single and multiple cue-line extensions, `CONT'D` dropped, extension words inside a parenthetical not treated as extensions, `speakerEntity` resolved and unresolved, and dual dialogue `simultaneous`. Also a `(beat)` after a blank line: it parses as action, is absent from `spoken`, and raises `orphaned-parenthetical`.
- **Entities:** from description, pose, light, action and speaker, but not from dialogue, parentheticals or cue text; locations not added automatically.
- **Heading breakdown:** INT, EXT and INT/EXT; forced heading; hyphen, en dash and em dash separators; recognized and unrecognized time of day; scene number stripped; single and multi-segment settings kept in heading order; an unmatched segment silently left out; an ambiguous segment left out and reported.
- **Cue line pointers.**
- **Implicit shot 0:** present when there's content, absent when the scene only has blank lines before its first SHOT:, a whole scene with no SHOT:, and content before the first scene heading.
- **Sidecar** written, rewritten and removed.
- **Manifest** missing, valid, malformed and schema-invalid.
- **Each of the seven validator codes.**
- **Pro:** pro/src/shotList.ts tests pass unchanged.

Run lint, the full test suite (free and pro), and the build before you report done. If the pro submodule isn't checked out, stop and tell me rather than skipping its tests.

## Out of scope for this phase

- The shots.json form in the manifest editor, hover previews and thumbnails (phase 2).
- Any rendering or video logic (phase 3 lives in a separate pipeline).
- PAUSE: handling in the Pro exports (BBC radio script, cue sheet, shot list); note it as a follow-up.
- Don't change the five existing manifests, the entity model, or the rename refactor.
- Don't update demo projects or ORUN scripts to the new syntax or to fix new warnings; that happens after this phase. If an existing test depends on demo content that now raises a new warning, tell me rather than editing the demo.
- Don't commit docs/SHOT-MAPS.md or docs/prompts/; they're planning material.

## Git

Commit your work on `feature/shot-maps` in logical commits, as the configured git user, with no AI attribution of any kind. Don't push; I'll review and push myself.

## When done

Give me a short summary: files changed, test results (with counts), and anything you had to decide that this prompt didn't cover.
