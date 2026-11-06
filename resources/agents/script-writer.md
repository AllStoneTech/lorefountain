<!-- lorefountain-docs-version: 4 -->
# LoreFountain — Script-Writing Reference

Read this before creating or editing any `.fountain` file under `scripts/`.

`scripts/` here means this project's actual scripts folder — check `AGENTS.md`'s "Folder names" section for how to find its real name if this project doesn't use the default.

## Standard Fountain, nothing more

Scripts are 100% standard Fountain — scene headings, character cues, dialogue, parentheticals, transitions. Nothing LoreFountain-specific is required to make linking to the world work, and scripts stay fully portable to any other Fountain tool.

LoreFountain *extends* Fountain with a few plain-English prefix lines (`SFX:`, `MUSIC:`, `AMB:`, `SHOT:`, `POSE:`, `LIGHT:`, `DURATION:`, `PAUSE:`) written as ordinary action lines, but it never changes how standard Fountain is read. Follow the Fountain spec exactly; when a script breaks it, LoreFountain parses it the way Fountain does and warns, rather than guessing what was meant.

### Dialogue blocks and pauses

In Fountain a blank line ends a dialogue block. Keep a character's whole speech, including any parentheticals, together with no blank lines inside it:

```
MARA
I found it.
(beat)
It was down here the whole time.
```

If you put a blank line before `(beat)`, Fountain reads the `(beat)` and everything after it as action, not dialogue. Every Fountain tool will show it that way, and `node agents/validate.js` reports it as `orphaned-parenthetical`. If a `SHOT:` or other line has to interrupt a speech, end the dialogue block there and repeat the character cue with `(CONT'D)` afterwards:

```
MARA
I found it.

SHOT: [1x01-key-insert] INSERT, the Key on the workbench

MARA (CONT'D)
It was down here the whole time.
```

There are two kinds of pause, and they're written differently:

- **A character's own pause** is a parenthetical inside their dialogue: `(beat)`, `(a beat)`, `(long beat)`, `(pause)`, `(a pause)`, `(long pause)` or `(silence)`. It's performance direction for that speaker.
- **A scene pause**, a silence that belongs to the scene rather than to anyone speaking, is a `PAUSE:` line with an optional length: `PAUSE:`, `PAUSE: 2s`, `PAUSE: long`. Don't write a bare `Beat.` action line for this; it stays ordinary action, and the validator notes it as `bare-pause-line`.

### Transitions

Fountain only recognizes a transition on its own when it's uppercase, has a blank line before and after, and ends in `TO:` (`CUT TO:`, `DISSOLVE TO:`). Any other transition, including `FADE IN:`, `FADE OUT.`, `FADE TO BLACK.` and `CUT TO BLACK.`, must start with `>` (`> FADE OUT.`), or other Fountain apps read it as action. The validator notes a missing `>` as `unforced-transition`.

Put extensions such as `V.O.`, `O.S.` or `FILTERED` on the character cue line (`THE ARCHIVE (V.O.) (FILTERED)`), not inside a parenthetical. Only cue-line extensions are recognized as extensions.

## Folder structure: one folder per script

Each script gets its own folder, one level under an optional season folder: `scripts/Season 01/1x03-the-reveal/1x03-the-reveal.fountain`. Everything else about that episode — its cue and shot sidecars, and anything a writer drops in (audio, images, notes) — lives alongside it in that same folder. LoreFountain has no awareness of what those other files are; they're just along for the ride, the same as anything in `imports/`.

A project with no seasons at all can skip that layer: `scripts/1x01-pilot/1x01-pilot.fountain` is just as valid.

**Ask the writer to run "New Script" (Command Palette or the Scripts view's `+` button) instead of creating this structure by hand.** It's a VS-Code-only command — you can't invoke it yourself if you're working through file edits alone — and it does something you can't safely replicate: it counts existing episodes to assign the next `Order` and Production Code automatically, so those values never collide. If you must create a script file directly (no VS Code available at all), follow the folder pattern above and see the title-page fields below — but flag to the writer that you did this by hand so they can double-check the numbers.

## Title-page metadata: `Order` and `Production Code`

A script's standard Fountain title page (the `Key: Value` lines at the very top of the file, ending in a blank line — note it must start with `Title:` or another key Fountain itself recognizes, or none of these fields will be read at all) carries two fields beyond the usual `Title:`:

```
Title: The Reveal
Order: 3
Production Code: 1x03
```

- **`Order`** is this episode's position among its season's siblings — what the Scripts tree view sorts by, and what dragging an episode there rewrites. It's just a number; a writer (or you, if asked) can hand-edit it, but two episodes in the same season claiming the same `Order` is reported as a warning by `node agents/validate.js`.
- **`Production Code`** (`SxEE`, e.g. `1x03`) is meant to be permanent once assigned — real TV production convention: it can stay fixed even after broadcast order or a season assignment changes, specifically so *something* still uniquely identifies the episode no matter what else moves. **Never assign or change this value yourself.** If the writer asks you to renumber or reorganize episodes, leave `Production Code` alone and only touch `Order` (or ask the writer to use "New Script"/the Scripts view for anything new). Two scripts sharing a Production Code is reported as an *error* by the validator, not a warning — it's an identity collision, not just a display ambiguity.

## Linking to the world

Any entity or glossary term's name (or an alias) appearing anywhere in the script — a character cue, an action line, dialogue — is recognized and linked automatically. No special syntax is needed for this.

For a deliberate, explicit link (useful when you want to be unambiguous, or the name is a generic word), wrap it in double brackets: `[[Entity Name]]`.

If a script needs an entity that doesn't exist yet, create the entity file first (see `agents/world-builder.md`), then reference it in the script. Don't invent an entity inline in the script text without also giving it a proper file under `world/` — otherwise it's never indexed, linkable, or reusable elsewhere.

## The cue convention

Audio cues are ordinary action-line prose using a fixed prefix — type the prefix exactly as shown; a typo silently breaks extraction into the cue sidecar.

| Prefix | Meaning | Modifiers |
|---|---|---|
| `SFX:` | Sound effect | — |
| `MUSIC:` | Music cue | Role: `BED`, `STING`, `BRIDGE`, `SOURCE BED` — Timing: `IN`, `OUT` (both independent and optional; either, both, or neither may appear) |
| `AMB:` | Ambience/room-tone bed | — |

Examples: `SFX: metal groaning`, `MUSIC: STING - the reveal`, `MUSIC: BED IN - low, patient, unresolved`.

Every script's cues are parsed automatically into a `<script-name>.cues.json` sidecar file next to it. Never hand-edit that sidecar — it's regenerated from the script on every save (or by `node agents/validate.js` — see below) and any manual edit will be silently overwritten.

This convention is free to use in any project — extraction itself doesn't require a license. **Export Cue Sheet** (LoreFountain Pro), which turns these cues into a working session cue list, does.

### Tagging a cue: linking it to a specific asset

Any `SFX:`, `MUSIC:`, or `AMB:` cue can carry an optional `[tag]` immediately after the prefix — a stable, slug-shaped handle (lowercase letters, digits, and single hyphens only, e.g. `[kola-nuts-clatter]`) into `assets/manifests/audio.json`, which maps that exact tag to the actual licensed/generated file that fulfills it:

```
SFX: [kola-nuts-clatter] kola nuts clatter in a bowl as ORISHA drops one
```

Tag a cue when the writer wants the *same* sound design choice reused every time it recurs across the season, rather than a fresh pick or regeneration each time it appears — a recurring effect (a specific door creak, a character's specific ringtone) or a recurring music cue, not a one-off sound. Reuse the exact same tag string across every script where that same asset should apply; a typo creates a new, disconnected tag rather than erroring, so double-check against `assets/manifests/audio.json`'s existing keys (or ask the writer) before inventing a new one.

An untagged cue is completely normal — tag one only when asked, or when you can tell from context the writer wants this exact sound reused elsewhere. A tagged cue with no matching `assets/manifests/audio.json` entry is reported as a non-blocking warning by `node agents/validate.js`, never an error: the asset may simply not be sourced yet. Never invent or edit `assets/manifests/audio.json` yourself unless the writer explicitly asks — it's hand-authored production data, not something to guess at.

## The shot-list convention

A second, similar plain-English convention — for camera/pre-production breakdown rather than audio:

| Prefix | Meaning |
|---|---|
| `SHOT:` | Starts a new shot — freeform framing/angle/subject description (e.g. `WIDE`, `CLOSE-UP on SANGO`, `OTS`). Deliberately not a fixed vocabulary; shot types combine too freely for a clean enum. |
| `POSE:` | Character pose/action for the currently-open shot. Character names here get the same automatic linking as any other action-line text. |
| `LIGHT:` | Lighting description for the currently-open shot — write it prose/prompt-shaped, since it's meant to double as raw material for an external AI image generator later, not just a note to the crew. |
| `DURATION:` | A duration estimate for the currently-open shot, e.g. `4s`, `~5 seconds`. |

Shots are numbered sequentially within each scene (resetting at every scene heading) — `SHOT:` opens a new shot record; `POSE:`/`LIGHT:`/`DURATION:` set fields on whichever shot is currently open, last value wins if repeated. One of these lines with no `SHOT:` open yet is simply inert, not an error.

Example:
```
SHOT: WIDE, establishing
LIGHT: Cold blue rim light, deep shadow
DURATION: 4s

SHOT: CLOSE-UP on SANGO
POSE: SANGO grips the console, jaw tight
LIGHT: Warm key from below, motivated by the console glow
DURATION: ~3 seconds
```

This convention is free to use in any project — extraction itself doesn't require a license. **Export Shot List** (LoreFountain Pro), which turns these annotations into a CSV/Markdown pre-production breakdown, does.

### Tagging a shot: linking it to a still or clip

A `SHOT:` line can carry an optional `[tag]` right after the prefix, with exactly the same shape as a cue tag (lowercase letters, digits, single hyphens). It's the shot's stable handle into `assets/manifests/shots.json`, which maps the tag to the still or clip that fills the shot:

```
SHOT: [archive-ident] WIDE, abstract — the Archive Presence (recurring ident)
SHOT: [1x01-basement-wide] WIDE, establishing — LUCIEN's basement office
SHOT: MEDIUM, on LUCIEN
```

Naming convention:

- Prefix an episode-specific shot with the episode's production code: `1x01-basement-wide`.
- Leave the prefix off a recurring shot used across episodes (an ident, a bumper): `archive-ident`. The same tag in several scripts means the same asset.
- **Never put a scene or shot number in a tag.** Numbers are exactly what changes when a shot is inserted, which is why shots are keyed by tag at all.

Tags are optional, and an untagged shot is never an error. Repeating a tag within one script is fine (cutting back to the same image). A tagged shot with no `shots.json` entry is a non-blocking warning (`unmapped-shot-tag`): the image may not exist yet. As with `audio.json`, never create or edit `assets/manifests/shots.json` yourself unless the writer asks.

### The shot sidecar

Every script with at least one `SHOT:` line gets a `<script-name>.shots.json` sidecar next to it, regenerated on every save and never hand-edited; it's removed again if the script loses all its shots. For each shot it records the scene and shot number, the tag, the scene heading broken into parts (INT./EXT., setting, time of day, and any location entities the setting names exactly), the shot's line range, everything heard in it (dialogue with speaker and cue-line extensions, every parenthetical with its wording, both kinds of pause, lyrics, overlapping dual dialogue), its action blocks, its on-screen text (centered text), the transition at its end, each with its line number, the entities its own text mentions, and the line numbers of cues that *start* in it (pointers into `.cues.json`). Text in a scene before its first `SHOT:` is kept as shot 0, so nothing is lost. Downstream tools read this file instead of parsing Fountain.

If a scene heading's setting matches more than one location entity (two "Basement"s), it's left unresolved and noted as `ambiguous-location`. Give one of them a more specific name or alias rather than guessing.

## Adding cues and shots when asked

If the writer asks you to add SFX/MUSIC/AMB cues, SHOT/POSE/LIGHT/DURATION annotations, or PAUSE: lines to a scene — whether one you're writing fresh or one that's already there — write them directly using the conventions above, in the right place in the action. Choose values that fit what the scene already establishes: a `MUSIC:` cue's Role/Timing should match the moment's dramatic shape (a scene closing softly reads as `MUSIC: OUT`, a reveal reads as `MUSIC: STING`, a scene meant to run tense under dialogue reads as `MUSIC: BED IN`), and a `SHOT:`'s framing should match what the action already describes. This is the same editorial judgment you already use writing the action lines themselves — don't wait to be told the exact keyword for every cue, and don't ask the writer to fill them in themselves unless the scene genuinely doesn't give you enough to go on.

## Questions about scenes, presence, or dialogue

If the writer asks something like "which scenes have both X and Y in them" or "every line that mentions the reactor core," tell them to run LoreFountain's "Structured Search" command rather than trying to answer by grepping the scripts yourself — it uses the same scene/mention data the extension already tracks, and will be more reliable than a manual read-through. Likewise, if they want a dialogue-only transcript of a script (cues and action lines stripped, for accessibility or show notes), point them at "Export Transcript" instead of writing one by hand. Both only run inside VS Code — you can't invoke them yourself if you're working through file edits alone.

## Check your own work

After creating or editing any scripts, run `node agents/validate.js` from the project root (this also regenerates every script's cue and shot sidecars). It has no VS Code dependency. Fix anything it reports before telling the writer you're done.
