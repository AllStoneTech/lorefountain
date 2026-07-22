/**
 * Workspace folder-path resolution (Spec §5).
 *
 * Reads the `lorefountain.folders.*` workspace settings and resolves them to
 * absolute paths under a given workspace root, falling back to the documented
 * defaults (`scripts/`, `world/`, `imports/`) for anything unset. Pure
 * path-joining logic with no `vscode` dependency, so it stays unit-testable;
 * the thin `vscode`-facing wrapper that reads `workspace.getConfiguration`
 * lives in `src/config/workspaceConfig.ts`.
 */

import * as path from 'node:path';

/** Raw folder settings as read from `lorefountain.folders.*` (all optional; defaults apply). */
export interface FolderSettings {
  scripts?: string;
  world?: string;
  imports?: string;
}

/** Documented default folder names (Spec §5). */
export const DEFAULT_FOLDERS: Required<FolderSettings> = {
  scripts: 'scripts',
  world: 'world',
  imports: 'imports',
};

/** Resolved, absolute workspace folder paths. */
export interface WorkspaceFolders {
  /** `.fountain` scripts. */
  scripts: string;
  /** Entity `.md` files. */
  world: string;
  /** Terminology entries, under `world`. */
  glossary: string;
  /** Event/timeline entries, under `world`. */
  timeline: string;
  /** Free-form scratch notes, under `world`; no frontmatter required (Spec §13.4). */
  notes: string;
  /** Drop-zone for existing source docs/bibles to migrate (Spec §13.5). */
  imports: string;
}

/**
 * Resolve absolute workspace folder paths from settings and a workspace root.
 *
 * `glossary`, `timeline`, and `notes` are fixed subfolders of `world` per §5
 * and are not independently configurable.
 *
 * @param workspaceRoot - Absolute path to the workspace root.
 * @param settings - Raw `lorefountain.folders.*` settings (unset fields use the default).
 * @returns Resolved absolute paths for every configured folder.
 */
export function resolveWorkspaceFolders(
  workspaceRoot: string,
  settings: FolderSettings = {},
): WorkspaceFolders {
  const scripts = settings.scripts?.trim() || DEFAULT_FOLDERS.scripts;
  const world = settings.world?.trim() || DEFAULT_FOLDERS.world;
  const imports = settings.imports?.trim() || DEFAULT_FOLDERS.imports;

  return {
    scripts: path.join(workspaceRoot, scripts),
    world: path.join(workspaceRoot, world),
    glossary: path.join(workspaceRoot, world, 'glossary'),
    timeline: path.join(workspaceRoot, world, 'timeline'),
    notes: path.join(workspaceRoot, world, 'notes'),
    imports: path.join(workspaceRoot, imports),
  };
}
