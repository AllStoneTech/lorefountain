/**
 * VS Code-facing configuration reader for `lorefountain.config.json`.
 *
 * Thin adapter over the pure `configFile.ts`/`folders.ts` logic: reads the
 * config file for a given workspace folder and resolves it to absolute
 * folder paths. Kept separate so the underlying logic has no `vscode`
 * dependency and stays unit-testable without the extension host.
 */

import * as vscode from 'vscode';
import { folderSettingsFromConfig, hiddenCategoriesFromConfig, readLoreFountainConfig } from './configFile';
import { resolveWorkspaceFolders, type WorkspaceFolders } from './folders';

/** Result of {@link getWorkspaceFolders}: resolved paths, plus any config-file problem to report. */
export interface WorkspaceFoldersResult {
  folders: WorkspaceFolders;
  /** World-tree category ids to hide, from `world.hiddenCategories` (empty if unset or the config file is missing/invalid). */
  hiddenCategories: string[];
  /** Set when `lorefountain.config.json` exists but failed to parse/validate; folders still fall back to defaults. */
  configIssue?: string;
}

/**
 * Resolve absolute LoreFountain folder paths for a workspace folder, reading
 * `lorefountain.config.json` from that folder's root.
 *
 * A missing config file is not a problem — folders fall back to documented
 * defaults, since the extension may activate off a bare `.fountain` script
 * before any config file exists (ADR-0006). A malformed/invalid config file
 * is reported via `configIssue` but still resolves to defaults, never throws.
 *
 * @param workspaceFolder - The VS Code workspace folder to resolve paths for.
 * @returns Resolved folder paths, plus any config-file issue to log.
 */
export async function getWorkspaceFolders(
  workspaceFolder: vscode.WorkspaceFolder,
): Promise<WorkspaceFoldersResult> {
  const root = workspaceFolder.uri.fsPath;
  const result = await readLoreFountainConfig(root);

  if (!result.ok) {
    return {
      folders: resolveWorkspaceFolders(root),
      hiddenCategories: [],
      configIssue: `lorefountain.config.json (${result.reason}): ${result.message}`,
    };
  }

  return {
    folders: resolveWorkspaceFolders(root, folderSettingsFromConfig(result.config)),
    hiddenCategories: hiddenCategoriesFromConfig(result.config),
  };
}
