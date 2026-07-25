/**
 * Project-level AI agent instruction scaffolding: `AGENTS.md` plus
 * `agents/world-builder.md`, `agents/script-writer.md`, `agents/initiator.md`,
 * and the bundled headless validator `agents/validate.js`, copied verbatim
 * into a workspace.
 *
 * This exists so any AI coding agent working in the project — not just the
 * one running the initial migration — knows how LoreFountain requires
 * entities and scripts to be created, without every prompt re-describing
 * the schema itself (the project owner, 2026-07-25: "this will have to be part of the
 * prompt or in a project level prompt that all AIs would consume"), and can
 * check its own output (`validate.js`) without VS Code running at all.
 *
 * Unlike `readmeFiles.ts`, these files are copied as-is, with no per-project
 * folder-name substitution: `AGENTS.md` instead instructs the AI to read
 * `lorefountain.config.json` itself and resolve `world/`/`scripts/`/`imports/`
 * to this project's real names before acting on them. That trades a slightly
 * less friendly first read for files that never go stale if the config
 * changes later — the same problem `writeDefaultConfigIfAbsent`-style
 * substitution has no answer for, since a scaffolded file is never
 * regenerated once written. `validate.js` already worked this way (it reads
 * the config live at run time); this makes the Markdown files consistent
 * with it.
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
  path.join('agents', 'validate.js'),
];

/**
 * Copy the bundled `AGENTS.md` + `agents/*` templates into a workspace root
 * verbatim. Skips any file that already exists.
 *
 * @param extensionResourcesPath - Absolute path to this extension's `resources` folder.
 * @param workspaceRoot - Absolute path to the workspace root to scaffold into.
 * @returns Relative paths of the files actually written (empty if all already existed).
 */
export async function scaffoldAgentFilesIfAbsent(
  extensionResourcesPath: string,
  workspaceRoot: string,
): Promise<string[]> {
  const written: string[] = [];

  for (const relativePath of TEMPLATE_RELATIVE_PATHS) {
    const targetPath = path.join(workspaceRoot, relativePath);
    if (await pathExists(targetPath)) continue;

    await fsp.mkdir(path.dirname(targetPath), { recursive: true });
    await fsp.copyFile(path.join(extensionResourcesPath, relativePath), targetPath);
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
