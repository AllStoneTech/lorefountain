# {{SCRIPTS_FOLDER}}/

Your `.fountain` scripts — 100% standard Fountain, fully portable to any other Fountain tool (Highland, Fade In, Final Draft import, etc.). Nothing LoreFountain-specific is required to make linking to the world work: any entity or glossary term's name appearing anywhere in a script (a character cue, an action line, dialogue) is recognized and linked automatically.

A sound-cue convention (`SFX:`, `MUSIC:`, `AMB:`) is parsed automatically into a `<script-name>.cues.json` sidecar next to each script — derived data, regenerated on every save, never hand-edited.

If you're an AI working in this project, see `agents/script-writer.md` at the project root for the exact conventions.
