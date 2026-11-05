/**
 * Shot sidecar file generation: `<script>.shots.json`, written next to each
 * script that has at least one explicit `SHOT:` line, mirroring the cue
 * sidecar (`cues/sidecar.ts`). Regenerated from the script on every save and
 * every reindex, never hand-edited, safe to delete, and removed when the
 * script no longer has any shots: derived data, like the SQL index.
 *
 * Exports the sidecar's path helper, writer, remover and relocator, plus its
 * on-disk shape. No `vscode` dependency, just `fs`, so it's callable
 * directly from `index/build.ts`.
 *
 * The content comes from `shotMap.ts`. Entity resolution (mentions,
 * speakers, heading locations) uses whatever entities the caller passes,
 * so after an entity is added or renamed, a script's sidecar catches up the
 * next time that script is saved or the index is rebuilt.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { buildShotMap, type ShotMapEntity, type ShotMapEntry, type ShotMapResult } from './shotMap';

const SCHEMA_VERSION = 1;

/** The shot sidecar's on-disk JSON shape. */
export interface ShotSidecar {
  schema_version: number;
  /** The generating `.fountain` file's name, relative. */
  script: string;
  /** A warning against hand-editing, embedded in the data (JSON has no comments). */
  generated_by: string;
  shots: ShotMapEntry[];
}

/** Derive a script's shot sidecar path: same directory, `.fountain` swapped for `.shots.json`. */
export function shotSidecarPathFor(scriptPath: string): string {
  return scriptPath.replace(/\.fountain$/, '.shots.json');
}

/**
 * (Re)generate a script's shot sidecar from its current text. If the script
 * has no explicit `SHOT:` line, any existing sidecar is removed instead.
 *
 * @param scriptPath - Absolute path to the `.fountain` script.
 * @param scriptText - The script's current, already-read text.
 * @param entities - Every known entity, for mention/speaker/location resolution.
 * @returns The full shot map (shots and per-script issues), so the caller can
 *   reuse it for validation instead of re-parsing.
 * @throws Re-throws filesystem errors other than a missing sidecar on removal.
 */
export async function updateShotSidecar(
  scriptPath: string,
  scriptText: string,
  entities: readonly ShotMapEntity[],
): Promise<ShotMapResult> {
  const result = buildShotMap(scriptText, entities);

  if (!result.hasExplicitShots) {
    await removeShotSidecar(scriptPath);
    return result;
  }

  const sidecar: ShotSidecar = {
    schema_version: SCHEMA_VERSION,
    script: path.basename(scriptPath),
    generated_by: 'LoreFountain — auto-generated from the script; do not edit by hand, it will be overwritten',
    shots: result.shots,
  };
  await fsp.writeFile(shotSidecarPathFor(scriptPath), `${JSON.stringify(sidecar, null, 2)}\n`, 'utf8');
  return result;
}

/**
 * Remove a script's shot sidecar, if one exists. Safe to call when absent.
 *
 * @param scriptPath - Absolute path to the `.fountain` script.
 * @throws Re-throws filesystem errors other than the sidecar not existing.
 */
export async function removeShotSidecar(scriptPath: string): Promise<void> {
  try {
    await fsp.unlink(shotSidecarPathFor(scriptPath));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}

/**
 * Move a script's shot sidecar to match a renamed/moved script file, so the
 * old sidecar isn't left orphaned. Safe to call when there's no sidecar.
 *
 * @param oldScriptPath - The script's absolute path before the rename/move.
 * @param newScriptPath - The script's absolute path after the rename/move.
 * @throws Re-throws filesystem errors other than the sidecar not existing.
 */
export async function relocateShotSidecar(oldScriptPath: string, newScriptPath: string): Promise<void> {
  const oldSidecarPath = shotSidecarPathFor(oldScriptPath);
  const newSidecarPath = shotSidecarPathFor(newScriptPath);
  if (oldSidecarPath === newSidecarPath) return;

  try {
    await fsp.rename(oldSidecarPath, newSidecarPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}
