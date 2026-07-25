# AGENTS.md

This project uses [LoreFountain](https://github.com/AllStoneTech/lorefountain) — Fountain scripts linked to a structured, persistent world. If you're an AI coding agent working in this project, start here before making any changes.

- **Setting up from existing material for the first time?** Read `agents/initiator.md`.
- **Creating or editing an entity or glossary file under `{{WORLD_FOLDER}}/`?** Read `agents/world-builder.md`.
- **Writing or editing a `.fountain` script under `{{SCRIPTS_FOLDER}}/`?** Read `agents/script-writer.md`.

Never write into `{{IMPORTS_FOLDER}}/` — it holds the writer's own source material and is never modified by LoreFountain or by an AI working in this project. Nothing outside `{{WORLD_FOLDER}}/`, `{{SCRIPTS_FOLDER}}/`, and this project's own config/agent files should be touched either.
