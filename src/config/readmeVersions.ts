/**
 * Detects drift between a workspace's scaffolded human-facing READMEs
 * (`resources/readmes/*.md`, written via `scaffoldReadmesIfAbsent`) and the
 * versions currently bundled with this extension. Pure — no `vscode`
 * import. The README counterpart to `agentFileVersions.ts`; both feed
 * `src/commands/checkFileUpdates.ts`'s single "Check for LoreFountain File
 * Updates" command.
 *
 * README target paths depend on a workspace's configured folder names
 * (unlike `agents/*`, which always live at the same relative path), so this
 * needs `folders: FolderNames` in addition to the workspace root —
 * `README_TEMPLATES` (`readmeFiles.ts`) already carries the function that
 * resolves each template's real target path.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { parseVersionMarker } from './agentFileVersions';
import type { FolderNames } from './folders';
import { README_TEMPLATES } from './readmeFiles';

/** One tracked README's drift status against the currently bundled template. */
export type ReadmeVersionStatus =
  | { relativePath: string; templateName: string; status: 'current'; version: number }
  | { relativePath: string; templateName: string; status: 'stale'; workspaceVersion: number; currentVersion: number }
  | { relativePath: string; templateName: string; status: 'untracked'; currentVersion: number };

/**
 * Compare a workspace's scaffolded READMEs against the versions currently
 * bundled with this extension.
 *
 * @param workspaceRoot - Absolute path to the workspace root to check.
 * @param folders - The workspace's actual configured folder names, to resolve each README's real target path.
 * @returns One status per tracked README that actually exists in the workspace (a README that was never scaffolded at all is skipped, not reported).
 */
export async function checkReadmeVersions(
  workspaceRoot: string,
  folders: FolderNames,
): Promise<ReadmeVersionStatus[]> {
  const results: ReadmeVersionStatus[] = [];

  for (const template of README_TEMPLATES) {
    const relativePath = template.targetRelativePath(folders);
    const targetPath = path.join(workspaceRoot, relativePath);
    let content: string;
    try {
      content = await fsp.readFile(targetPath, 'utf8');
    } catch {
      continue;
    }

    const workspaceVersion = parseVersionMarker(content);
    if (workspaceVersion === undefined) {
      results.push({ relativePath, templateName: template.templateName, status: 'untracked', currentVersion: template.version });
    } else if (workspaceVersion < template.version) {
      results.push({
        relativePath,
        templateName: template.templateName,
        status: 'stale',
        workspaceVersion,
        currentVersion: template.version,
      });
    } else {
      results.push({ relativePath, templateName: template.templateName, status: 'current', version: workspaceVersion });
    }
  }

  return results;
}
