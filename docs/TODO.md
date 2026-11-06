# TODO

Things that still need to happen, tracked here so they survive between sessions. Not a changelog or a decision log — see `docs/DECISIONS.md` for the rationale behind each of these.

## Launch

The repository is public (as of 2026-10-02), recreated from the clean history so that no pre-rewrite pull-request refs remain. Install Demo World, the release-page link from "Check for LoreFountain Updates", and the README screenshots all resolve now.

**Have the Pro licensing wording reviewed.** `LICENSE` is MIT for the free tier, and `LICENSE-PRO.md` states that the compiled Pro module is proprietary. The 1.0.0 package on both stores predates that notice, so its listing still shows only MIT; the next release carries the new file. A lawyer should read `LICENSE-PRO.md` before relying on it.

## Before releasing 1.1.0

1.1.0 is marked Unreleased in `CHANGELOG.md`. Its code is already on `main` (shot-maps was merged). It carries shot maps and the upgrade experience (ADR-0038, ADR-0039), and it must not ship until the items below are settled.

- **Bring ORUN to standard with Fix All.** 310 orphaned `(beat)` warnings across 16 scripts; extensions sit in parentheticals. Do this in a BlerdDimensions-repo session, not from here.
- **Live-test what unit tests only cover.** Computer-use sessions at tier "click" can't type or drag, so these were never exercised through the real UI:
  - the creation commands' name prompt (New Character, New Location and the rest);
  - Rename Entity's prompts and New Note's title prompt;
  - New Script's input flow past the first prompt;
  - drag-and-drop reordering in the Scripts view.
- **Publish** to the VS Code Marketplace and Open VSX once the above is done (`docs/PUBLISHING.md`).

## 1.1.1 or 1.2: the Core split

ADR-0042 moves the parsing code to the separate LoreFountain-Core repo. It sits on the local branch `feature/lorefountain-core`, which is not pushed and is not part of 1.1.0.

- Switch the `lorefountain-core` dependency from the local `file:../LoreFountain-Core` link to a pinned Core release, likely a prebuilt `npm pack` tarball attached to each Core GitHub release (`github:` dependencies fail on npm 11.12), so CI can install it.
- Push the branch, merge it, and release.
- Producer-side changes ship in the same release. Core's own changelog and docs, and any follow-up to the Producer spec, are handled in those repositories.

## Later

- **Shot maps phase 2:** a form-based editor for `shots.json` and hover thumbnails.
- **Shot maps phase 3:** the vidkit video pipeline.
- **PDF export** (free tier, spec §16). Deferred in ADR-0002 because it needs the heavier `aw-parser`/`pdfkit` dependencies, and confirmed as "later" on 2026-07-24. The free tier is feature-complete without it.
- **Cross-season drag-and-drop in the Scripts view.** It would mean moving the file rather than rewriting `Order`, so it was left out of ADR-0023 on purpose.
- **Entity subfolders and the Story Card editor.** The editor's selector is `**/world/*.md`, so nested entity files index correctly but don't open in the editor by default (ADR-0009).
- **Duplicate ADR numbers.** `DECISIONS.md` has two ADR-0028 entries and lists ADR-0029 after ADR-0030. Renumbering was judged risky because other documents cite these numbers, so it is left alone for now.
