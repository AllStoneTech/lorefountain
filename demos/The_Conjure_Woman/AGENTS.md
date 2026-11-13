<!-- lorefountain-docs-version: 7 -->
# AGENTS.md

This project uses [LoreFountain](https://github.com/AllStoneTech/lorefountain) — Fountain scripts linked to a structured, persistent world. If you're an AI coding agent working in this project, start here before making any changes.

## Folder names

Every file in `agents/` below refers to four folders by their **default** names: `world/`, `scripts/`, `imports/`, `assets/`. This project may use different names for any of them. Before doing anything, check whether `lorefountain.config.json` exists at the project root and read its `folders` object:

```json
{ "folders": { "world": "...", "scripts": "...", "imports": "...", "assets": "..." } }
```

Any key present overrides that default; any key absent (or the whole file missing) means the default still applies. Substitute the real name everywhere `agents/*.md` says `world/`, `scripts/`, `imports/`, or `assets/` — those files were written once and are not regenerated when the config changes, so this file is the source of truth for what they actually mean in this project, not the literal words in them.

## Project type

`lorefountain.config.json` may also hold `"project_type"`: what kind of writing project this is. Read it before you write, and let it pick the conventions and folder structure:

| `project_type` | Write it as | Conventions that suit it |
| --- | --- | --- |
| `screenplay` | One feature film in standard screenplay format. | The basics only. |
| `tv_series` | A show with a fixed run, or self-contained episodes: one folder per season, one per episode. | Sound cues, shot maps. |
| `serialized_universe` | A long-running original series whose arcs and cast carry across seasons: seasons and episodes, with arc entities tying episodes together. | Sound cues, shot maps, arcs, the continuity tools, the `assets/` manifests. |
| `audio_drama` | A story told in sound: one folder per season, one per episode. | Sound cues. |
| `comic` | A `PAGE:`/`PANEL:` script for an artist: one folder per issue. | Page/Panel, sound cues, shot maps (when `comic.panelsAsShots` is on). |
| `prose` | Prose chapters, one quiet `.fountain` file per chapter, with the story bible as a record. | The continuity tools; no scene headings, cues or shots. |
| `tabletop` | A campaign run by a game master: one folder per session; secrets and hooks matter. | The continuity tools. |
| `custom`, or absent | No recommendation. Follow what the project already does. | None. |

It describes how the work is *written*, never how it is rendered. It is a recommendation only: never add a convention the type doesn't suggest unless the writer asks, never remove one the writer already uses, and an explicit setting (such as `comic.preset`) always wins. If `project_type` is missing, don't add it yourself; the writer sets it with **LoreFountain: Set Project Type**.

## What to read, and when

- **Bringing new or revised material in from `imports/`?** Read `agents/initiator.md` — safe to run the first time or any time after.
- **Creating or editing an entity or glossary file under `world/`?** Read `agents/world-builder.md` — it also covers `assets/manifests/characters.json`/`locations.json`/`objects.json`/`voice.json`, which key off entity ids and need attention if you rename or delete one.
- **Writing or editing a `.fountain` script under `scripts/`?** Read `agents/script-writer.md` — it covers the `SFX:`/`MUSIC:`/`AMB:`/`SHOT:`/`PAUSE:` conventions, the comic-script `PAGE:`/`PANEL:` convention (with its per-project `comic` settings in `lorefountain.config.json`, including `panelsAsShots` for narrated and motion comics), the optional `[tag]` syntax that links a cue to `assets/manifests/audio.json` and a shot to `assets/manifests/shots.json`, and how to keep dialogue and pauses valid Fountain.
- **Just finished a batch of edits?** Run `node agents/validate.js` from the project root — no VS Code needed. It reports malformed files, dangling relation targets, dangling asset-manifest entries, script formatting problems and comic page/panel checks (warnings, then informational notes) before you tell the writer you're done. (It reads `lorefountain.config.json` itself, so it always uses this project's real folder names regardless of what's written above.)

Never write into `imports/` unless the writer explicitly asks you to update something there — it holds the writer's own source material, and LoreFountain itself never touches it automatically. Nothing outside `world/`, `scripts/`, `imports/` (only when asked), `assets/` (only when asked — the manifest files are hand-authored, and a binary asset file itself is never something to create yourself), and this project's own config/agent files should be touched either.
