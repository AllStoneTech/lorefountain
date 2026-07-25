# LoreFountain — Script-Writing Reference

Read this before creating or editing any `.fountain` file under `{{SCRIPTS_FOLDER}}/`.

## Standard Fountain, nothing more

Scripts are 100% standard Fountain — scene headings, character cues, dialogue, parentheticals, transitions. Nothing LoreFountain-specific is required to make linking to the world work, and scripts stay fully portable to any other Fountain tool.

## Linking to the world

Any entity or glossary term's name (or an alias) appearing anywhere in the script — a character cue, an action line, dialogue — is recognized and linked automatically. No special syntax is needed for this.

For a deliberate, explicit link (useful when you want to be unambiguous, or the name is a generic word), wrap it in double brackets: `[[Entity Name]]`.

If a script needs an entity that doesn't exist yet, create the entity file first (see `agents/world-builder.md`), then reference it in the script. Don't invent an entity inline in the script text without also giving it a proper file under `{{WORLD_FOLDER}}/` — otherwise it's never indexed, linkable, or reusable elsewhere.

## The cue convention

Audio cues are ordinary action-line prose using a fixed prefix — type the prefix exactly as shown; a typo silently breaks extraction into the cue sidecar.

| Prefix | Meaning | Modifiers |
|---|---|---|
| `SFX:` | Sound effect | — |
| `MUSIC:` | Music cue | `IN`, `OUT`, `STING`, `UNDER` |
| `AMB:` | Ambience/room-tone bed | — |

Examples: `SFX: metal groaning UNDER`, `MUSIC: STING - the reveal`.

Every script's cues are parsed automatically into a `<script-name>.cues.json` sidecar file next to it. Never hand-edit that sidecar — it's regenerated from the script on every save and any manual edit will be silently overwritten.
