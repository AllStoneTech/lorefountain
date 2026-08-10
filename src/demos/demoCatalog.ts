/**
 * Install Demo catalog (ADR-0031): the fixed list of demo worlds
 * `lorefountain.installDemo` can offer. Demos live in the main
 * `AllStoneTech/lorefountain` repo's `demos/` folder rather than a separate
 * repo — kept in lockstep with the extension's own release cadence, at the
 * cost of the command always fetching whatever is on `main` right now.
 *
 * Deliberately a static, hand-maintained list rather than something
 * discovered at runtime (e.g. listing `demos/` via the GitHub API) — there
 * are only ever a couple of these, and a human should choose the label and
 * description shown to a new user rather than a folder name standing in for
 * one.
 */

/** The GitHub repo demos are downloaded from. */
export const DEMO_REPO = { owner: 'AllStoneTech', repo: 'lorefountain', ref: 'main' } as const;

/** One demo world offered by `lorefountain.installDemo`. */
export interface DemoCatalogEntry {
  /** Also used as the downloaded folder's name — must be a valid, unambiguous folder name. */
  id: string;
  label: string;
  description: string;
  /** Path within the repo, relative to its root (e.g. `demos/Of_One_Blood`). */
  repoPath: string;
}

export const DEMO_CATALOG: readonly DemoCatalogEntry[] = [
  {
    id: 'Of_One_Blood',
    label: 'Of One Blood',
    description: 'Literary adaptation (Pauline Hopkins, 1902) — 34 entities, 24 scripts, full canon-status tracking.',
    repoPath: 'demos/Of_One_Blood',
  },
  {
    id: 'Loomwake',
    label: 'Loomwake',
    description: 'GM-focused sci-fi TTRPG campaign — 27 entities, an unresolved central mystery, live-play hooks.',
    repoPath: 'demos/Loomwake',
  },
];
