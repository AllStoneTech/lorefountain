/**
 * Project-level AI agent instruction scaffolding: `AGENTS.md` plus
 * `agents/world-builder.md`, `agents/script-writer.md`, and
 * `agents/initiator.md`, bundled with the extension and written into a
 * workspace with this project's actual folder names substituted in.
 *
 * This exists so any AI coding agent working in the project — not just the
 * one running the one-time migration — knows how LoreFountain requires
 * entities and scripts to be created, without every prompt re-describing
 * the schema itself (the project owner, 2026-07-25: "this will have to be part of the
 * prompt or in a project level prompt that all AIs would consume").
 *
 * Never overwrites a file that already exists: a writer's own edits (or an
 * unrelated `AGENTS.md` from some other tool's convention) are never
 * clobbered, matching `configFile.ts`'s `writeDefaultConfigIfAbsent`.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';

/** Relative paths of every bundled template, identical between `resources/` and the scaffolded workspace. */
const TEMPLATE_RELATIVE_PATHS: readonly string[] = [
  'AGENTS.md',
  path.join('agents', 'world-builder.md'),
  path.join('agents', 'script-writer.md'),
  path.join('agents', 'initiator.md'),
];

/** This workspace's actual folder names (relative to the workspace root, e.g. `"world"`), substituted into the templates. */
export interface AgentFolderNames {
  world: string;
  scripts: string;
  imports: string;
}

/**
 * Write the bundled `AGENTS.md` + `agents/*.md` templates into a workspace
 * root, substituting placeholders for this workspace's actual folder
 * names. Skips any file that already exists.
 *
 * @param extensionResourcesPath - Absolute path to this extension's `resources` folder.
 * @param workspaceRoot - Absolute path to the workspace root to scaffold into.
 * @param folders - The workspace's actual configured folder names.
 * @returns Relative paths of the files actually written (empty if all already existed).
 */
export async function scaffoldAgentFilesIfAbsent(
  extensionResourcesPath: string,
  workspaceRoot: string,
  folders: AgentFolderNames,
): Promise<string[]> {
  const written: string[] = [];

  for (const relativePath of TEMPLATE_RELATIVE_PATHS) {
    const targetPath = path.join(workspaceRoot, relativePath);
    if (await pathExists(targetPath)) continue;

    const template = await fsp.readFile(path.join(extensionResourcesPath, relativePath), 'utf8');
    const content = template
      .replaceAll('{{WORLD_FOLDER}}', folders.world)
      .replaceAll('{{SCRIPTS_FOLDER}}', folders.scripts)
      .replaceAll('{{IMPORTS_FOLDER}}', folders.imports);

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
