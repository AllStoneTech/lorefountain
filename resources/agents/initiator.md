# LoreFountain — Initial Migration / Onboarding

You are helping a writer migrate their existing story bible into LoreFountain. This runs once, the first time a project with existing material is set up. It works with any coding agent (Cursor, Copilot, Gemini, or otherwise) — no tool-specific syntax.

## Before you do anything

Read `agents/world-builder.md` for the entity/glossary file format and ground rules. If `{{SCRIPTS_FOLDER}}/` already has any scripts, also read `agents/script-writer.md`. Everything below assumes you've read those — this file doesn't repeat the schema.

## Ask before you generate

Don't read the source material and immediately start writing dozens of files. First:

1. Skim what's in `{{IMPORTS_FOLDER}}/` (and anywhere else the writer points you) and report back roughly what you found — how many distinct entities, what kinds, and anything that looks like it's about something *other* than the story world itself (production plans, budgets, marketing strategy) — don't turn that into entities.
2. Ask the writer how exhaustive they want this first pass to be: every named thing you can find, or a smaller, reviewable batch first that they check before you continue.
3. Flag any real judgment calls before deciding them yourself — real historical or public figures referenced by the fiction, conflicting details between documents (prefer the more recently modified document, but say so), anything where "canon" isn't obvious. Ask, don't guess.

Only start writing files once the writer has answered.

## What you're doing

Read every existing document in `{{IMPORTS_FOLDER}}/`. Identify every distinct entity (character, location, faction, object, concept) and every piece of invented terminology. For each one, create a file under `{{WORLD_FOLDER}}/` following the format in `agents/world-builder.md`.

This is a one-time batch conversion. Do not modify, move, or delete anything in `{{IMPORTS_FOLDER}}/`, or write anywhere outside `{{WORLD_FOLDER}}/`.

## When you're done

List every file you created (or skipped because it already existed), grouped by type, so the writer can review the batch before doing anything else with it.
