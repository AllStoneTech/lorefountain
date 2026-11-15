# TODO

Things that still need to happen, tracked here so they survive between sessions. Not a changelog or a decision log — see `docs/DECISIONS.md` for the rationale behind each of these.

## Launch

The repository is public (as of 2026-10-02), recreated from the clean history so that no pre-rewrite pull-request refs remain. Install Demo World, the release-page link from "Check for LoreFountain Updates", and the README screenshots all resolve now.

**Have the Pro licensing wording reviewed.** `LICENSE` is MIT for the free tier, and `LICENSE-PRO.md` states that the compiled Pro module is proprietary. The 1.0.0 package on both stores predates that notice, so its listing still shows only MIT; the next release carries the new file. A lawyer should read `LICENSE-PRO.md` before relying on it.

## Before releasing 1.1.0

1.1.0 is dated 2026-11-13 in `CHANGELOG.md` and its code is on `main`, but it is not published yet. It carries shot maps and the upgrade experience (ADR-0038, ADR-0039), the Core split, project types and script export, and it must not be published until the items below are settled.

- **Bring ORUN to standard with Fix All.** 310 orphaned `(beat)` warnings across 16 scripts; extensions sit in parentheticals. Do this in a BlerdDimensions-repo session, not from here.
- **Live-test what unit tests only cover.** Computer-use sessions at tier "click" can't type or drag, so these were never exercised through the real UI:
  - the creation commands' name prompt (New Character, New Location and the rest);
  - Rename Entity's prompts and New Note's title prompt;
  - New Script's input flow past the first prompt;
  - drag-and-drop reordering in the Scripts view.
- **Publish** to the VS Code Marketplace and Open VSX once the above is done (`docs/PUBLISHING.md`).

## 1.1.1 or 1.2: the Core split

ADR-0042 moves the parsing code to the separate LoreFountain-Core repo. Merged into `main` on 2026-11-13.

- [x] Switch the `lorefountain-core` dependency to a pinned Core release: the prebuilt package on Core's v0.2.0 GitHub release, now v0.3.0.
- [x] Merge `feature/lorefountain-core` into `main`.
- [x] Push `main` and let CI confirm a fresh install.
- [ ] Release, as part of 1.1.0 (above). Producer-side changes ship in the same release. Core's own changelog and docs, and any follow-up to the Producer spec, are handled in those repositories.

## LoreFountain-Producer support

Agreed with the Producer spec on 2026-11-05 (`LoreFountain-Producer/docs/LOREFOUNTAIN-PRODUCER-SPEC.md`, "What the Producer needs from LoreFountain"). Parsing pieces land in LoreFountain-Core first (its `ROADMAP.md`), then here as diagnostics, quick fixes, highlighting, snippets, help and agent docs.

- [x] Shot sidecar fields for 1.1.0: parentheticals as `direction` entries, lyrics, `line` on every entry, per-shot `action`, `onScreen` and `transition`, and the `unforced-transition` note and fix (ADR-0041).
- [ ] **Required shot tags:** a warning on an untagged `SHOT:` (and on content before a scene's first `SHOT:`), with a "Tag all shots" quick fix that writes permanent IDs such as `1x03-04-02`.
- [x] **`SUPER:`, `TITLE CARD:`, `CHYRON:`** prefix lines with an optional `[tag]`: parsed in Core (written to `onScreen`), highlighted, snippets, documented. Takes effect in the extension's sidecars once it pins a Core release that includes them.
- [x] **`LOOK: CHARACTER label`** lines, checked against the character's `looks` (full build), highlighted, a snippet, and a generated `<script>.breakdown.json`.
- [ ] **Scene numbers:** lock (writes Fountain `#n#`, new scenes become `4A`), unlock and renumber, writing an old-to-new map.
- [ ] **Shot-tag renames** write an old-to-new map for the Producer.
- [ ] **Reference images:** several per character version and look, each with an optional angle label.
- [ ] **Structured pronunciation** (`{ respelling, ipa }` or a plain string) on entities and glossary terms.
- [ ] **Read Producer data, read-only and tolerantly:** "covered by an accepted Producer take" instead of "not sourced yet", per-episode production status with coverage sub-shots, and a warning when a deleted or retagged shot has accepted takes.
- [ ] **`AGENTS.md`:** say that `producer.lfp.json` and `producer/` (every Producer file is named `*.lfp.*`, Core ADR-0009) are maintained by the Producer and not hand-edited.
- [ ] **A demo project with media**, shared by both products as a test case.
- [x] **Bug:** `fountain-js` 1.2.4 throws on a `~` lyric directly under a character cue, so the whole script fails to parse. Worked around in Core (ADR-0005).

## Later

- **Shot maps phase 2:** a form-based editor for `shots.json` and hover thumbnails.
- **Shot maps phase 3:** the vidkit video pipeline.
- **Exports still to come:** an audio drama (radio script) layout, one combined file for a whole season, and checking the `.fdx` in Final Draft and the `.docx` in Word.
- **Cross-season drag-and-drop in the Scripts view.** It would mean moving the file rather than rewriting `Order`, so it was left out of ADR-0023 on purpose.
- **Entity subfolders and the Story Card editor.** The editor's selector is `**/world/*.md`, so nested entity files index correctly but don't open in the editor by default (ADR-0009).
- **Duplicate ADR numbers.** `DECISIONS.md` has two ADR-0028 entries and lists ADR-0029 after ADR-0030. Renumbering was judged risky because other documents cite these numbers, so it is left alone for now.
