/**
 * Pre-existing `world`/`scripts` folder detection, used only by
 * `lorefountain.initializeWorkspace` (Spec §5). LoreFountain must never
 * silently assume ownership of a folder it didn't create — a workspace
 * pointed at an existing project may already have its own `world`/`scripts`
 * folders (or folders configured under those names) with content
 * LoreFountain didn't produce. When either already exists, the caller is
 * expected to ask the user for confirmation before writing anything.
 */

import * as fsp from 'node:fs/promises';

/** Which of the two core folders already exist on disk. */
export interface ExistingCoreFolders {
  world: boolean;
  scripts: boolean;
}

/**
 * Check whether the resolved `world`/`scripts` folders already exist.
 *
 * @param worldPath - Absolute path to the resolved `world` folder.
 * @param scriptsPath - Absolute path to the resolved `scripts` folder.
 * @returns Which of the two already exist.
 */
export async function detectExistingCoreFolders(
  worldPath: string,
  scriptsPath: string,
): Promise<ExistingCoreFolders> {
  const [world, scripts] = await Promise.all([pathExists(worldPath), pathExists(scriptsPath)]);
  return { world, scripts };
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fsp.access(target);
    return true;
  } catch {
    return false;
  }
}
