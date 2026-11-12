<!-- lorefountain-docs-version: 4 -->
# scripts/

Seven `.fountain` files, one per issue of a comic-book miniseries, 100-odd pages in all. 100% standard Fountain, portable to any Fountain tool. Any entity or glossary term's name appearing anywhere in a script is recognized and linked automatically.

**This demo is a comic script.** Two convention lines give it its structure, `PAGE: 7` (a number, a range like `2-3`, or text, with optional modifiers such as `(SPLASH)` or `(TURN)`) and `PANEL: description`, together with ordinary Fountain dialogue for balloons plus `CAPTION:`, `SFX:` and `LAYOUT:`. Leave a blank line after `PAGE:` so other Fountain apps don't read it as a character. A script with a `PAGE:` line gets a `<script-name>.pages.json` sidecar next to it (each page and panel, its lettering and word counts), derived data like the other sidecars and never hand-edited; the validator reports its totals and checks. See the Fountain Syntax help for the details, and `agents/script-writer.md` for the full rules.

The sound-cue convention (`SFX:`, `MUSIC:`, `AMB:`) and shot convention (`SHOT:`, `POSE:`, `LIGHT:`, `DURATION:`) are also available, but this comic uses only `SFX:` (as lettering) and leaves it untagged. A comic page is not a scene: each script keeps a real `EXT.`/`INT.` heading at every change of place or time, and the pages and panels run underneath.

Each script lives in its own folder directly under `scripts/`, named for the issue — `scripts/Issue 01 - The Island/Issue 01 - The Island.fountain` — so anything else about that issue (thumbnails, pencils, lettering files) belongs alongside it. The title page carries `Title:`, `Order:` (position in the series) and `Production Code:` (`1x01` to `1x07`, permanent once assigned).

Use the **"New Script"** command to create additional issues — it assigns `Order` and a permanent `Production Code` for you.
