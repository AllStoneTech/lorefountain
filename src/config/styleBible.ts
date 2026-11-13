/**
 * Style bible scaffolding (ADR-0045): the optional `world/style.lf.md`, one
 * per-project file for visual and tonal style that comics, video and
 * illustrated books can all use. Its schema and parser live in
 * LoreFountain-Core (`model/styleBible`, ADR-0002 there); this file only
 * writes the starting template, the way `storyOverview.ts` does for
 * `OVERVIEW.md`.
 *
 * Unlike the Story Overview, it is not written by `Initialize Workspace`: the
 * file is optional, so a project that never makes a comic or illustrated
 * video isn't handed an empty one. `lorefountain.openStyleBible` creates it on
 * demand. Never overwrites an existing file.
 *
 * The template's frontmatter is entirely commented-out examples, so a freshly
 * created file is valid and says nothing until the writer fills it in.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { STYLE_BIBLE_FILE_NAME as CORE_STYLE_BIBLE_FILE_NAME } from 'lorefountain-core/model/styleBible';
import { findStyleBibleFile } from 'lorefountain-core/project/styleBible';

/** The bundled template's file name under `resources/`. */
export const STYLE_BIBLE_TEMPLATE_NAME = 'style.lf.md';

/** The style bible's file name inside the world folder. */
export const STYLE_BIBLE_FILE_NAME = CORE_STYLE_BIBLE_FILE_NAME;

/**
 * Write the bundled style bible template into a workspace's `world/` folder as
 * `style.lf.md`, substituting the project name. Skips if a style bible already
 * exists in any letter case.
 *
 * @param extensionResourcesPath - Absolute path to this extension's `resources` folder.
 * @param worldFolder - Absolute path to the workspace's `world` folder.
 * @param projectName - The workspace folder's display name, for the template's heading.
 * @returns The path of the file, and whether it was actually written (`false` if it already existed).
 */
export async function scaffoldStyleBibleIfAbsent(
  extensionResourcesPath: string,
  worldFolder: string,
  projectName: string,
): Promise<{ filePath: string; created: boolean }> {
  const existing = await findStyleBibleFile(worldFolder);
  if (existing !== undefined) return { filePath: existing, created: false };

  const template = await fsp.readFile(path.join(extensionResourcesPath, STYLE_BIBLE_TEMPLATE_NAME), 'utf8');
  const content = template.replaceAll('{{PROJECT_NAME}}', projectName);

  const filePath = path.join(worldFolder, STYLE_BIBLE_FILE_NAME);
  await fsp.mkdir(worldFolder, { recursive: true });
  await fsp.writeFile(filePath, content, 'utf8');
  return { filePath, created: true };
}
