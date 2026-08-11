# LoreFountain — Script-Writing Reference

Read this before creating or editing any `.fountain` file under `scripts/`.

`scripts/` here means this project's actual scripts folder — check `AGENTS.md`'s "Folder names" section for how to find its real name if this project doesn't use the default.

## Standard Fountain, nothing more

Scripts are 100% standard Fountain — scene headings, character cues, dialogue, parentheticals, transitions. Nothing LoreFountain-specific is required to make linking to the world work, and scripts stay fully portable to any other Fountain tool.

## Folder structure: one folder per script

Each script gets its own folder, one level under an optional season folder: `scripts/Season 01/1x03-the-reveal/1x03-the-reveal.fountain`. Everything else about that episode — its cue sidecar, and anything a writer drops in (audio, images, notes) — lives alongside it in that same folder. LoreFountain has no awareness of what those other files are; they're just along for the ride, the same as anything in `imports/`.

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

## Questions about scenes, presence, or dialogue

If the writer asks something like "which scenes have both X and Y in them" or "every line that mentions the reactor core," tell them to run LoreFountain's "Structured Search" command rather than trying to answer by grepping the scripts yourself — it uses the same scene/mention data the extension already tracks, and will be more reliable than a manual read-through. Likewise, if they want a dialogue-only transcript of a script (cues and action lines stripped, for accessibility or show notes), point them at "Export Transcript" instead of writing one by hand. Both only run inside VS Code — you can't invoke them yourself if you're working through file edits alone.

## Check your own work

After creating or editing any scripts, run `node agents/validate.js` from the project root (this also regenerates every script's cue sidecar). It has no VS Code dependency. Fix anything it reports before telling the writer you're done.
