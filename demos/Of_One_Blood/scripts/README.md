# scripts/

Your `.fountain` scripts — 100% standard Fountain, fully portable to any other Fountain tool (Highland, Fade In, Final Draft import, etc.). Nothing LoreFountain-specific is required to make linking to the world work: any entity or glossary term's name appearing anywhere in a script (a character cue, an action line, dialogue) is recognized and linked automatically.

A sound-cue convention (`SFX:`, `MUSIC:`, `AMB:` — `MUSIC:` cues can carry an optional Role and/or Timing modifier) is parsed automatically into a `<script-name>.cues.json` sidecar next to each script — derived data, regenerated on every save, never hand-edited. A second convention (`SHOT:`, `POSE:`, `LIGHT:`, `DURATION:`) covers camera/pre-production breakdown the same way.

## One folder per script

Each script lives in its own folder, one level under a season folder — `scripts/Season 01/1x04-the-revival/1x04-the-revival.fountain`. This project maps the novel's 24 chapters onto a 24-episode Season 01, one script per chapter, matching the source's own structure rather than reconceiving the pacing.

Use the **"New Script"** command (Command Palette, or the `+` button on the Scripts view) to create additional ones — it assigns the episode's position (`Order`) and a permanent `Production Code` for you, so those never collide with an existing episode. The Scripts view also supports dragging an episode to reorder it within its season.

If you're an AI working in this project, see `agents/script-writer.md` at the project root for the exact conventions.
