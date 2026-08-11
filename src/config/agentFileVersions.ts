/**
 * Detects drift between a workspace's scaffolded `AGENTS.md`/`agents/*`
 * files and the versions currently bundled with this extension. Pure —
 * no `vscode` import — so `lorefountain.checkAgentFileUpdates`
 * (`src/commands/checkAgentFileUpdates.ts`) stays a thin wrapper around
 * this and the rest is unit-testable without an extension host.
 *
 * Each scaffolded file's version lives as a marker on its own first line:
 * `<!-- lorefountain-docs-version: N -->` for Markdown, or
 * `// lorefountain-docs-version: N` for `agents/validate.js` (injected via
 * `esbuild.js`'s `banner` option, since that file is a minified build
 * output — see `AGENT_FILE_VERSIONS` in `agentFiles.ts` for the current
 * version each file should carry).
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { AGENT_FILE_VERSIONS } from './agentFiles';

const VERSION_MARKER_PATTERN = /lorefountain-docs-version:\s*(\d+)/;

/** One tracked file's drift status against the currently bundled template. */
export type AgentFileVersionStatus =
  | { relativePath: string; status: 'current'; version: number }
  | { relativePath: string; status: 'stale'; workspaceVersion: number; currentVersion: number }
  | { relativePath: string; status: 'untracked'; currentVersion: number };

/**
 * Extract the version number from a scaffolded file's version marker.
 *
 * @param content - The file's full text content.
 * @returns The marked version, or `undefined` if no marker is present on the first line (predates this feature).
 */
export function parseVersionMarker(content: string): number | undefined {
  const firstLine = content.split('\n', 1)[0] ?? '';
  const match = VERSION_MARKER_PATTERN.exec(firstLine);
  return match ? Number(match[1]) : undefined;
}

/**
 * Compare a workspace's scaffolded agent files against the versions
 * currently bundled with this extension.
 *
 * @param workspaceRoot - Absolute path to the workspace root to check.
 * @returns One status per tracked file that actually exists in the workspace (a file that was never scaffolded at all is skipped, not reported).
 */
export async function checkAgentFileVersions(workspaceRoot: string): Promise<AgentFileVersionStatus[]> {
  const results: AgentFileVersionStatus[] = [];

  for (const [relativePath, currentVersion] of Object.entries(AGENT_FILE_VERSIONS)) {
    const targetPath = path.join(workspaceRoot, relativePath);
    let content: string;
    try {
      content = await fsp.readFile(targetPath, 'utf8');
    } catch {
      continue;
    }

    const workspaceVersion = parseVersionMarker(content);
    if (workspaceVersion === undefined) {
      results.push({ relativePath, status: 'untracked', currentVersion });
    } else if (workspaceVersion < currentVersion) {
      results.push({ relativePath, status: 'stale', workspaceVersion, currentVersion });
    } else {
      results.push({ relativePath, status: 'current', version: workspaceVersion });
    }
  }

  return results;
}
