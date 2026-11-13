/**
 * Page sidecar file generation: `<script>.pages.json`, written next to each
 * comic script that has at least one explicit `PAGE:` line, mirroring the
 * shot and cue sidecars (`shots/sidecar.ts`, `cues/sidecar.ts`). Regenerated
 * from the script on every save and every reindex, never hand-edited, safe to
 * delete, and removed when the script no longer has any pages: derived data.
 *
 * Exports the sidecar's path helper (re-exported from Core), writer, remover
 * and relocator. No `vscode` dependency, just `fs`, so it's callable directly
 * from `index/build.ts`.
 *
 * The content and schema come from LoreFountain-Core (`comics/pageMap`,
 * `comics/pageSidecar`, ADR-0001 there); Core only builds the object, this
 * file writes it (ADR-0042). Entity resolution uses whatever entities the
 * caller passes, so after an entity is added or renamed, a script's sidecar
 * catches up the next time that script is saved or the index is rebuilt.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import type { ResolvedComicSettings } from 'lorefountain-core/comics/limits';
import { buildPageMap, type PageMapResult } from 'lorefountain-core/comics/pageMap';
import { buildPageSidecar, pageSidecarPathFor } from 'lorefountain-core/comics/pageSidecar';
import type { ShotMapEntity } from '../shots/shotMap';
import { panelTagPrefixFor } from './tagPrefix';

export { pageSidecarPathFor };

/**
 * (Re)generate a script's page sidecar from its current text. If the script
 * has no explicit `PAGE:` line, any existing sidecar is removed instead.
 *
 * @param scriptPath - Absolute path to the `.fountain` script.
 * @param scriptText - The script's current, already-read text.
 * @param entities - Every known entity, for mention/speaker resolution.
 * @param comic - The project's resolved comic settings (`preset` and `limits` for the word-budget notes, `panelsAsShots` for the panel-tag and missing-description notes). Omitted: the built-in `western` preset, panels not shots.
 * @returns The full page map (pages and per-script issues), so the caller can
 *   reuse it for validation instead of re-parsing.
 * @throws Re-throws filesystem errors other than a missing sidecar on removal.
 */
export async function updatePageSidecar(
  scriptPath: string,
  scriptText: string,
  entities: readonly ShotMapEntity[],
  comic?: ResolvedComicSettings,
): Promise<PageMapResult> {
  const result = buildPageMap(
    scriptText,
    entities,
    {
      ...(comic ? { preset: comic.preset, limits: comic.limits, overriddenLimits: comic.overriddenLimits } : {}),
      // Default panel tags are checked for repeats against the same prefix the derived shot map uses.
      tagPrefix: panelTagPrefixFor(scriptPath, scriptText),
      panelsAsShots: comic?.panelsAsShots === true,
    },
  );

  if (!result.hasPages) {
    await removePageSidecar(scriptPath);
    return result;
  }

  const sidecar = buildPageSidecar(path.basename(scriptPath), result);
  await fsp.writeFile(pageSidecarPathFor(scriptPath), `${JSON.stringify(sidecar, null, 2)}\n`, 'utf8');
  return result;
}

/**
 * Remove a script's page sidecar, if one exists. Safe to call when absent.
 *
 * @param scriptPath - Absolute path to the `.fountain` script.
 * @throws Re-throws filesystem errors other than the sidecar not existing.
 */
export async function removePageSidecar(scriptPath: string): Promise<void> {
  try {
    await fsp.unlink(pageSidecarPathFor(scriptPath));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}

/**
 * Move a script's page sidecar to match a renamed/moved script file, so the
 * old sidecar isn't left orphaned. Safe to call when there's no sidecar.
 *
 * @param oldScriptPath - The script's absolute path before the rename/move.
 * @param newScriptPath - The script's absolute path after the rename/move.
 * @throws Re-throws filesystem errors other than the sidecar not existing.
 */
export async function relocatePageSidecar(oldScriptPath: string, newScriptPath: string): Promise<void> {
  const oldSidecarPath = pageSidecarPathFor(oldScriptPath);
  const newSidecarPath = pageSidecarPathFor(newScriptPath);
  if (oldSidecarPath === newSidecarPath) return;

  try {
    await fsp.rename(oldSidecarPath, newSidecarPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}
