/**
 * Story Overview scaffolding (the project owner, 2026-07-29): a single, freeform
 * `world/OVERVIEW.md` answering "what is this story/world actually about" —
 * the first thing a new collaborator or an AI agent should read, distinct
 * from `readmeFiles.ts`'s per-folder READMEs (which explain what a folder
 * is *for*, not what the story itself *is*).
 *
 * Deliberately no schema or validation — a premise/synopsis doesn't fit a
 * database of fields the way canon status or relations do; this is prose
 * with suggested section headers, meant to be edited freely and kept
 * current, not generated once and left stale.
 *
 * Never overwrites an existing file, same posture as every other scaffold
 * in this project (`readmeFiles.ts`, `agentFiles.ts`, `configFile.ts`'s
 * `writeDefaultConfigIfAbsent`).
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Write the bundled Story Overview template into a workspace's `world/`
 * folder as `OVERVIEW.md`, substituting the project name. Skips if the file
 * already exists.
 *
 * @param extensionResourcesPath - Absolute path to this extension's `resources` folder.
 * @param worldFolder - Absolute path to the workspace's `world` folder.
 * @param projectName - The workspace folder's display name, for the template's title.
 * @returns Whether the file was actually written (`false` if it already existed).
 */
export async function scaffoldStoryOverviewIfAbsent(
  extensionResourcesPath: string,
  worldFolder: string,
  projectName: string,
): Promise<boolean> {
  const targetPath = path.join(worldFolder, 'OVERVIEW.md');
  if (await pathExists(targetPath)) return false;

  const template = await fsp.readFile(path.join(extensionResourcesPath, 'story-overview.md'), 'utf8');
  const content = template.replaceAll('{{PROJECT_NAME}}', projectName);

  await fsp.mkdir(worldFolder, { recursive: true });
  await fsp.writeFile(targetPath, content, 'utf8');
  return true;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fsp.access(target);
    return true;
  } catch {
    return false;
  }
}
