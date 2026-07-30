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

## Before `lorefountain` goes public, or ships to any real customer (blocking)

**Replace the stubbed `validateLicense()` with a real check.** `src/licensing/validateLicense.ts` currently always resolves `{ valid: true }` regardless of the key given — added 2026-07-28 specifically so the rest of the client-side license flow (`src/licensing/licenseState.ts`'s caching/grace-period logic, the `enterLicenseKey`/`showLicenseStatus`/`clearLicenseKey` commands, gating the pro module load in `extension.ts`) could be built and tested locally while the real backend is being built separately (see `lorefountain-business/licensing/IMPLEMENTATION_PLAN.md`, being implemented against the AllStoneTech.com project).

Right now, anyone who runs "Enter License Key" with literally any text unlocks the full paid tier — this is fine for local development, not fine for anything ships-to-a-customer. Swap `validateLicense`'s body for a real `fetch` call to the AllStoneTech.com endpoint once it exists; per that function's own doc comment, nothing else in `licenseState.ts` should need to change, since it's already written against that endpoint's documented contract.
