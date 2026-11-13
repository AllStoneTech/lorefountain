/**
 * Story Overview scaffolding (the project owner, 2026-07-29, restructured 2026-07-30 per
 * ADR-0029; renamed to `.lf.md` by ADR-0048): a single `world/overview.lf.md` answering "what is this
 * story/world actually about" — the first thing a new collaborator or an AI
 * agent should read, distinct from `readmeFiles.ts`'s per-folder READMEs
 * (which explain what a folder is *for*, not what the story itself *is*).
 *
 * The file carries a handful of short, genuinely universal frontmatter
 * fields (`title`/`pitch`/`tone`/`genre` — see `model/storyOverview.ts`)
 * plus one freeform Markdown body. The body's section headers (Premise,
 * Setting, Synopsis, Themes, ...) are only a suggestion from the template,
 * never enforced by schema — a premise/synopsis doesn't fit a rigid field
 * database the way canon status or relations do, and different genres
 * genuinely want different sections.
 *
 * Never overwrites an existing file, same posture as every other scaffold
 * in this project (`readmeFiles.ts`, `agentFiles.ts`, `configFile.ts`'s
 * `writeDefaultConfigIfAbsent`).
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { findStoryOverviewFile, OVERVIEW_FILE_NAME } from 'lorefountain-core/project/storyOverview';

/**
 * Write the bundled Story Overview template into a workspace's `world/`
 * folder as `overview.lf.md`, substituting the project name. Skips if a Story
 * Overview already exists under either the new or the legacy name.
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
  if ((await findStoryOverviewFile(worldFolder)) !== undefined) return false;
  const targetPath = path.join(worldFolder, OVERVIEW_FILE_NAME);

  const template = await fsp.readFile(path.join(extensionResourcesPath, 'story-overview.md'), 'utf8');
  const content = template.replaceAll('{{PROJECT_NAME}}', projectName);

  await fsp.mkdir(worldFolder, { recursive: true });
  await fsp.writeFile(targetPath, content, 'utf8');
  return true;
}

/** What {@link migrateStoryOverviewName} did. */
export type OverviewMigration =
  | { status: 'none' }
  | { status: 'renamed'; from: string; to: string }
  | { status: 'conflict'; legacyPath: string; currentPath: string };

/**
 * Rename a legacy `OVERVIEW.md` to `overview.lf.md` (ADR-0048). Runs when the
 * extension starts on a project, so an updated install brings the file along
 * without the writer doing anything. Never overwrites: if both names exist it
 * reports a conflict and touches nothing. A second run is a no-op.
 *
 * @param worldFolder - Absolute path to the workspace's world folder.
 * @returns `renamed` with both paths, `conflict` when both files exist, otherwise `none`.
 * @throws Re-throws a filesystem error from the rename itself (for example a read-only folder).
 */
export async function migrateStoryOverviewName(worldFolder: string): Promise<OverviewMigration> {
  const found = await findStoryOverviewFile(worldFolder);
  if (found === undefined || !found.legacy) {
    const names = await fsp.readdir(worldFolder).catch(() => [] as string[]);
    const legacy = names.find((name) => name.toLowerCase() === 'overview.md');
    return found !== undefined && legacy !== undefined
      ? { status: 'conflict', legacyPath: path.join(worldFolder, legacy), currentPath: found.filePath }
      : { status: 'none' };
  }
  const to = path.join(worldFolder, OVERVIEW_FILE_NAME);
  await fsp.rename(found.filePath, to);
  return { status: 'renamed', from: found.filePath, to };
}
