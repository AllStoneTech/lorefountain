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

import type { ProjectType } from 'lorefountain-core/config/projectType';

/** The GitHub repo demos are downloaded from. */
export const DEMO_REPO = { owner: 'AllStoneTech', repo: 'lorefountain', ref: 'main' } as const;

/** One demo world offered by `lorefountain.installDemo`. */
export interface DemoCatalogEntry {
  /** Also used as the downloaded folder's name — must be a valid, unambiguous folder name. */
  id: string;
  label: string;
  /**
   * Who this demo is for, stated as the kind of project the user would be doing — shown first in
   * the picker so a new user can match a demo to their own work at a glance (e.g. "Writing a
   * feature screenplay").
   */
  useCase: string;
  /** The `project_type` the demo's `lorefountain.config.json` records; a test keeps the two in step. */
  projectType: ProjectType;
  /** What the demo contains and what it showcases; shown under the use case in the picker. */
  description: string;
  /** Path within the repo, relative to its root (e.g. `demos/Of_One_Blood`). */
  repoPath: string;
}

export const DEMO_CATALOG: readonly DemoCatalogEntry[] = [
  {
    id: 'Imperium_in_Imperio',
    label: 'Imperium in Imperio',
    useCase: 'Adapting a novel into a feature screenplay',
    projectType: 'screenplay',
    description:
      'Sutton E. Griggs’s 1899 novel as one feature in eight sequences — 42 entities, a 16-event timeline, and period-drama scripts in standard Fountain format.',
    repoPath: 'demos/Imperium_in_Imperio',
  },
  {
    id: 'Of_One_Blood',
    label: 'Of One Blood',
    useCase: 'Adapting a novel into a serialized series, one episode per chapter',
    projectType: 'tv_series',
    description:
      'Pauline Hopkins’s 1902 novel — 34 entities, 24 scripts, and canon-status tracking for the places the source contradicts itself.',
    repoPath: 'demos/Of_One_Blood',
  },
  {
    id: 'The_Conjure_Woman',
    label: 'The Conjure Woman',
    useCase: 'Writing an anthology TV series',
    projectType: 'tv_series',
    description:
      'Charles Chesnutt’s 1899 tales as seven self-contained, Twilight-Zone-style episodes with a recurring frame cast — 57 entities and a 23-event timeline.',
    repoPath: 'demos/The_Conjure_Woman',
  },
  {
    id: 'The_Comet',
    label: 'The Comet',
    useCase: 'Producing a science-fiction audio drama',
    projectType: 'audio_drama',
    description:
      'W. E. B. Du Bois’s 1920 post-apocalyptic story as six audio-drama parts with sound, music and ambience cues — 50 entities. Public domain in the US only.',
    repoPath: 'demos/The_Comet',
  },
  {
    id: 'The_Heroic_Slave',
    label: 'The Heroic Slave',
    useCase: 'Producing a historical audio drama',
    projectType: 'audio_drama',
    description:
      'Frederick Douglass’s 1853 novella as a six-part radio play of sea, wind and speeches — 45 entities, checked against the 1853 first printing.',
    repoPath: 'demos/The_Heroic_Slave',
  },
  {
    id: 'Winona',
    label: 'Winona',
    useCase: 'Scripting a comic book or graphic novel (Page/Panel format)',
    projectType: 'comic',
    description:
      'Pauline Hopkins’s 1902 serial as an eight-issue comics script — 160 pages, 750 panels, 40 entities — written in LoreFountain’s Page/Panel convention.',
    repoPath: 'demos/Winona',
  },
  {
    id: 'Monte_Cristo',
    label: 'The Count of Monte Cristo',
    useCase: 'Writing a literary novel or serialized prose fiction',
    projectType: 'prose',
    description:
      'The complete novel as 117 prose chapters plus a 98-entity story bible with aliases and a timeline — shows a prose manuscript in a LoreFountain project.',
    repoPath: 'demos/Monte_Cristo',
  },
  {
    id: 'Loomwake',
    label: 'Loomwake',
    useCase: 'Running a tabletop RPG campaign as the GM',
    projectType: 'tabletop',
    description:
      'A sci-fi space-opera campaign — 27 entities, player-secret relations, an unresolved central mystery, and live-play hooks.',
    repoPath: 'demos/Loomwake',
  },
];
