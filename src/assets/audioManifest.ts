/**
 * Audio asset manifest: resolves a tagged `SFX:`/`MUSIC:`/`AMB:` cue (see
 * `cues/parseCues.ts`'s `[tag]` syntax) to the actual licensed/generated
 * audio file that fulfills it, so a recurring sound design choice — a
 * specific effect, a specific music cue — is reused every time the cue
 * recurs across a season's scripts rather than re-picked or regenerated.
 *
 * Lives at `assets/manifests/audio.json`. Unlike `.cues.json` sidecars, this
 * file is hand-authored by the production and read-only from LoreFountain's
 * side — never generated or overwritten. Reading is tolerant, matching
 * `config/configFile.ts`'s posture: a missing file is not a problem (a cue
 * can legitimately be tagged before its asset is sourced), and malformed
 * JSON or a schema violation is reported, never thrown.
 */

import { z } from 'zod';
import type { CueEntry } from '../cues/parseCues';
import type { ValidationIssue } from '../model/errors';
import { readManifestFile, type ReadManifestFileResult } from './manifestFile';

/** One asset manifest entry: the file that fulfills a tagged cue, plus optional provenance. */
export const audioManifestEntrySchema = z.object({
  file: z.string(),
  source: z.string().optional(),
  license: z.string().optional(),
});

/** The manifest's on-disk shape: cue tag -> resolved asset entry. */
export const audioManifestSchema = z.record(z.string(), audioManifestEntrySchema);

export type AudioManifestEntry = z.infer<typeof audioManifestEntrySchema>;
export type AudioManifest = z.infer<typeof audioManifestSchema>;

/** Path segments (relative to the resolved `assets` folder) to the audio manifest. */
const AUDIO_MANIFEST_RELATIVE_PATH = ['manifests', 'audio.json'];

/** Outcome of {@link readAudioManifest}. */
export type ReadAudioManifestResult = ReadManifestFileResult<AudioManifest>;

/**
 * Read and validate `assets/manifests/audio.json`.
 *
 * A missing file is not an error: it's reported as `{ ok: true, found: false,
 * manifest: {} }` so callers treat every tagged cue as simply not yet mapped,
 * the same warning it would get if the file existed but omitted that tag.
 *
 * @param assetsRoot - Absolute path to the resolved `assets` folder.
 * @returns The parsed manifest (or empty), or a described non-throwing failure.
 */
export async function readAudioManifest(assetsRoot: string): Promise<ReadAudioManifestResult> {
  return readManifestFile(assetsRoot, AUDIO_MANIFEST_RELATIVE_PATH, audioManifestSchema, {});
}

/** A non-blocking warning about a tagged cue with no matching audio manifest entry. */
export interface CueManifestWarning extends ValidationIssue {
  code: 'unmapped-cue-tag';
}

/**
 * Find every tagged cue in `cues` with no corresponding entry in `manifest` —
 * the warning-level counterpart to `index/build.ts`'s duplicate-Order check
 * (see that module's doc comment): a cue can legitimately exist before its
 * asset is sourced, so this never blocks a build, only flags it. Untagged
 * cues are never checked — there's nothing yet to look up.
 *
 * @param cues - Cues extracted from one script (via `updateCueSidecar`/`extractCues`).
 * @param manifest - The project's parsed audio manifest (possibly empty).
 * @returns One warning per unmapped tagged cue, in the cues' original order.
 */
export function findUnmappedCueTags(cues: readonly CueEntry[], manifest: AudioManifest): CueManifestWarning[] {
  const warnings: CueManifestWarning[] = [];
  for (const cue of cues) {
    if (cue.tag === undefined || cue.tag in manifest) continue;
    warnings.push({
      code: 'unmapped-cue-tag',
      path: `cues[${cue.line}]`,
      message: `${cue.type.toUpperCase()}: [${cue.tag}] (line ${cue.line + 1}) has no matching entry in assets/manifests/audio.json — the asset hasn't been sourced yet, or the tag doesn't match.`,
    });
  }
  return warnings;
}
