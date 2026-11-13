<!-- lorefountain-docs-version: 7 -->
# {{SCRIPTS_FOLDER}}/

Your `.fountain` scripts — 100% standard Fountain, fully portable to any other Fountain tool (Highland, Fade In, Final Draft import, etc.). Nothing LoreFountain-specific is required to make linking to the world work: any entity or glossary term's name appearing anywhere in a script (a character cue, an action line, dialogue) is recognized and linked automatically.

A sound-cue convention (`SFX:`, `MUSIC:`, `AMB:` — `MUSIC:` cues can carry an optional Role and/or Timing modifier) is parsed automatically into a `<script-name>.cues.json` sidecar next to each script — derived data, regenerated on every save, never hand-edited. A second convention (`SHOT:`, `POSE:`, `LIGHT:`, `DURATION:`) covers camera/pre-production breakdown the same way.

Any of the three cue types can also carry an optional `[tag]` right after the prefix, e.g. `SFX: [kola-nuts-clatter] kola nuts clatter in a bowl` — a stable handle into `{{ASSETS_FOLDER}}/manifests/audio.json`, so the same sound design choice is reused every time that exact tag recurs across the season instead of being re-picked or regenerated. Leave a cue untagged until its asset is actually sourced; a tagged cue with no matching manifest entry is only a warning, never an error.

`SHOT:` lines can carry a `[tag]` the same way, e.g. `SHOT: [1x01-basement-wide] WIDE, establishing`, a stable handle into `{{ASSETS_FOLDER}}/manifests/shots.json` naming the still or clip that fills the shot. Prefix an episode-specific tag with its production code (`1x01-basement-wide`), leave the prefix off a recurring shot (`archive-ident`), and never put scene or shot numbers in a tag, since those change whenever a shot is inserted. Every script with shots also gets a `<script-name>.shots.json` sidecar: each shot's line range, what's heard in it, the entities it mentions, its scene heading broken into parts, and pointers to the cues that start in it. Like the cue sidecar, it's regenerated on every save and never hand-edited.

A comic script adds two more convention lines, `PAGE: 7` (a number, a range like `2-3`, or text, with optional modifiers such as `(SPLASH)`) and `PANEL: description`, with ordinary Fountain dialogue for balloons plus `CAPTION:`, `SFX:` and `LAYOUT:`. Leave a blank line after `PAGE:` so other Fountain apps don't read it as a character. A script with a `PAGE:` line gets a `<script-name>.pages.json` sidecar next to it (each page and panel, its lettering and word counts) — derived data like the others, never hand-edited. In the Scripts view, expanding a comic script lists its pages and panels (with counts, and a warning icon where the script has an issue); click one to jump to that line. In a comic, `SFX:` is lettering only (not an audio cue) unless `lorefountain.config.json` sets `comic.sfxAsCue`, and the word-budget notes follow its `comic.preset` (`western`, `manga`, `european`, `webtoon` or `custom`) and any `comic.limits`. See the Fountain Syntax help for the details.

For a narrated or motion comic, set `comic.panelsAsShots` to `true` in `lorefountain.config.json` and each panel of a comic with no `SHOT:` lines becomes a shot in `<script-name>.shots.json` (a `PANEL: [tag]`, `DURATION:` and `MOVE:` inside a panel set its name, length and camera move).

A scene pause is written as `PAUSE:` (optionally with a length, `PAUSE: 2s`); a character's own pause stays a `(beat)` parenthetical inside their dialogue. Keep a speech and its parentheticals together with no blank lines: in Fountain a blank line ends a dialogue block, so a `(beat)` after a blank line becomes action.

## One folder per script

Each script lives in its own folder, one level under an optional season folder — `{{SCRIPTS_FOLDER}}/Season 01/1x03-the-reveal/1x03-the-reveal.fountain`. Anything else about that episode (audio, images, notes) belongs alongside it in that same folder; nothing about LoreFountain requires a particular set of files there beyond the script itself.

Use the **"New Script"** command (Command Palette, or the `+` button on the Scripts view) to create one — it assigns the episode's position (`Order`) and a permanent `Production Code` for you, so those never collide with an existing episode. The Scripts view also supports dragging an episode to reorder it within its season.

If you're an AI working in this project, see `agents/script-writer.md` at the project root for the exact conventions.
