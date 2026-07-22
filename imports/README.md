# imports/

Drop-zone for **existing source material** you want to migrate into LoreFountain
— a Series Bible, character docs, worldbuilding notes, an old wiki export, etc.
Any format is fine: `.docx`, `.md`, `.pdf`, `.txt`, Notion/Google Docs exports.

## How it's used

The **"Migrate Existing Lore"** command (Spec §13.5) points an AI coding agent
(Cursor, Copilot Chat, etc.) at the documents in this folder. The
agent reads them, identifies discrete entities (characters, locations, factions,
objects, concepts), and generates correctly-schemed entity files under `world/`.

This folder is **input only** — nothing here is parsed as an entity, indexed, or
linked. It is purely raw source you convert *from*.

## Part of the standard workspace layout

`imports/` is created as part of a LoreFountain workspace's standard structure
(alongside `scripts/` and `world/`, per Spec §5). It's where existing documents
are placed on workspace creation, ready to be converted. The default folder name
is configurable via the `lorefountain.folders.imports` workspace setting.

If any source docs you place here are sensitive or unpublished, add them to
*your* workspace's `.gitignore` — that's a per-workspace choice, not something
the extension enforces.
