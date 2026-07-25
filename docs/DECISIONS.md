# Architecture Decisions

A running log of significant technical decisions and their rationale. Newest
first. Each entry records what was decided, why, and what would trigger a
revisit.

---

## ADR-0022 — `imports/` is a two-way, living folder; agent files resolve folder names from config at read time, not scaffold time

**Date:** 2026-07-25 · **Status:** Accepted

Two related corrections raised by the project owner while reviewing ORUN: (1) `imports/` was documented and prompted as a one-time, one-directional drop zone, but realistically it keeps evolving alongside `world/`/`scripts/`, in both directions; (2) scaffolded agent files baked this workspace's folder names into the file text at write time, so a later `lorefountain.config.json` edit (like ORUN's `imports` → `docs` rename) silently orphans every already-scaffolded instruction file.

1. **`agents/initiator.md` is now safe to re-run**, not a one-time script: before creating a file it also skims `world/` for an existing match, and on a likely revision it reports the discrepancy and asks the writer rather than overwriting — extending `world-builder.md`'s existing "don't overwrite without asking" rule from filename collisions to content conflicts.
2. **The reverse direction (world/scripts changes making `imports/` stale) is documented but deliberately not built.** There's no LoreFountain-specific mechanism possible here: `imports/` holds arbitrary formats (`.docx`, `.xlsx`, etc.) the extension has no parser or writer for. `AGENTS.md`, `imports.md`, and `initiator.md` now say a writer can explicitly ask an AI to update something there to match new canon, but that's generic AI file-editing, not a LoreFountain feature — the invariant that LoreFountain itself never touches `imports/` automatically is unchanged.
3. **Agent-file templates no longer get folder names substituted in at scaffold time.** `scaffoldAgentFilesIfAbsent` now copies `AGENTS.md`/`agents/*` verbatim (`src/config/agentFiles.ts`); the templates say `world/`/`scripts/`/`imports/` as literal defaults, and `AGENTS.md`'s new "Folder names" section instructs the AI to read `lorefountain.config.json`'s `folders` object itself and substitute the real names mentally wherever the other files say the defaults. This matches how `agents/validate.js` already worked (it reads the config live at run time) and closes the exact staleness gap that just bit ORUN — a config rename no longer requires touching already-scaffolded files at all, since they never hardcoded a name to begin with.
4. **`readmeFiles.ts` keeps scaffold-time substitution**, unchanged — human-facing docs are read once by a person who benefits from seeing this project's actual folder name inline, and don't get "acted on" the way an AI following stale instructions would. The `AgentFolderNames` type it depended on moved from `agentFiles.ts` (which no longer needs it) to `folders.ts` as `FolderNames`, alongside the other folder-settings types it's structurally identical to.
5. **ORUN's `lorefountain.config.json` now points `imports` at `docs`** — ORUN already had a pre-existing `docs/` folder holding its real story-bible material, and LoreFountain's own scaffolded (empty) `imports/` folder was redundant; removed. ORUN's already-scaffolded `AGENTS.md`/`agents/*.md` were left stale on purpose — resyncing them is deferred until the `scripts/` subfolder-per-episode structure (raised in the same conversation, not yet decided) is settled, so ORUN isn't synced twice.

---

## ADR-0021 — Headless validator + human-facing READMEs; LoreFountain reframed as a portable methodology

**Date:** 2026-07-25 · **Status:** Accepted

Closed the remaining gaps from the Phase F audit: an AI working file-by-file with no VS Code involved had no way to check its own work, and no human-readable explanation of what any folder was for or why. Implemented as `src/index/memoryStore.ts` + `src/cli/validate.ts` (bundled to `resources/agents/validate.js`) and `src/config/readmeFiles.ts` (`scaffoldReadmesIfAbsent`) + seven bundled templates under `resources/readmes/`.

1. **The validator reuses the real indexing logic, not a reimplementation** — `buildIndexFromDisk`, `parseEntityFile`/`parseGlossaryFile`, and `findDanglingRelations` are all shared with the live extension unchanged. The only new code is `memoryStore.ts`, a second `IndexStore` implementation with zero native/WASM dependency, built specifically so the validator avoids sql.js's `.wasm`-colocation packaging problem (the wasm file must sit wherever `__dirname` resolves post-bundling) — a portable, relocatable single-file script can't reliably replicate that trick inside an arbitrary target project.
2. **Two esbuild targets from one config**: `dist/extension.js` (unchanged, `external: ['vscode']`) and `resources/agents/validate.js` (fully self-contained, no vscode import, no external needed), each with its own build-log prefix (`[esbuild]` vs `[esbuild:validator]`) so the extension's F5 problem-matcher isn't confused by the second target's output.
3. **READMEs are scaffolded to per-folder-configured paths, not a fixed list** — unlike `agentFiles.ts` (always `agents/*.md` regardless of config), a README's target depends on this workspace's actual folder names (`world.md`'s template always lives at a fixed resource path but is written to `<configured world folder>/README.md`). `readmeFiles.ts` uses an explicit per-template target-path resolver rather than forcing this into `agentFiles.ts`'s simpler "same relative path on both sides" model.
4. **Root README frames LoreFountain as a portable methodology, not just a VS Code extension**: entity/glossary files are plain Markdown+YAML and scripts are 100% standard Fountain, checked by a validator that needs no VS Code — the extension is "the richest way to use it," not the only way. This is an accurate description of what was already true structurally, made explicit because the project owner asked whether it was true.
5. **Bug found and fixed during live verification, not by design**: the new README scaffolding wrote `README.md` directly into `world/` and `world/glossary/`, and the existing disk walk (`buildIndexFromDisk` in `build.ts`, plus the file-watcher's `classifyWorldFile` in `workspaceIndex.ts`) had no exclusion for it — every scaffolded README was parsed as a malformed entity/glossary file, in both the live extension's output channel and the headless validator. Fixed by excluding any file named `README.md` (case-insensitive) from both walks, in both places, with a regression test added to `build.test.ts`. Caught by running the validator against the demo workspace immediately after scaffolding, which is exactly the workflow `agents/*.md` now tells an AI to follow after its own edits — the bug would have shown up to any AI following those instructions, not just to manual testing.
6. Verified live in the Extension Development Host: `Initialize Workspace` against the already-populated demo workspace showed the updated modal text (mentioning READMEs and the validator), wrote all seven READMEs to their correct per-folder paths with `{{PROJECT_NAME}}` and folder-name placeholders substituted, and — after the fix in point 5 — `Rebuild Index`'s output-channel summary showed a clean entity/glossary count with no `SKIPPED` warnings for the new files.

---

## ADR-0020 — Phase F: project-level `AGENTS.md` + `agents/*.md` replace the standalone migration-only prompt

**Date:** 2026-07-25 · **Status:** Accepted

Raised by the project owner mid-Phase-F: an AI working in a LoreFountain project needs to know the entity schema and conventions for *every* creation/edit, not just the one-time migration — and that knowledge shouldn't be re-explained inside every prompt separately, or it drifts out of sync. Implemented as `src/config/agentFiles.ts` (`scaffoldAgentFilesIfAbsent`) + four bundled templates (`resources/AGENTS.md`, `resources/agents/{world-builder,script-writer,initiator}.md`), superseding ADR-0019's standalone `migrate-existing-lore-prompt.md`.

1. **Schema knowledge now lives in exactly one place**: `agents/world-builder.md` (entity/glossary format, relations-vs-mentions, ground rules) and `agents/script-writer.md` (Fountain/cue conventions). `agents/initiator.md` — the migration prompt itself — no longer inlines the schema; its first instruction is "read those two files before doing anything." This directly reverses ADR-0019 point 2's original reasoning ("the prompt must be self-contained, since the target project has no reason to contain LoreFountain's spec") — the target project *now* carries that knowledge via `agents/`, so self-containment moved from "one big prompt" to "the project plus a short pointer."
2. **`agents/initiator.md` now explicitly instructs the AI to ask scoping questions before generating anything** — skim the source material and report back what's there, ask how exhaustive the first pass should be, flag real judgment calls (real historical/public figures, conflicting documents) rather than deciding them silently. This directly reverses the gap the project owner flagged: the original migration prompt had no such instruction, and an AI (or a less careful invocation) could have just barreled through and made those calls itself, which is exactly what didn't happen during the actual ORUN migration only because a human was watching closely.
3. **Root `AGENTS.md` is a short index, not the schema itself** — it exists mainly so an AI dropped into the project cold has one obvious entry point, and because several coding tools (Cursor and others) are converging on scanning for that exact filename automatically, without anyone needing to paste a prompt at all.
4. **All four files are scaffolded by `initializeWorkspace`** (the same "create what's missing" step that already handles folders/config), with `{{WORLD_FOLDER}}`/`{{SCRIPTS_FOLDER}}`/`{{IMPORTS_FOLDER}}` placeholders substituted for this workspace's *actual* configured folder names at scaffold time — so every file is immediately readable by any AI with no leftover template syntax. The tradeoff: if folder names are reconfigured later, these files go stale until manually updated; accepted as rare and user-editable, matching `lorefountain.config.json`'s own already-accepted tradeoff.
5. **Never overwrites an existing file** (same contract as `writeDefaultConfigIfAbsent`) — protects a writer's own edits, and also means an unrelated pre-existing `AGENTS.md` from some other tool's convention is left alone rather than silently replaced. Known gap, not fixed here: if such a file already exists, LoreFountain's own instructions never get added to it; documented as an acceptable edge case rather than building markdown-merge logic for it.
6. **`migrateExistingLore` no longer reads its own bundled template** — it scaffolds the files if absent (defensive, in case `initializeWorkspace` was skipped) and then reads `agents/initiator.md` straight from the workspace, so a writer's own edits to that file are what actually gets handed to their AI, not a fixed copy baked into the extension.
7. Verified live in the Extension Development Host: running `Initialize Workspace` against the already-populated demo workspace correctly triggered the existing-folders modal (ADR-0018), and on confirming, wrote `AGENTS.md` + all three `agents/*.md` files with real folder names substituted; running `Migrate Existing Lore` immediately afterward opened that exact scaffolded file, confirming the two commands now share one source of truth.

---

## ADR-0019 — Phase F: migration prompt is a static template + find/replace, not agent-driven generation

**Date:** 2026-07-24 · **Status:** Accepted

Spec §13.5's "Migrate Existing Lore" command implemented as a single static
template (`resources/migrate-existing-lore-prompt.md`) + `src/commands/migrateExistingLore.ts`,
which only substitutes this workspace's actual `imports`/`world` folder
names into the template, copies the result to the clipboard, and opens it
for reference.

1. **The command does not itself read any source documents or generate any
   entity files.** The spec is explicit that this ships as "a premade,
   ready-to-run prompt... AI-agnostic — plain natural-language instructions
   with no tool-specific syntax" — the migration work happens in whichever
   AI coding agent the writer pastes the prompt into, which may not be
   LoreFountain's own host editor at all. Building an in-extension
   generator would be a different, un-asked-for feature (and would tie the
   free tier to a specific AI provider, which the spec explicitly rejects
   for this workflow, citing FictionLab.net's own AI-agnostic positioning
   as precedent).
2. **The template inlines the full entity/glossary schema in plain
   English** (every field from `model/entity.ts`'s discriminated union and
   `model/glossary.ts`, including which fields are type-specific) rather
   than referencing this repo's own `docs/LoreFountain_Spec.md` — the
   prompt must be self-contained, since the target project (someone's own
   story-bible folder) has no reason to contain LoreFountain's spec.
3. **Explicit ground rules against fabrication**: "never invent facts,"
   omit an uncertain field rather than guess it, skip a file that already
   exists rather than overwrite it. These aren't in the spec bullet
   verbatim but follow directly from files-as-truth (§2) and from this
   being a one-time batch conversion of someone's real, often-irreplaceable
   creative material — an agent given this prompt should behave
   conservatively by default.
4. **`{{IMPORTS_FOLDER}}`/`{{WORLD_FOLDER}}` placeholders** are resolved to
   this workspace's actual configured folder names (not hardcoded
   `imports`/`world`) via simple string substitution — no templating
   library needed for two placeholders.
5. Verified live in the Extension Development Host: the command opened an
   untitled Markdown document with both placeholders correctly resolved to
   the demo workspace's actual folder names, and copied the identical text
   to the clipboard.

---

## ADR-0018 — Pre-Phase-F: initialization asks before adopting pre-existing `world`/`scripts` folders

**Date:** 2026-07-24 · **Status:** Accepted

Raised by the project owner immediately before Phase F (the real ORUN dogfood): "this
project should never modify the import directory... if it's pointed into an
existing directory it should not modify any files outside of its core
folders... if there are existing world and scripts folder it should ask
initially." Concrete trigger: ORUN's real project folder
(`a real production project folder`) has its own `docs/` folder
with existing bible/outline documents that must never be touched, and could
plausibly already have `world`/`scripts` folders of its own by the time
LoreFountain is pointed at it for real.

1. **Audit confirmed the codebase was already compliant except for one
   gap.** `build.ts` only ever walks `folders.world`/`folders.glossary`/
   `folders.scripts` — never `imports/`, never anything else at the
   workspace root — and nothing anywhere writes into `imports/` beyond
   creating it empty once. The one real gap: `initializeWorkspace`
   (`extension.ts`) would `mkdir(recursive: true)` (a safe no-op if the
   folder already exists) and index whatever was there **without ever
   telling the user it was adopting a pre-existing folder it didn't
   create.**
2. **Fix**: `src/config/existingFolders.ts` (pure, `detectExistingCoreFolders`)
   checks whether the resolved `world`/`scripts` paths already exist before
   `initializeWorkspace` does anything. If either does, a **modal**
   warning (`{ modal: true }` — deliberately not dismissible by accident,
   since this is a real "does this fold into my existing project or not"
   decision) names which folder(s) were found and states the invariant
   directly ("LoreFountain never touches anything outside its own
   folders"), with a single affirmative action ("Use Existing Folder(s)");
   anything else (Cancel, Escape, click-away) aborts with zero writes.
3. **Scope stayed tight to what was asked**: the check only gates the
   *initialization* command (the only place that creates anything).
   Normal activation/indexing was already read-only with respect to
   `world`/`scripts` content (only the cue sidecar, E5, writes anywhere
   near a script — and only a new `.cues.json`, never touching the script
   itself) and doesn't need a prompt.
4. Verified live in the Extension Development Host against a throwaway
   test folder built specifically to simulate this scenario (a pre-existing
   `world/some-preexisting-file.md`, `scripts/preexisting.fountain`, and an
   unrelated `docs/notes.txt`): the modal appeared naming both folders;
   **Cancel** left the entire filesystem byte-for-byte unchanged (no
   config, no subfolders, no touched files); **Use Existing Folder(s)**
   created only `imports/`, `world/glossary`, `world/notes`,
   `world/timeline`, and `lorefountain.config.json` — the pre-existing
   `some-preexisting-file.md`, `preexisting.fountain`, and `docs/notes.txt`
   were all confirmed untouched (identical content) afterward.

---

## ADR-0017 — Phase E8: walkthrough substitutes the graph view with World-tree browsing; sample content is original, not ORUN's

**Date:** 2026-07-24 · **Status:** Accepted

Spec §20's walkthrough + sample workspace implemented via
`contributes.walkthroughs` (native VS Code "Get Started" surface, no
webview) + `src/commands/tryLoreFountain.ts` (scaffolds and opens a new
folder).

1. **The suggested flow's third step — "open the graph view" — is
   replaced with "browse the World view.**" The graph view is an
   explicitly paid-tier feature (Spec §1.3) that doesn't exist in this
   build; substituting the actual free-tier capstone (the World tree,
   Phase D4) keeps the walkthrough honest about what this install can
   actually do, rather than promising a feature behind a paywall. A "Try a
   Sample World" step was added ahead of the spec's three, since §20 pairs
   the walkthrough with the sample-workspace command as its natural first
   move.
2. **Each step ships a short Markdown `media` file** under
   `resources/walkthrough/` rather than an image/SVG — no visual assets
   needed, and Markdown media renders directly in the walkthrough's detail
   pane.
3. **Completion events use `onCommand:`/`onView:`** where a natural trigger
   exists (trying the sample, creating any entity type, opening the World
   view); the "Link It in a Script" step has none — there's no reliable
   single command/view event for "wrote a wikilink," so it's left as a
   purely informational step the user can mark done manually, a supported
   walkthrough pattern.
4. **The sample workspace's content is original** (a small sci-fi
   freighter-pilot setup — "Nova Reyes," "The Wayfarer," a "Jump Drive"
   glossary term), not built from the user's own ORUN material used
   elsewhere in this session's manually-created `lorefountain-demo`
   workspace. A shipped, product-bundled sample must never embed a real
   user's creative IP.
5. **`tryLoreFountain` prompts for a parent directory via
   `showOpenDialog`**, creates `<chosen>/lorefountain-sample/`, scaffolds
   it by reusing `resolveWorkspaceFolders` and `writeDefaultConfigIfAbsent`
   (both already `vscode`-free, callable against a path that isn't yet an
   open workspace folder), and opens it via `vscode.commands.executeCommand('vscode.openFolder', ...)`.
   Refuses to silently overwrite an existing same-named folder — asks
   before opening it anyway.
6. Verified live end-to-end: **Help → Open Walkthrough… → "Get Started
   with LoreFountain"** renders with the correct title, description, and
   all four steps; clicking **Try LoreFountain** opened a folder picker
   titled "Choose a location for the sample LoreFountain workspace" with a
   custom "Create Sample Workspace Here" button, created the folder, and
   opened it in a new window with `world/`, `scripts/`, `glossary/`, both
   sample entities, the glossary term, and the sample script all present —
   and, cross-validating two earlier features in the same pass, the git-
   safety banner (ADR-0011) correctly fired for the fresh ungitted folder
   and a cue sidecar (ADR-0014) was auto-generated for the sample script's
   `SFX:` cue. The walkthrough step's own "Try a Sample World" checkbox
   correctly flipped to completed after the command ran.

---

## ADR-0016 — Phase E7: structured search is scenes-by-scene-heading + reused mention-matching, entirely QuickPick-driven

**Date:** 2026-07-24 · **Status:** Accepted

Spec §13.6 asks for co-presence ("Sango and Esu in the same room") and
mention-line search exposed as their own named feature, not left implicit
inside generic full-text search. Implemented as `src/search/structuredSearch.ts`
(pure) + `src/commands/structuredSearch.ts` (vscode-facing).

1. **"Same room" = same scene, and a scene = the span between one
   `scene_heading` token and the next** (or end-of-file), reusing
   `parseFountain`/`mapTokensToPositions` from ADR-0002's groundwork — the
   first real consumer of that position-recovery layer beyond hover. A
   script with no scene headings is treated as one implicit scene rather
   than producing zero results.
2. **Both search modes reuse `index/mentions.ts`'s exact whole-word
   matcher** — `extractMentionTargets` for "who's mentioned anywhere in
   this scene's text", `findMentionOccurrences` for "which lines mention
   this specific candidate" — rather than building separate matching logic.
   This is the same primitive the live index already uses, just applied
   per-scene-span or reported per-line instead of per-file.
3. **"Cross-episode" is read as scoped to `.fountain` scripts only**, not
   `world/` entity/glossary prose — an "episode" is a script; the spec's
   own two examples ("scene", "line") are both script-native concepts with
   no obvious equivalent in a Markdown entity file.
4. **Entirely QuickPick/menu-driven with no free-text input** — mode
   selection, then entity selection(s), all via `showQuickPick` populated
   from `buildMentionCandidates` (already exported from `build.ts` for
   Phase C's hover/completion). This made it the first Phase E command
   fully verifiable in this sandbox with no typing-restriction caveat.
5. Verified live in the Extension Development Host, both modes, via the
   World view's "..." overflow: "scenes with both Esu and Sango" correctly
   found the one scene mentioning both (`1x01.fountain`'s bridge scene);
   "every line mentioning The Ark" correctly found the one line (the scene
   heading itself, `INT. THE ARK - BRIDGE - NIGHT`) with no false positives
   from other entities.

---

## ADR-0015 — Phase E6: transcript export keeps scene headings as section breaks; "dialogue only" excludes everything else

**Date:** 2026-07-24 · **Status:** Accepted

Spec §16's transcript export ("dialogue only, cues stripped") implemented as
`src/export/transcript.ts` (pure — builds entries from a token stream, then
serializes to Markdown) + `src/commands/exportTranscript.ts` (vscode-facing).

1. **"Dialogue only" is read literally**: only `character`/`dialogue`
   token pairs become content. Action lines (where the SFX:/MUSIC:/AMB:
   convention lives, Spec §15), transitions, and parentheticals (performance
   direction, never spoken) are all excluded — not just the cue lines the
   spec bullet names explicitly.
2. **Scene headings are kept as Markdown section headers**, despite not
   being "dialogue" — a deliberate exception, since §16's named audiences
   (accessibility, publishing, show notes) all benefit from knowing where
   one scene ends and the next begins, and a heading is clearly
   distinguishable from spoken content in the output (`##` vs `**NAME:**`).
3. **Target script resolution**: the active editor if it's a `.fountain`
   document, else a `QuickPick` over every script found across all open
   workspace folders (reusing `listFilesWithExtension`, exported from
   `build.ts` for E4's rename command and now reused a second time).
4. **Output goes through `vscode.window.showSaveDialog`**, not a fixed
   path — gives the writer a chance to pick where the transcript lands,
   pre-filled with `<script>.transcript.md` next to the source script as a
   sensible default.
5. **Surfaced via an `editor/title` icon** (`$(book)`) when a `.fountain`
   file is active, in addition to the Command Palette. Verified live: the
   command itself, invoked via a temporary duplicate placement in the
   World view's overflow menu (proven reliable in ADR-0013's testing),
   correctly resolved the active editor's script, opened a save dialog
   pre-filled with `1x01.transcript.md`, and produced a transcript with
   `SFX:`/`MUSIC:` lines correctly stripped and dialogue correctly
   attributed. **The `editor/title` icon's own visibility could not be
   confirmed** in this specific sandboxed dev host — its toolbar row was
   crowded with several other installed extensions' own icons (GitLens,
   Markdown Preview Enhanced, etc.), a plausible and mundane explanation
   distinct from the typing-restriction gaps noted elsewhere, but not
   something this session could fully rule out. The command is reachable
   regardless via the Command Palette (an independent registration path
   from the menu contribution), so this is a coverage gap in one discovery
   surface, not in the feature itself.

---

## ADR-0014 — Phase E5: snippets over a custom completion provider; sidecar regeneration piggybacks on existing script reads

**Date:** 2026-07-24 · **Status:** Accepted

Spec §13.9 (structured cue insertion) + §15 (cue sidecar) implemented as
`resources/fountain-cues.code-snippets` + `src/cues/parseCues.ts` (pure
extraction) + `src/cues/sidecar.ts` (fs-touching, no `vscode` dependency).

1. **Cue insertion uses VS Code's native `contributes.snippets`**, not a
   custom `CompletionItemProvider` like hover/wikilink completion (Phase C).
   The spec's own framing — "the same reasoning that makes a code snippet
   expanding a boilerplate block feel like a convenience" — points straight
   at the stock mechanism built for exactly this, including free tab-stops
   for the variable part and (for MUSIC) a native choice list
   (`${1|IN,OUT,STING,UNDER|}`) with zero custom code.
2. **Sidecar generation piggybacks on every place `build.ts` already reads
   a script's text** (the full-build loop and `reindexFile`'s script
   branch) rather than being a separate pass — the text is already in
   memory, so this is a same-cost addition, and it guarantees the sidecar
   can never observe a different version of the script than the index just
   did. Removal is wired separately into `workspaceIndex.ts`'s script
   delete-watcher, since `build.ts`'s `removeFileFromIndex` is synchronous
   and shared across all three file kinds — kept that contract unchanged
   rather than making it async for this one case.
3. **A sidecar is deleted, not written with an empty `cues` array, once a
   script has no cues left** — avoids leaving an empty, permanently-stale
   `.cues.json` next to every script that happens not to use the
   convention (plausible for non-cue-heavy scenes or early drafts).
4. **`*.cues.json` is gitignored**, consistent with the SQL index's own
   "derived, rebuildable, never authoritative" treatment (Spec §2.2) —
   regenerated automatically on the next activation/rebuild regardless.
5. Verified live in the Extension Development Host: adding `SFX:`, `MUSIC:
   <modifier> - ...`, and `AMB:` lines to the demo script produced a
   correct `1x01.cues.json` on activation (including a plain SFX
   description untouched by the modifier logic, since SFX has none per
   §15.1's table); editing the script while the window stayed open
   triggered the file watcher and regenerated the sidecar with the new cue,
   with no manual rebuild needed. **Not live-tested:** actually typing
   `sfx`/`mus`/`amb` + Tab to confirm the snippet body/choice-list expands
   as authored — same typing restriction as every other input-driven flow
   this session; snippet JSON was validated for correct syntax instead.

---

## ADR-0013 — Phase E4: rename rewrites relations + wikilinks only; plain-text mentions get an alias, not a silent edit

**Date:** 2026-07-24 · **Status:** Accepted

Spec §13.3 asks for a rename command that "rewrites known references (mentions
and typed relations)... where safely detectable," plus a broken-reference
report for what isn't. `src/refactor/renameEntity.ts` (pure) +
`src/commands/renameEntity.ts` (vscode-facing) implement this with a
deliberately narrower definition of "safely detectable" than "anything the
mention engine can find":

1. **Auto-rewritten:** the renamed entity's own file (moved + frontmatter
   `name` updated), every other entity's `relations[].target` matching the
   old id (exact id string match — metadata, unambiguous), and every
   explicit `[[wikilink]]` occurrence of the old name anywhere (world
   bodies, glossary bodies, `.fountain` scripts) — a deliberate, structural
   marker the writer chose specifically to mean "link to this entity."
2. **Never auto-rewritten:** bare plain-text mentions inside prose (a
   script's dialogue/action lines, another entity's free-text body) — found
   using the exact same whole-word matcher `mentions.ts` already uses for
   indexing (so detection isn't the limiting factor), but left untouched on
   principle: a screenplay's own prose shouldn't be silently bulk-edited by
   a rename command. This is the spec's own example of what belongs in the
   broken-reference report.
3. **The old name is kept as an alias** on the renamed entity (deduped,
   case-insensitive) specifically so those untouched plain-text mentions
   *keep resolving* — nothing goes dark the moment a name changes. The
   rename's report is reframed accordingly: it lists files still using the
   old name as "still recognized via alias, update the wording if you'd
   like" rather than "broken," since with the alias in place nothing
   actually is. This is a deliberate enhancement beyond the spec's literal
   wording, judged a strictly better outcome for the writer with no real
   downside (the alias is a normal, editable frontmatter field).
4. **The whole operation is one `vscode.WorkspaceEdit`** (rename-file +
   whole-document `replace` on every touched file), applied and then saved
   atomically — extending the exact whole-document-replace pattern
   `storyCardEditorProvider.ts` already established, to multiple files.
   The file-move is sequenced *before* the content edit (rather than
   content-then-move) specifically to avoid relying on undocumented
   behavior for whether a text edit's dirty buffer survives a same-URI
   rename within one edit — each operation now targets a URI that stays
   stable for its own step.
5. **"Show Broken References" is a separate, standalone command**, not
   just a rename side-effect — it re-exposes the dangling-relation
   detection already built for Phase B4 (`src/index/relations.ts`) as an
   on-demand report, so a writer can check for drift anytime (a relation
   target renamed/deleted outside the tool, a hand-edited file), not only
   immediately after using the rename command. Verified live in the
   Extension Development Host via the World view's "..." menu: a
   deliberately-added dangling relation (`Sango` -> `rival: orunmila`,
   `orunmila` not a real entity) is correctly reported with folder name,
   file path, relation type, and target.
6. **Not live-tested:** the rename command's `showInputBox` flow itself
   (typing a new name) and its right-click context-menu entry (right-click
   is blocked at this sandbox's tier, separate from the typing
   restriction) — same accepted gap as ADR-0009/ADR-0012's creation
   commands. Mitigated by an unusually careful manual code review (this
   command is the most structurally complex one shipped so far) plus full
   coverage of the underlying pure rewrite logic (10 unit tests covering
   wikilink rewriting, stale-mention detection, relation retargeting, and
   alias deduplication).

---

## ADR-0012 — Phase E3: notes stay disk-only (never indexed); tree lists them live; promotion never deletes the source

**Date:** 2026-07-24 · **Status:** Accepted

Spec §13.4's `/world/notes` scratch space turned out to be mostly already
built: `ENTITY_EXCLUDED_SUBDIRS` in `src/index/build.ts` (Phase B) already
excludes `notes/` from entity parsing/validation entirely — free-form
Markdown with no schema was already true before Phase E started. What Phase
E3 actually adds is the writer-facing workflow the spec implies around that
folder: `src/commands/notes.ts` ("New Note", "Promote Note to Entity") and a
new "Notes" category in `WorldTreeProvider`.

1. **The Notes category reads the folder straight off disk on every
   expand**, not from the `IndexStore` like every other category — there's
   nothing to read from the store, since notes are deliberately never
   indexed. `getChildren` is now `async` throughout to support this.
2. **"Promote Note to Entity" never deletes the original note.** Copies the
   note's raw text into the new entity's body (via `createEntity` +
   mutating `entity.body` + `writeEntity`, rather than adding a body
   parameter to `createEntity` itself) and tells the writer the note is
   unchanged. Consistent with `entities/service.ts`'s own stated
   philosophy ("no delete operation... files-as-truth means Explorer
   already covers it") and with this project's general caution around
   destructive actions — an extra orphaned note file is a trivial cleanup;
   silently losing a half-formed idea to a promotion bug is not.
3. **`titleizeSlug` added to `model/slug.ts`** (an approximate inverse of
   `slugify`) since notes have no stored display name — the tree and the
   "Promote" command's default name both need to turn a filename like
   `hidden-fourth-deck.md` back into "Hidden Fourth Deck" for display.
4. Verified live in the Extension Development Host: a note written directly
   to `world/notes/` appears under the new "Notes" category after a
   rebuild, stays out of the indexed entity/glossary/script counts, opens
   as plain Markdown (no Story Card editor), and shows the "Promote Note to
   Entity" inline action. The two `showInputBox`/`showQuickPick`-driven
   flows ("New Note"'s title prompt, "Promote"'s type/name prompts) are
   **not** live-tested, for the same reason as Phase D's creation commands
   (ADR-0009) — this sandbox's browser-automation can click but not type
   into the Extension Development Host. Same accepted gap, not a new one.

---

## ADR-0011 — Phase E2: git-safety check scope, "other backup mechanism" definition, and the "checkbox" as a button

**Date:** 2026-07-24 · **Status:** Accepted

Spec §13.7 requires a persistent warning when a workspace has no git repo and
no other backup mechanism, but leaves "other recognized backup mechanism"
and the dismissal "checkbox" unspecified. Implemented in
`src/safety/backupCheck.ts` (pure) + `src/safety/gitSafetyBanner.ts`
(vscode-facing), wired into `addIndexFor` in `extension.ts` so it runs once
per workspace folder on every activation:

1. **"Other backup mechanism" = git found anywhere at or above the folder
   (not just directly in it — a workspace folder may be a subdirectory of a
   larger repo) OR the folder path contains a recognized consumer
   cloud-sync marker** (OneDrive, Dropbox, Google Drive, iCloud Drive).
   Heuristic and not exhaustive by necessity — the spec doesn't enumerate a
   list — but low-risk (path-string/`.git`-existence checks only, no
   network calls) and documented here as the concrete definition.
2. **The dismissal "checkbox" is implemented as a second button** ("Don't
   ask again for this workspace") on the same `showWarningMessage`, not a
   literal checkbox — VS Code's non-modal notification API has no checkbox
   control. Functionally equivalent: persists a per-workspace-folder flag in
   `context.workspaceState`, keyed by folder URI so multi-root workspaces
   dismiss independently.
3. **"Initialize Git" delegates to the built-in Git extension's own
   `git.init` command** rather than shelling out to the `git` binary
   ourselves — reuses the user's existing Git integration (handles
   multi-root prompts, PATH resolution, etc.) instead of duplicating it.
4. **Scoped to folders that already have a `scripts` or `world` folder on
   disk** (per the spec's own wording), so a workspace that hasn't run
   `initializeWorkspace` yet doesn't get warned before it has anything to
   protect.
5. Verified live in the Extension Development Host: an ungitted, non-cloud
   workspace shows the banner every fresh launch; clicking "Don't ask again"
   suppresses it on a full process restart (not just for the current
   session), confirming the `workspaceState` persistence.

---

## ADR-0010 — Phase E1: hand-written TextMate grammar, shape-heuristic only, no runtime toggle

**Date:** 2026-07-24 · **Status:** Accepted

Fountain syntax highlighting (deferred from Phase C per ADR-0008) is now
shipped via a hand-written `resources/fountain.tmLanguage.json`, registered
in `package.json`'s `contributes.grammars` for the `fountain` language id.

1. **Written fresh against the public Fountain spec (fountain.io), not
   copied from Better Fountain's grammar.** Scene headings, transitions, and
   character cues are matched by *shape* (ALL CAPS, `INT./EXT.` prefixes,
   `TO:` suffixes) rather than by the full two-pass "preceded/followed by a
   blank line" Fountain rule — TextMate grammars tokenize per-line and can't
   reliably express that cross-line context. This is the same heuristic
   every other Fountain syntax highlighter (including Better Fountain) uses;
   our own `src/fountain/parse.ts` still does the real, position-accurate
   parse for hover/completion/mentions, so this file is presentation-only.
2. **The SFX:/MUSIC:/AMB: cue convention (§15.1) gets its own scope**
   (`support.function.cue-prefix.lorefountain`) distinct from plain action
   text, plus the MUSIC modifiers (IN/OUT/STING/UNDER) — a deliberate,
   product-specific touch beyond generic Fountain highlighting, since this
   convention is load-bearing for the cue sidecar (Phase E5).
3. **No runtime enable/disable setting**, unlike hover/completion
   (ADR-0003). VS Code's `contributes.grammars` is a static contribution
   with no `when` clause and no `vscode.languages.register*`-style API for
   grammars — there is no mechanism to conditionally register or unregister
   one at runtime. Ships default-on; if a user has Better Fountain installed
   too, VS Code's own extension-priority rules (undocumented, generally
   last-registered-wins) decide which grammar renders — same accepted risk
   already noted in ADR-0003 for the `fountain` language-configuration.
4. Verified visually in the Extension Development Host (not unit-testable):
   scene headings, transitions, character cues (incl. `(V.O.)` extensions),
   parentheticals, `[[notes]]`, `/* boneyard */`, centered text, lyrics,
   title-page keys, cue prefixes + modifiers, and `*italic*`/`**bold**`/
   `_underline_` emphasis all render distinctly against a throwaway test
   fixture, then removed.

---

## ADR-0009 — Phase D scope: Story Card editor is entity-only; selector matches the default `world/` layout only

**Date:** 2026-07-23 · **Status:** Accepted

**Decisions made while implementing Phase D (entity CRUD, creation commands,
the Story Card custom editor, the World TreeView):**

1. **The Story Card `CustomTextEditorProvider` is entity-only** — glossary
   terms (Spec §4.7) stay plain Markdown with no custom editor, consistent
   with their own "lightweight... just a definition" characterization.
   Building a second, lighter-weight custom editor for glossary terms was
   judged not worth the additional surface for what §4.7 already frames as a
   file simple enough to hand-edit directly. Creating a term via the tree's
   "New Glossary Term" command opens it as plain text, not a form.

2. **`customEditors` selector matches `**/world/*.md`** (direct children of a
   folder named `world` only) rather than `**/world/**/*.md`. This is
   deliberate, not an oversight: VS Code's `customEditors` contribution is
   static (evaluated before the extension activates), so it can't be scoped
   to the user's *configured* `world` folder name (ADR-0006) at runtime — this
   selector targets the *documented default* layout. The specific glob was
   chosen because a single `*` (not `**`) between `world/` and the filename
   naturally excludes `world/glossary/`, `world/timeline/`, and `world/notes/`
   (all one level deeper) without needing negative-match glob syntax, which
   `filenamePattern` doesn't support. The known gap: an entity file nested in
   a user-created subfolder under `world/` (e.g. `world/characters/sango.md`
   — which `build.ts`'s recursive walk already indexes fine) won't get the
   Story Card editor as its *default*, though "Reopen Editor With…" still
   works for any `.md` file broadly speaking once the extension is active.
   Revisit if real dogfooding shows subfolder organization is common enough
   to be worth a dynamic, per-workspace registration.

3. **The TreeView (Spec §6) omits the "Timeline" category** the spec's table
   names alongside Characters/Locations/Factions — no Event/timeline entity
   model exists yet (`world/timeline/` has been explicitly unindexed since
   Phase B). Shown once that model exists, not as an empty placeholder now.

**Verified manually in the real Extension Development Host** (click-based
checks only — text-input edits and the creation commands' name-prompt flow
are blocked by this session's click-tier sandboxing, not exercised live):
the World tree renders all 6 categories with correct icons and inline
"New X" buttons; a Character and a Location entity both opened correct,
fully-populated Story Cards with the right type-specific fields shown/hidden;
the relationship picker listed every entity across all types; editing it via
clicks (add/select-target/save) round-tripped correctly to disk, including
the exact "drop a relation row missing a relation type" rule confirmed by
unit tests; a glossary term opened as plain text, not a Story Card.

**Revisit if:** the entity-creation commands' name-prompt flow (`showInputBox`)
turns out to have an issue only visible via real typed input — this remains
the one meaningfully untested path in Phase D and should get a pass whenever
this session's tooling allows typed interaction, or via the user's own
dogfooding.

---

## ADR-0008 — Phase C scope: hover/completion broader than literal spec wording; no syntax grammar yet

**Date:** 2026-07-23 · **Status:** Accepted

**Decisions made while implementing Phase C (parse, hover, completion, backlinks):**

1. **Hover fires on any recognized mention anywhere in a `.fountain` file**
   (character cues, dialogue, action lines, scene headings, `[[wikilinks]]`) —
   not literally restricted to "character cue" as §6's table row names it.
   Mentions are already defined as automatic/lightweight/no-manual-step
   (§4.5); restricting hover to only one syntactic position would be an
   arbitrary carve-out of that same mechanism, not a meaningfully different
   feature. Implemented as one pass over the raw document text via
   `index/mentions.ts`'s `findMentionOccurrences` — no Fountain-structural
   parsing needed to find a hover target.

2. **Wikilink completion (`[[`) is registered for `{ language: 'markdown' }`
   broadly**, not narrowed to files under the configured `world/` folder
   specifically, even though §13.2 frames it as "inside scripts and inside
   world files." A dynamic per-workspace glob (since `world/` is a
   user-configurable path, ADR-0006) would need re-registration on every
   config change for marginal benefit — offering entity links from any
   Markdown note in a LoreFountain-enabled workspace is a reasonable,
   low-risk superset, not a meaningfully wrong behavior.

3. **No TextMate grammar shipped yet.** ADR-0003 committed to eventually
   shipping our own syntax highlighting (with a `lorefountain.highlighting.enabled`
   toggle, mechanism TBD). Phase C ships the `fountain` language
   registration + `language-configuration.json` (needed for hover/completion
   to target the language at all) but not the grammar itself — a
   `.fountain` file with only this extension installed shows as unstyled
   plain text. This is a real, visible gap for a user without Better
   Fountain also installed, not hidden — revisit before considering the free
   tier UI-complete.

**C1 (`src/fountain/parse.ts`) is built but not yet consumed by hover/completion** —
those work directly against raw text via `mentions.ts`, which needs no
Fountain-structural awareness to find a match. The parse module (token
stream + position recovery, verified against dual dialogue, a `(V.O.)`
extension, and boneyard-comment exclusion) exists as promised groundwork for
future structural features (outline, folding, a presence/cue index), per its
own module doc comment.

**C4 extends mentions to `.fountain` scripts** as mention *sources* (never
targets, never stored as a record) — a script contributing to an entity's
backlinks the same way an entity/glossary body does. Verified manually: a
script's own repeated mentions of an entity correctly appear once in that
entity's "Mentioned in" hover line.

**Revisit if:** dogfooding on the real ORUN corpus shows hover firing on
every scene-heading location name is noisy rather than useful, or shows
completion polluting unrelated Markdown notes — both are easy to narrow later
since the underlying candidate/matching logic doesn't change.

---

## ADR-0007 — Mentions (Spec §4.5): full rebuild is exact, incremental reindex is per-file only

**Date:** 2026-07-23 · **Status:** Accepted

**Decision.** `src/index/mentions.ts` detects automatic mentions via a single
Unicode-aware, whole-word, case-insensitive regex built from every known
entity/glossary name + alias (`src/index/build.ts`'s `buildMentionCandidates`).
A full `buildIndexFromDisk` pass always recomputes every source's outgoing
mentions against the complete, final candidate list — cross-file mentions are
exactly correct after a full rebuild. An incremental `reindexFile` (the
file-watcher path) only recomputes the *changed* file's own outgoing mentions
against whatever candidates are currently known. If that file introduces a
brand-new entity name, other files that already mention that name in plain
prose do not retroactively gain a mention edge until they are themselves
reindexed or a full rebuild runs.

**Why.** This is a deliberate v1 simplification, not an oversight. Recomputing
every other file's mentions whenever one entity is added/renamed would mean
re-reading and re-scanning the entire indexed corpus on every keystroke-driven
save — disproportionate cost for a case (an old file's plain-text mention of a
name that only later became a real entity) that's inherently rare and already
self-corrects on the next full rebuild. "Rebuild Index" is the documented,
always-correct escape valve, consistent with the index being disposable and
rebuildable by design (Spec §2.2, ADR-0001).

**Also decided:** dangling `relations` targets (Spec §4.5 — deliberate, typed
links, distinct from automatic mentions) are detected the same way — a full
pass across every entity after a full build, or immediately for a single
entity on incremental reindex — and reported via `IndexBuildSummary`/
`ReindexFileResult`, never rejected (Spec §23).

**Verified:** 99 unit tests (mentions matching edge cases, dangling-relation
detection, sql.js mentions/backlinks CRUD) plus a manual Extension Development
Host check — a real dangling relation (`target: ghost-entity`) was correctly
flagged while a valid one (`target: sango`) was not.

**Revisit if:** real dogfooding on the ORUN corpus shows the "reindex to fully
propagate" lag is actually disruptive in practice — the fix would be scoped to
`buildMentionCandidates`'s caller, not the matching algorithm itself.

---

## ADR-0006 — `lorefountain.config.json` replaces VS Code settings for project config; activation triggers on it (or a bare `.fountain` script)

**Date:** 2026-07-22 · **Status:** Accepted

**Decision.** All customizable LoreFountain options (currently just `folders`)
live in a single project-owned `lorefountain.config.json` at the workspace
root, not VS Code's `lorefountain.folders.*` settings (removed). The extension
activates on `workspaceContains:lorefountain.config.json` **or**
`workspaceContains:**/*.fountain` (the project owner, 2026-07-22, chose the OR over
config-file-only, to smooth onboarding for an existing script-only project).
A `lorefountain.initializeWorkspace` command scaffolds the standard folders and
writes a default config file for a brand-new, completely empty workspace —
necessary because activation events can't fire on a workspace with neither
signal yet, but VS Code auto-activates any extension the moment one of its
contributed commands is invoked from the Command Palette, independent of
`activationEvents`.

**Why the pivot.** The original `activationEvents` (`workspaceContains:world/**`,
`workspaceContains:scripts/**`) were a real bug, caught via manual testing in
the Extension Development Host: `scripts/` is an extremely common folder name
in totally unrelated JS/TS/Python repos (build/deploy scripts), so the
extension would have activated in countless projects that have nothing to do
with LoreFountain. A dedicated config file is a deliberate, precise signal
instead of a folder-name heuristic — and, per Spec §2.1's files-as-truth
principle, a plain project-owned JSON file is more portable and more
AI-agent-readable than editor-specific settings.json.

**Supporting pieces added:**
- `src/config/configFile.ts` — pure, tolerant read (`readLoreFountainConfig`,
  never throws on missing/malformed/invalid-schema) and
  `writeDefaultConfigIfAbsent` (never clobbers an existing file).
- `resources/lorefountain.config.schema.json` + a `contributes.jsonValidation`
  manifest entry, so editing the file in VS Code gets autocomplete/validation
  without needing an in-file `$schema` reference (which can't portably point
  at the extension's own install path from the user's workspace).

**Verified (manual, Extension Development Host, 2026-07-22):** a workspace
with only a generic `scripts/` folder + `package.json` no longer activates the
extension (confirmed absent from Running Extensions). A workspace with a
hand-authored config setting `folders.world` to `"bible"` activated and
correctly indexed the entity file found there (not under `world/`).

**Revisit if:** more config keys are added beyond `folders` — the schema/Zod
validation is already structured to extend without a breaking change
(`catchall(z.unknown())` preserves unknown keys today).

---

## ADR-0005 — Full-text search: FTS3 (via sql.js) for v1, not FTS5

**Date:** 2026-07-22 · **Status:** Accepted

**Decision.** The local index's full-text search (Spec §2.2) uses FTS3, not
FTS5, for v1 — keeping `sql.js` (ADR-0001) rather than swapping engines.

**Context.** Implementing B3 surfaced that the default `sql.js` npm package is
compiled with `ENABLE_FTS3` but not `ENABLE_FTS5` (see the correction on
ADR-0001). Two ways to get real FTS5 were evaluated:
- `sql.js-fts5` (community fork, MIT) — last published 2022, unmaintained; ruled
  out.
- [`@sqlite.org/sqlite-wasm`](https://github.com/sqlite/sqlite-wasm) — the
  official SQLite project's own WASM build, actively maintained, zero
  transitive dependencies, confirmed working (FTS5 + `DELETE ... WHERE
  unindexed_col = ?` + JSON1 all tested directly). The blocker: its Node entry
  relies on `import.meta.url` internally, which breaks once esbuild bundles it
  into our CJS `dist/extension.js` (confirmed via a standalone bundle repro —
  fails with `ERR_INVALID_ARG_VALUE` on `createRequire(import.meta.url)`). It
  would have to stay external and ship as a real `node_modules` folder inside
  the `.vsix`, loaded via a runtime dynamic `import()` — a permanent, one-off
  exception to the "everything bundled" packaging model used everywhere else.

**Why FTS3 instead.** FTS is only load-bearing for the structured search
feature (§13.6), which is Phase E — not the core loop, not the dogfood path.
The indexed corpus is small (hundreds of rows per workspace), where FTS5's
headline advantage — `bm25()` relevance ranking — matters far less than at
scale. FTS3 still supports `MATCH`, phrase, and prefix queries. The one
concrete risk considered was FTS5's `unicode61` tokenizer folding diacritics
(relevant to ORUN's Yoruba terms, e.g. matching "Orunmila" against
"Ọ̀rúnmìlà") — but that only matters inside the not-yet-built §13.6 feature,
so it's deferred to be tested against the real ORUN corpus rather than
decided on a hypothetical now.

**Revisit if:** building §13.6 against the real ORUN corpus shows FTS3 cannot
adequately match diacritic variants or another concrete search-quality gap
appears. The `IndexStore` interface (`src/index/store.ts`) exists precisely so
swapping the engine at that point doesn't touch callers.

---

## Toolchain note — `moduleResolution: "bundler"` requires explicit `types: ["node"]`

**Date:** 2026-07-22

Using a `node:`-prefixed import (e.g. `import * as path from 'node:path'`) under
`tsconfig.json`'s `moduleResolution: "bundler"` (TypeScript 6.0.3) fails with
`TS2591: Cannot find name 'node:path'` even though `@types/node` is installed —
`bundler` resolution does not auto-include `@types/node` the way legacy
`node10` resolution did. Fix: add `"types": ["node"]` to `compilerOptions`
(confirmed via an isolated repro: fails without it, passes with it, same
TypeScript/`@types/node` versions). Already applied in `tsconfig.json`.
**Revisit if:** a future TypeScript release changes `bundler` resolution's
default type inclusion.

---

## ADR-0004 — Entity schema: strict per-type discriminated union, non-blocking misplaced-field warnings

**Date:** 2026-07-22 · **Status:** Accepted

**Decision.** `entityFrontmatterSchema` (`src/model/entity.ts`) is a Zod
`discriminatedUnion` on `type`, with one variant per entity type
(`character`/`location`/`faction`/`object`/`concept`), superseding the initial
single fully-permissive schema. A known type-specific field present on the
*wrong* type (e.g. `sound_motif` — a Character field, §4.3 — set on a
`location`) is not rejected: the value still parses and round-trips via that
variant's `catchall`. Instead, `parseEntityFile`'s success branch now returns a
`warnings: EntityWarning[]` array flagging the mismatch for a future
UI/diagnostics layer, alongside the entity.

**Context.** Only 2 of the 5 entity types have bespoke fields: Character
(`sound_motif`, `casting_notes`, `appears_in`, `first_appearance`, §4.3) and
Location (`parent_location`, `mobility`, §4.4). Faction/Object/Concept are
base-only. The initial implementation used one permissive schema where every
field was optional on every type, on the reasoning that §4.2/§23 favor
forgiveness over rejection. Revisited once the project owner clarified: entity frontmatter
is populated **programmatically** (the Story Card form, the migration command)
rather than hand-typed by a person, so strictness here catches a bug in *our*
code or the migration AI's output — it does not punish freehand human input, so
the forgiveness argument for full permissiveness didn't actually apply.

**Why the hybrid instead of hard rejection.** A pure strict union (rejecting
misplaced fields outright) would still satisfy the type-safety goal, but
conflicts with §23 ("index rebuild must skip/flag... never crash") and
files-as-truth (never silently drop a field). The chosen middle path gets both:
compile-time safety for all *downstream* code (`entity.frontmatter.mobility`
does not type-check until narrowed to `type === 'location'`), while the
file-parsing layer stays tolerant and non-destructive, surfacing a reporting
signal instead of an error.

**Revisit if:** a Phase D/UI decision is made about *where* `warnings` actually
surface (Problems panel diagnostic vs. the orphan-style status-bar count from
§6.2 vs. folded into the §13.3 broken-reference report) — this ADR only
establishes that the model layer produces the signal, not its UI treatment.

---

## ADR-0003 — Self-sufficient at runtime; every BF-overlapping feature is individually disable-able

**Date:** 2026-07-22 · **Status:** Accepted

**Decision.** LoreFountain ships everything its own features require and never
depends on Better Fountain (or any other extension) at runtime. Coexistence with
BF is expected and supported; *dependence* on it is not.

- **Self-register the `fountain` language.** All our editor providers bind to
  `{ language: 'fountain' }`. That language id + `.fountain` association must be
  contributed by an extension, so LoreFountain contributes its own `languages`
  entry + `language-configuration.json` and activates on `onLanguage:fountain`.
  Without this we would silently depend on BF to register the language — with BF
  uninstalled, our hover/completion would do nothing. When both are installed,
  VS Code merges the language contribution by id without conflict (verify in the
  §11 cross-fork/coexistence pass).
- **Every BF-overlapping feature is individually toggle-able** via a
  `lorefountain.<feature>.enabled` setting (default `true`), so a user who
  prefers BF's version can disable ours per-feature and avoid duplication.

**Implementation.** Provider-based features (hover, completion, definition,
folding, document symbols, decorations, cue snippets) are registered
*conditionally* on their setting and re-evaluated on configuration change — a
clean runtime toggle.

**Caveat.** Syntax highlighting is a static TextMate grammar contribution, which
VS Code cannot unregister at runtime via a setting. We ship the grammar
(default on) with a `lorefountain.highlighting.enabled` setting and will validate
the exact "off" mechanism in Phase C (likely: detect another Fountain grammar/BF
and defer gracefully, plus honor the setting for any semantic-token layer).

**Rationale.** the project owner, 2026-07-22: assume BF coexistence is common, but never
depend on it, and let users disable any overlapping feature.

---

## ADR-0002 — Fountain parsing: depend on `fountain-js`, do not fork Better Fountain

**Date:** 2026-07-21 · **Status:** Accepted

**Decision.** Use [`fountain-js`](https://github.com/jonnygreenwald/fountain-js)
(MIT, v1.2.4) as a direct npm dependency for Fountain parsing. Do **not** fork
Better Fountain, and do **not** depend on the full `afterwriting` package.

**Context / evidence (spike A3).**
- `fountain-js`: MIT, **zero runtime dependencies**, ships TypeScript types,
  ~110 KB. A parse test confirmed it emits the full typed token stream we need:
  `scene_heading` (+ `scene_number`), `character`, `dialogue`, `parenthetical`,
  dual-dialogue markers, `action` (carries `SFX:`/`MUSIC:`/`AMB:` cue text
  intact for sidecar extraction), `note`, `transition`, `section`, `synopsis`.
- `afterwriting`: MIT but unsuitable as a dependency — pulls in jquery, d3,
  pdfkit, handlebars, lodash, even snyk. Its parser core is the separate
  `aw-parser` (MIT); its pagination is `aw-liner` (MIT).
- Better Fountain is an *editing* extension (highlighting, preview, PDF, outline).
  LoreFountain is additive — a worldbuilding layer alongside the editor, not a
  replacement (Spec §1.2). A fork would mean maintaining a large codebase that
  mostly duplicates what Better Fountain already provides free.

**Known gap.** `fountain-js` tokens carry **no source positions** (line/column).
Editor features (hover, completion, decorations) need document ranges, so the
`src/fountain/` module adds a small **line-based position scanner** alongside the
token tree. Fountain is line-oriented, so this is minimal, reliable code — not a
Better Fountain fork.

**What we defer (not lose).** afterwriting's real value is screenplay **PDF
pagination**. The industry-standard PDF export (Spec §16, free tier) is not part
of the core loop or the dogfood milestone. When we build it, revisit
`aw-parser` + `aw-liner` + `pdfkit` specifically — not the full afterwriting app.

**Revisit if:** we need afterwriting-grade PDF/BBC-format pagination fidelity, or
`fountain-js` proves insufficient for a specific parse case.

---

## ADR-0001 — Local index storage: `sql.js` (WASM) behind a replaceable interface

**Date:** 2026-07-21 · **Status:** Accepted

**Decision.** Implement the rebuildable local index (Spec §2.2) on
[`sql.js`](https://sql.js.org) (SQLite compiled to WebAssembly) for v1. Place all
index access behind a thin storage interface so the engine can be swapped without
touching callers.

**Context / evidence (spike A2).** Ran each installed fork's bundled runtime as
Node and tested `node:sqlite` + FTS5 + JSON1:

| Editor | Electron | Node | `node:sqlite` | FTS5 | JSON1 |
|---|---|---|---|---|---|
| VS Code 1.128 | 42.5.0 | 24.17.0 | stable | yes | yes |
| Cursor 3.5.38 | 39.8.1 | 22.22.1 | experimental | yes | yes |
| Antigravity | 41.0.2 | 24.14.0 | experimental | yes | yes |

`node:sqlite` is viable today but: (1) it only exists once a fork ships Node
≥22.5 (~VS Code ≥1.102), which would force an `engines.vscode` floor bump and
break older/ lagging forks — against Spec §11 and §2.3; (2) it is still flagged
*experimental* ("API may change") on 2 of 3 current forks; (3) FTS5 relies on
each fork's SQLite build (true today, not guaranteed for future forks).

`sql.js` runs identically on any host Node with no floor bump, ships a known-good
SQLite build, and needs no native binaries — directly serving the cross-fork
requirement. The index is explicitly *disposable and small* (§2.2), so sql.js's
in-memory + rebuild-from-files model is a clean fit; the manual-persistence
downside barely applies.

**Correction (2026-07-22, during B3 implementation):** this ADR originally
claimed sql.js gives "guaranteed FTS5 + JSON1." That was wrong. Empirically
testing the actual npm `sql.js` package (v1.14.1) during B3 showed its default
WASM build's `PRAGMA compile_options` includes `ENABLE_FTS3` but **not**
`ENABLE_FTS5` — `CREATE VIRTUAL TABLE ... USING fts5(...)` fails with
`no such module: fts5`. JSON1 is unaffected (SQLite's JSON functions are
built in by default since 3.38, independent of the FTS compile flag). See
ADR-0005 for the resulting decision to use FTS3 rather than swap engines.

**Revisit if:** the supported `engines.vscode` floor rises past ~1.102 across all
target forks and `node:sqlite` is stable there (native perf, real on-disk file),
or if a future multi-writer tier moves to Postgres (§2.4) — the strict-columns +
JSON pattern maps to both. The storage interface exists to make either swap cheap.
