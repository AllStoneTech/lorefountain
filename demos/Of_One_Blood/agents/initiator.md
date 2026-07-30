# LoreFountain — Migrating from `imports/`

You are helping a writer bring existing story-bible material from `imports/` into `world/`. This is safe to run more than once: the first time a project has existing material, and again anytime the writer has added or revised something in `imports/` since the last pass. It works with any coding agent (Cursor, Copilot, Gemini, or otherwise) — no tool-specific syntax.

`imports/` and `world/` here mean this project's actual folders — check `AGENTS.md`'s "Folder names" section for how to find their real names if this project doesn't use the defaults.

## Before you do anything

Read `agents/world-builder.md` for the entity/glossary file format and ground rules. If `scripts/` already has any scripts, also read `agents/script-writer.md`. Everything below assumes you've read those — this file doesn't repeat the schema.

## Ask before you generate

Don't read the source material and immediately start writing dozens of files. First:

1. Skim what's in `imports/` (and anywhere else the writer points you) and report back roughly what you found — how many distinct entities, what kinds, and anything that looks like it's about something *other* than the story world itself (production plans, budgets, marketing strategy) — don't turn that into entities.
2. Skim what's already in `world/` too. If this isn't the first pass, most of what's in `imports/` may already be modeled — note which import material looks brand new versus which looks like it revises or contradicts an entity that already exists.
3. Ask the writer how exhaustive they want this pass to be: every new thing you can find, or a smaller, reviewable batch first that they check before you continue.
4. Flag any real judgment calls before deciding them yourself — real historical or public figures referenced by the fiction, conflicting details between documents (prefer the more recently modified document, but say so), an import that seems to contradict an existing entity, anything where "canon" isn't obvious. Ask, don't guess.

Only start writing files once the writer has answered.

## What you're doing

Read every existing document in `imports/`. Identify every distinct entity (character, location, faction, object, concept) and every piece of invented terminology. For anything that doesn't already have a matching file under `world/`, create one following the format in `agents/world-builder.md`. For anything that already has a matching entity file, don't overwrite it — tell the writer what the import material adds or changes and let them decide whether to update it themselves or have you do it.

Do not modify, move, or delete anything in `imports/`, or write anywhere outside `world/`. That holds in both directions — even if writing in `scripts/` or `world/` later makes something in `imports/` outdated, only touch that folder if the writer explicitly asks you to update it. That's a separate, deliberate request, not something this workflow does on its own.

## When you're done

Run `node agents/validate.js` from the project root — it has no VS Code dependency and reports malformed files or dangling relation targets across everything you just wrote. Fix anything it flags. Then list every file you created, every existing entity you flagged as possibly outdated (and why), and the validator's final output, so the writer can review the whole batch before doing anything else with it.
