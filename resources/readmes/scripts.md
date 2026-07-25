# {{SCRIPTS_FOLDER}}/

Your `.fountain` scripts — 100% standard Fountain, fully portable to any other Fountain tool (Highland, Fade In, Final Draft import, etc.). Nothing LoreFountain-specific is required to make linking to the world work: any entity or glossary term's name appearing anywhere in a script (a character cue, an action line, dialogue) is recognized and linked automatically.

A sound-cue convention (`SFX:`, `MUSIC:`, `AMB:`) is parsed automatically into a `<script-name>.cues.json` sidecar next to each script — derived data, regenerated on every save, never hand-edited.

## One folder per script

Each script lives in its own folder, one level under an optional season folder — `{{SCRIPTS_FOLDER}}/Season 01/1x03-the-reveal/1x03-the-reveal.fountain`. Anything else about that episode (audio, images, notes) belongs alongside it in that same folder; nothing about LoreFountain requires a particular set of files there beyond the script itself.

Use the **"New Script"** command (Command Palette, or the `+` button on the Scripts view) to create one — it assigns the episode's position (`Order`) and a permanent `Production Code` for you, so those never collide with an existing episode. The Scripts view also supports dragging an episode to reorder it within its season.

If you're an AI working in this project, see `agents/script-writer.md` at the project root for the exact conventions.
