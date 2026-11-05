/**
 * Shot asset manifest: resolves a tagged `SHOT:` line (see
 * `shots/parseShots.ts`'s `[tag]` syntax) to the still or clip that fills
 * it, the visual counterpart of `audioManifest.ts`. A recurring shot (an
 * ident, a bumper) reuses one tag, and so one file, across every episode.
 *
 * Lives at `assets/manifests/shots.json`: one project-wide file, not one per
 * episode. Hand-authored and read-only from LoreFountain's side, never
 * generated or overwritten. Reading is tolerant, like every manifest
 * (`manifestFile.ts`): a missing file is fine, and malformed JSON or a schema
 * violation is reported, never thrown. LoreFountain records and validates;
 * it never renders, moves or measures an asset, and doesn't check that the
 * file exists on disk (matching `audio.json`).
 *
 * Exports the zod schema and types, the reader, and three checks:
 * `unmapped-shot-tag` (warning, per script), `shot-kind-mismatch` (warning)
 * and `unused-shot-tag` (info, a note).
 */

import * as path from 'node:path';
import { z } from 'zod';
import type { ValidationIssue } from '../model/errors';
import type { ShotMapEntry } from '../shots/shotMap';
import { readManifestFile, type ReadManifestFileResult } from './manifestFile';

/** Recommended `motion` values. Documentation only: `motion` stays freeform, because camera-move vocabulary doesn't reduce to a clean enum. */
export const RECOMMENDED_SHOT_MOTIONS: readonly string[] = [
  'ken-burns-in',
  'ken-burns-out',
  'pan-left',
  'pan-right',
  'drift',
  'parallax',
  'none',
];

/** One shot manifest entry: the file that fills a tagged shot, plus optional direction and provenance. */
export const shotManifestEntrySchema = z.object({
  /** Path relative to the `assets` folder. */
  file: z.string(),
  /** Whether a pipeline should move a still or cut a clip. */
  kind: z.enum(['still', 'clip']),
  /** How to move a still (freeform; see {@link RECOMMENDED_SHOT_MOTIONS}). Ignored for clips. */
  motion: z.string().optional(),
  /** What made it: model, tool or vendor. */
  source: z.string().optional(),
  license: z.string().optional(),
  /** The generation prompt, kept for provenance and regeneration. */
  prompt: z.string().optional(),
});

/** The manifest's on-disk shape: shot tag -> asset entry. */
export const shotManifestSchema = z.record(z.string(), shotManifestEntrySchema);

export type ShotManifestEntry = z.infer<typeof shotManifestEntrySchema>;
export type ShotManifest = z.infer<typeof shotManifestSchema>;

/** Path segments (relative to the resolved `assets` folder) to the shot manifest. */
const SHOT_MANIFEST_RELATIVE_PATH = ['manifests', 'shots.json'];

/** Project-relative label for messages. */
export const SHOT_MANIFEST_LABEL = 'assets/manifests/shots.json';

/** Outcome of {@link readShotManifest}. */
export type ReadShotManifestResult = ReadManifestFileResult<ShotManifest>;

/**
 * Read and validate `assets/manifests/shots.json`. A missing file is reported
 * as `{ ok: true, found: false, manifest: {} }`; a malformed or schema-invalid
 * file (`invalid-shot-manifest`) as `{ ok: false, ... }`, never thrown.
 *
 * @param assetsRoot - Absolute path to the resolved `assets` folder.
 * @returns The parsed manifest (or empty), or a described non-throwing failure.
 */
export async function readShotManifest(assetsRoot: string): Promise<ReadShotManifestResult> {
  return readManifestFile(assetsRoot, SHOT_MANIFEST_RELATIVE_PATH, shotManifestSchema, {});
}

/** A non-blocking warning about a tagged shot with no matching shot manifest entry. */
export interface ShotTagWarning extends ValidationIssue {
  code: 'unmapped-shot-tag';
}

/**
 * Find every tagged shot with no entry in `manifest`. A shot can be written
 * before its image exists, so this is a warning, never an error. Untagged
 * shots are never checked, and matching is exact on the tag.
 *
 * @param shots - One script's shots (from its shot map).
 * @param manifest - The project's parsed shot manifest (possibly empty).
 * @returns One warning per unmapped tagged shot occurrence, in shot order.
 */
export function findUnmappedShotTags(shots: readonly ShotMapEntry[], manifest: ShotManifest): ShotTagWarning[] {
  const warnings: ShotTagWarning[] = [];
  for (const shot of shots) {
    if (shot.tag === undefined || Object.hasOwn(manifest, shot.tag)) continue;
    warnings.push({
      code: 'unmapped-shot-tag',
      path: `lines[${shot.lines.start}]`,
      message: `SHOT: [${shot.tag}] (scene ${shot.scene}, shot ${shot.shot}, line ${shot.lines.start + 1}) has no matching entry in ${SHOT_MANIFEST_LABEL} — the asset doesn't exist yet, or the tag doesn't match.`,
    });
  }
  return warnings;
}

/** File extensions that identify a still or a clip. Any other extension is never flagged. */
export const SHOT_FILE_EXTENSIONS: Readonly<Record<ShotManifestEntry['kind'], readonly string[]>> = {
  still: ['png', 'jpg', 'jpeg', 'webp'],
  clip: ['mp4', 'mov', 'webm', 'm4v'],
};

/** A project-level issue in the shot manifest itself. */
export interface ShotManifestIssue extends ValidationIssue {
  code: 'shot-kind-mismatch' | 'unused-shot-tag';
  /** `warning` for a kind mismatch; `info` (a note) for an unused entry. */
  severity: 'warning' | 'info';
  /** The manifest key the issue is about. */
  key: string;
}

/**
 * Check the shot manifest against itself and against the tags scripts use:
 * - `shot-kind-mismatch` (warning): `kind` contradicts a recognized file
 *   extension, e.g. `still` pointing at an `.mp4`. Unrecognized extensions
 *   (including `.gif`, which can be either) are never flagged.
 * - `unused-shot-tag` (info): an entry whose tag no script uses. Shots get
 *   cut in editing, so stale entries are likely; it's a note, not a warning.
 *
 * @param manifest - The project's parsed shot manifest.
 * @param usedTags - Every shot tag used by any script in the project.
 * @returns Issues in manifest key order.
 */
export function findShotManifestIssues(manifest: ShotManifest, usedTags: ReadonlySet<string>): ShotManifestIssue[] {
  const issues: ShotManifestIssue[] = [];
  for (const [key, entry] of Object.entries(manifest)) {
    const extension = path.extname(entry.file).slice(1).toLowerCase();
    const otherKind = entry.kind === 'still' ? 'clip' : 'still';
    if (SHOT_FILE_EXTENSIONS[otherKind].includes(extension)) {
      issues.push({
        code: 'shot-kind-mismatch',
        severity: 'warning',
        key,
        path: key,
        message: `${SHOT_MANIFEST_LABEL} — "${key}" is a ${entry.kind}, but its file "${entry.file}" looks like a ${otherKind}.`,
      });
    }
    if (!usedTags.has(key)) {
      issues.push({
        code: 'unused-shot-tag',
        severity: 'info',
        key,
        path: key,
        message: `${SHOT_MANIFEST_LABEL} — "${key}" isn't used by any SHOT: line in the project's scripts.`,
      });
    }
  }
  return issues;
}
