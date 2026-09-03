<!-- lorefountain-docs-version: 2 -->
# AGENTS.md

This project uses [LoreFountain](https://github.com/AllStoneTech/lorefountain) — Fountain scripts linked to a structured, persistent world. If you're an AI coding agent working in this project, start here before making any changes.

## Folder names

Every file in `agents/` below refers to four folders by their **default** names: `world/`, `scripts/`, `imports/`, `assets/`. This project may use different names for any of them. Before doing anything, check whether `lorefountain.config.json` exists at the project root and read its `folders` object:

```json
{ "folders": { "world": "...", "scripts": "...", "imports": "...", "assets": "..." } }
```

Any key present overrides that default; any key absent (or the whole file missing) means the default still applies. Substitute the real name everywhere `agents/*.md` says `world/`, `scripts/`, `imports/`, or `assets/` — those files were written once and are not regenerated when the config changes, so this file is the source of truth for what they actually mean in this project, not the literal words in them.

## What to read, and when

- **Bringing new or revised material in from `imports/`?** Read `agents/initiator.md` — safe to run the first time or any time after.
- **Creating or editing an entity or glossary file under `world/`?** Read `agents/world-builder.md` — it also covers `assets/manifests/characters.json`/`locations.json`/`objects.json`/`voice.json`, which key off entity ids and need attention if you rename or delete one.
- **Writing or editing a `.fountain` script under `scripts/`?** Read `agents/script-writer.md` — it covers the `SFX:`/`MUSIC:`/`AMB:`/`SHOT:` conventions and the optional `[tag]` syntax that links a cue to `assets/manifests/audio.json`.
- **Just finished a batch of edits?** Run `node agents/validate.js` from the project root — no VS Code needed. It reports malformed files, dangling relation targets, and dangling asset-manifest entries before you tell the writer you're done. (It reads `lorefountain.config.json` itself, so it always uses this project's real folder names regardless of what's written above.)

Never write into `imports/` unless the writer explicitly asks you to update something there — it holds the writer's own source material, and LoreFountain itself never touches it automatically. Nothing outside `world/`, `scripts/`, `imports/` (only when asked), `assets/` (only when asked — the manifest files are hand-authored, and a binary asset file itself is never something to create yourself), and this project's own config/agent files should be touched either.
