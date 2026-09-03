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
 *
 * Because these files are never touched again once scaffolded, they can
 * silently drift from the current templates as LoreFountain evolves — see
 * `agentFileVersions.ts` for the version-marker mechanism that detects this
 * and the `lorefountain.checkFileUpdates` command ("Check for LoreFountain
 * File Updates") that lets a writer review and apply updates per file, this
 * category and READMEs both. `AGENT_FILE_VERSIONS` below is the
 * single source of truth for both which files get scaffolded and their
 * current content version.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Relative paths of every bundled template (identical between `resources/`
 * and the scaffolded workspace), each mapped to its current content
 * version. Bump only the specific file's number when that file's guidance
 * changes — these are independent per file, not a single bundle-wide
 * counter, so an edit to one template doesn't flag the others as stale too.
 * All five start at `1`, the baseline as of introducing this tracking; that
 * baseline is not a reconstruction of each file's real edit history.
 *
 * `world-builder.md`/`script-writer.md` jump straight to `3`: both files'
 * own `lorefountain-docs-version` markers had already drifted ahead of this
 * registry (to `2`) from an earlier content edit that didn't update this
 * constant — discovered while bumping them again for the asset-manifest
 * documentation below, so this both reflects the new edit and corrects that
 * pre-existing drift in one step.
 */
export const AGENT_FILE_VERSIONS: Record<string, number> = {
  'AGENTS.md': 2,
  [path.join('agents', 'world-builder.md')]: 3,
  [path.join('agents', 'script-writer.md')]: 3,
  [path.join('agents', 'initiator.md')]: 1,
  [path.join('agents', 'validate.js')]: 1,
};

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

  for (const relativePath of Object.keys(AGENT_FILE_VERSIONS)) {
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
