/**
 * Human-facing README scaffolding — the counterpart to `agentFiles.ts`'s
 * AI-facing `AGENTS.md`/`agents/*.md`. A root `README.md` plus one in each
 * of `world/`, `world/glossary/`, `world/notes/`, `world/timeline/`,
 * `scripts/`, `imports/`, and `assets/`, explaining what a LoreFountain
 * project is and what each folder is for to a human who doesn't already know.
 *
 * Unlike `agents/*.md` (a fixed folder regardless of config), a README's
 * *target* path depends on this workspace's actual configured folder names
 * — `world.md`'s template always lives at a fixed resource path, but is
 * written to `<configured world folder>/README.md`, which varies per
 * project. Hence the explicit per-file target-path mapping below, rather
 * than `agentFiles.ts`'s simpler "same relative path on both sides."
 *
 * Never overwrites a file that already exists, matching `agentFiles.ts`
 * and `configFile.ts`'s `writeDefaultConfigIfAbsent`.
 *
 * Each template also carries a content `version`, checked by
 * `readmeVersions.ts` against a workspace's already-scaffolded copies —
 * the README counterpart to `agentFiles.ts`'s `AGENT_FILE_VERSIONS`, folded
 * into the same "Check for LoreFountain File Updates" command.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import type { FolderNames } from './folders';

/** Bundled template name (under `resources/readmes/`), where it's written relative to the workspace root, and its current content version. */
export const README_TEMPLATES: ReadonlyArray<{
  templateName: string;
  targetRelativePath: (folders: FolderNames) => string;
  version: number;
}> = [
  { templateName: 'root.md', targetRelativePath: () => 'README.md', version: 2 },
  { templateName: 'world.md', targetRelativePath: (folders) => path.join(folders.world, 'README.md'), version: 1 },
  { templateName: 'glossary.md', targetRelativePath: (folders) => path.join(folders.world, 'glossary', 'README.md'), version: 1 },
  { templateName: 'notes.md', targetRelativePath: (folders) => path.join(folders.world, 'notes', 'README.md'), version: 1 },
  { templateName: 'timeline.md', targetRelativePath: (folders) => path.join(folders.world, 'timeline', 'README.md'), version: 1 },
  { templateName: 'scripts.md', targetRelativePath: (folders) => path.join(folders.scripts, 'README.md'), version: 2 },
  { templateName: 'imports.md', targetRelativePath: (folders) => path.join(folders.imports, 'README.md'), version: 1 },
  { templateName: 'assets.md', targetRelativePath: (folders) => path.join(folders.assets, 'README.md'), version: 1 },
];

/**
 * Render a README template's placeholders for a specific workspace — the
 * same substitution `scaffoldReadmesIfAbsent` applies at scaffold time,
 * extracted so `checkFileUpdates.ts` can render an up-to-date comparison
 * copy without duplicating this logic.
 *
 * @param template - Raw template text, as read from `resources/readmes/<name>.md`.
 * @param projectName - The workspace folder's display name.
 * @param folders - The workspace's actual configured folder names.
 * @returns The template with every `{{...}}` placeholder substituted.
 */
export function renderReadmeTemplate(template: string, projectName: string, folders: FolderNames): string {
  return template
    .replaceAll('{{PROJECT_NAME}}', projectName)
    .replaceAll('{{WORLD_FOLDER}}', folders.world)
    .replaceAll('{{SCRIPTS_FOLDER}}', folders.scripts)
    .replaceAll('{{IMPORTS_FOLDER}}', folders.imports)
    .replaceAll('{{ASSETS_FOLDER}}', folders.assets);
}

/**
 * Write the bundled README templates into a workspace, substituting this
 * workspace's actual folder names and project name. Skips any file that
 * already exists.
 *
 * @param extensionResourcesPath - Absolute path to this extension's `resources` folder.
 * @param workspaceRoot - Absolute path to the workspace root to scaffold into.
 * @param folders - The workspace's actual configured folder names.
 * @param projectName - The workspace folder's display name, for the root README's title.
 * @returns Relative paths of the files actually written (empty if all already existed).
 */
export async function scaffoldReadmesIfAbsent(
  extensionResourcesPath: string,
  workspaceRoot: string,
  folders: FolderNames,
  projectName: string,
): Promise<string[]> {
  const written: string[] = [];

  for (const { templateName, targetRelativePath } of README_TEMPLATES) {
    const relativePath = targetRelativePath(folders);
    const targetPath = path.join(workspaceRoot, relativePath);
    if (await pathExists(targetPath)) continue;

    const template = await fsp.readFile(path.join(extensionResourcesPath, 'readmes', templateName), 'utf8');
    const content = renderReadmeTemplate(template, projectName, folders);

    await fsp.mkdir(path.dirname(targetPath), { recursive: true });
    await fsp.writeFile(targetPath, content, 'utf8');
    written.push(relativePath);
  }

  return written;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fsp.access(target);
    return true;
  } catch {
    return false;
  }
}
