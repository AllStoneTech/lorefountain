# LoreFountain's Fountain Extensions

The single reference for everything LoreFountain adds to [Fountain](https://fountain.io/) 1.1. For a tutorial with examples, see `resources/help/fountainSyntax.md`. For why each choice was made, see `docs/DECISIONS.md` (ADR-0023, ADR-0038, ADR-0040).

## Principle

LoreFountain **extends Fountain and never changes it** (ADR-0040).

- Every extension below is either an ordinary action line, a Fountain note, or an unrecognized title-page key. Any other Fountain tool reads a LoreFountain script as valid Fountain.
- A script that doesn't follow the spec is parsed exactly as Fountain parses it. LoreFountain adds a note in the Problems panel and never guesses what the writer meant.
- Nothing inside a boneyard (`/* ... */`) is read as data.

## Summary

| Extension | Syntax | Built on | Introduced |
|---|---|---|---|
| Shot | `SHOT: <description>` | Action line | 0.x (shot list), tags/sidecar in 1.1.0 |
| Shot details | `POSE:`, `LIGHT:`, `DURATION:` | Action line | 0.x |
| Scene pause | `PAUSE:` or `PAUSE: 2s` | Action line | 1.1.0 |
| Sound cues | `SFX:`, `MUSIC:`, `AMB:` | Action line | 0.x |
| Tag | `[tag]` after the colon of `SHOT:`, `SFX:`, `MUSIC:`, `AMB:` | Text within an action line | cues 1.0.0, shots 1.1.0 |
| Entity link | `[[Name]]` | Fountain note | 0.x |
| Episode keys | `Order:`, `Production Code:` | Title-page key | 0.x (ADR-0023) |

## Convention lines

A convention line is an action line that starts, in capitals and at the start of the line, with a keyword and a colon: `SHOT:`, not `Shot:` or `SHOT :`. Anything else is ordinary action.

- Convention lines belong in the action, never in the middle of a speech. Interrupting a speech splits it: the speech ends, the convention line follows, and the speaker is re-cued with `(CONT'D)`. The quick fix does this automatically.
- An all-caps convention line with text directly under it is read by Fountain as a character cue. LoreFountain still understands it, but other apps would print it as a speaker. Keep a lowercase word in the line, or leave a blank line after it.

### Shots

- `SHOT:` starts a shot. The description is free text; there is no fixed vocabulary.
- `POSE:`, `LIGHT:` and `DURATION:` add details to the current shot, until the next `SHOT:` or scene heading. A detail line with no shot before it in the scene is ignored. If a detail repeats within a shot, the last one wins.
- Shots are numbered within each scene from 1. Material before a scene's first `SHOT:` belongs to an unnumbered shot 0.
- `DURATION:` is stored exactly as written. If it contains a number of seconds (`4s`, `2.5 sec`, `about 3 seconds`), the shot map also records the number.
- Output: the derived `<script>.shots.json` sidecar, rebuilt on every save and never hand-edited.

### Scene pauses

- `PAUSE:` is a pause in the scene that belongs to no character. An optional length is read like a `DURATION:`.
- A character's own pause stays a parenthetical in their speech: `(beat)`, `(a beat)`, `(long beat)`, `(pause)`, `(a pause)`, `(long pause)`, `(silence)`.
- Plain action such as `Beat.` stays action. LoreFountain reports an informational note (`bare-pause-line`) suggesting `PAUSE:`.

### Sound cues

- `SFX:` a sound effect. `MUSIC:` a music cue. `AMB:` an ambience bed.
- A `MUSIC:` cue may begin with an optional **role** (`BED`, `STING`, `BRIDGE`, `SOURCE BED`), then an optional **timing** (`IN`, `OUT`). Any other word starts the description. A hyphen after them is optional.
- Output: the derived `<script>.cues.json` sidecar.

### Tags

- A tag is `[tag]` directly after the colon of `SHOT:`, `SFX:`, `MUSIC:` or `AMB:`. On `MUSIC:` it comes before the role and timing.
- Characters: lowercase letters, digits and single hyphens. It can't start or end with a hyphen. Anything else, such as `[Door Slam]`, is part of the description.
- A tag is a stable handle into a manifest: `assets/manifests/shots.json` for shots and `assets/manifests/audio.json` for sound. Tags are optional.
- Convention: prefix a tag used in one episode with its production code (`1x03-archive-wide`); leave the code off a tag reused across episodes. Never put scene or shot numbers in a tag.
- `POSE:`, `LIGHT:`, `DURATION:` and `PAUSE:` take no tags.

## Entity links

`[[Name]]` is a Fountain note, so it never prints. LoreFountain also reads it as an explicit link to an entity or glossary term, for a mention it wouldn't otherwise recognize (a nickname, for example). Plain-text mentions of known names and aliases are found automatically.

## Title-page keys

| Key | Meaning |
|---|---|
| `Order:` | The episode's position in its season, a whole number from 1. Mutable. Without one, episodes sort by file name. |
| `Production Code:` | A permanent identifier: season number, `x`, then a two- or three-digit episode number (`1x03`, `12x105`). Never changes, even if the episode moves. |

- Both are written by the **New Script** command and are not meant to be typed by hand.
- `Title:` stays the first line, because the parser recognizes a title page only when its first key is a standard one.
- A value that can't be used is ignored with a warning.

## Checks

Reported in the Problems panel, the Output channel and `node agents/validate.js`.

| Check | Level | Meaning |
|---|---|---|
| `orphaned-parenthetical` | Warning | A parenthetical after a blank line, which Fountain reads as action |
| `unmapped-shot-tag` | Warning | A shot tag with no entry in `shots.json` |
| `shot-kind-mismatch` | Warning | A shot's mapped file kind (still or clip) doesn't suit the shot |
| Unmapped cue tag | Warning | A cue tag with no entry in `audio.json` |
| Duplicate `Order` in a season | Warning | Display falls back to file-name order |
| Production Code drift on save | Warning | A script's code changed between saves |
| Duplicate Production Code | Error | An identity collision; the validator exits 1 |
| `bare-pause-line` | Note | Plain action that looks like a scene pause |
| `ambiguous-location` | Note | A scene heading's place matches more than one entity |
| `unused-shot-tag` | Note | A manifest entry no script uses |
| `unforced-transition` | Note | A transition such as `FADE OUT.` that Fountain recognizes only with a leading `>` |

Notes never fail a validator run. The quick fixes and **Fix All Script Formatting Issues** handle the orphaned parenthetical, the bare pause line and the unforced transition.

## Keeping this file current

When a convention is added, changed or removed, update this file, `resources/help/fountainSyntax.md`, the changelog and an ADR together. Before adopting a new Fountain spec version, check its changelog against every convention above (ADR-0040).
