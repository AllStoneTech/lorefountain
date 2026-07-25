# TODO

Things that need to happen but don't yet, tracked here so they survive between sessions. Not a changelog or a decision log — see `docs/DECISIONS.md` for the rationale behind each of these.

## Before `lorefountain` goes public (blocking)

**Scrub the product spec's history out of this repo before flipping visibility to public.** The files themselves were removed from the working tree on 2026-07-26 (ADR-0024) and now live in the private `AllStoneTech/lorefountain-business` repo instead — but removing a file only stops *future* commits from containing it. This repo's past commits still have every one of these in their original blobs, retrievable via `git log`/`git show` on old revisions even after deletion. A history rewrite (`git filter-repo` or BFG Repo-Cleaner) removing these exact paths from every commit, followed by a force-push to `origin/main`, is required before this repo is ever made public — not before.

Exact paths to remove from history:
- `docs/LoreFountain_Spec.docx`
- `docs/LoreFountain_Spec.md`
- `docs/archive/LoreWeaver_Spec_v0.2.docx`
- `docs/archive/LoreWeaver_Spec_v0.3.docx`
- `docs/archive/Loreweave_Spec_v0.1.docx`

(`docs/archive/` can likely just be removed as a whole directory — nothing else was ever in it.)

This is a force-push, hard-to-reverse operation against a shared remote — confirm explicitly before running it, even though it's already been agreed to be necessary.
