# LoreFountain — Script-Writing Reference

Read this before creating or editing any `.fountain` file under `scripts/`.

`scripts/` here means this project's actual scripts folder — check `AGENTS.md`'s "Folder names" section for how to find its real name if this project doesn't use the default.

## Standard Fountain, nothing more

Scripts are 100% standard Fountain — scene headings, character cues, dialogue, parentheticals, transitions. Nothing LoreFountain-specific is required to make linking to the world work, and scripts stay fully portable to any other Fountain tool.

## Linking to the world

Any entity or glossary term's name (or an alias) appearing anywhere in the script — a character cue, an action line, dialogue — is recognized and linked automatically. No special syntax is needed for this.

For a deliberate, explicit link (useful when you want to be unambiguous, or the name is a generic word), wrap it in double brackets: `[[Entity Name]]`.

If a script needs an entity that doesn't exist yet, create the entity file first (see `agents/world-builder.md`), then reference it in the script. Don't invent an entity inline in the script text without also giving it a proper file under `world/` — otherwise it's never indexed, linkable, or reusable elsewhere.

## The cue convention

Audio cues are ordinary action-line prose using a fixed prefix — type the prefix exactly as shown; a typo silently breaks extraction into the cue sidecar.

| Prefix | Meaning | Modifiers |
|---|---|---|
| `SFX:` | Sound effect | — |
| `MUSIC:` | Music cue | `IN`, `OUT`, `STING`, `UNDER` |
| `AMB:` | Ambience/room-tone bed | — |

Examples: `SFX: metal groaning UNDER`, `MUSIC: STING - the reveal`.

Every script's cues are parsed automatically into a `<script-name>.cues.json` sidecar file next to it. Never hand-edit that sidecar — it's regenerated from the script on every save (or by `node agents/validate.js` — see below) and any manual edit will be silently overwritten.

## Questions about scenes, presence, or dialogue

If the writer asks something like "which scenes have both X and Y in them" or "every line that mentions the reactor core," tell them to run LoreFountain's "Structured Search" command rather than trying to answer by grepping the scripts yourself — it uses the same scene/mention data the extension already tracks, and will be more reliable than a manual read-through. Likewise, if they want a dialogue-only transcript of a script (cues and action lines stripped, for accessibility or show notes), point them at "Export Transcript" instead of writing one by hand. Both only run inside VS Code — you can't invoke them yourself if you're working through file edits alone.

## Check your own work

After creating or editing any scripts, run `node agents/validate.js` from the project root (this also regenerates every script's cue sidecar). It has no VS Code dependency. Fix anything it reports before telling the writer you're done.
