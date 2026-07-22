/**
 * VS Code-facing configuration reader for `lorefountain.folders.*`.
 *
 * Thin adapter over `vscode.workspace.getConfiguration`: reads the raw
 * settings for a given workspace folder and resolves them to absolute paths
 * via {@link resolveWorkspaceFolders}. Kept separate from `folders.ts` so the
 * path-resolution logic itself has no `vscode` dependency and stays
 * unit-testable without the extension host.
 */

import * as vscode from 'vscode';
import { resolveWorkspaceFolders, type FolderSettings, type WorkspaceFolders } from './folders';

const CONFIG_SECTION = 'lorefountain.folders';

/**
 * Resolve absolute LoreFountain folder paths for a workspace folder, reading
 * `lorefountain.folders.*` from that folder's configuration scope.
 *
 * @param workspaceFolder - The VS Code workspace folder to resolve paths for.
 * @returns Resolved absolute paths for scripts, world (+ glossary/timeline/notes), and imports.
 */
export function getWorkspaceFolders(workspaceFolder: vscode.WorkspaceFolder): WorkspaceFolders {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION, workspaceFolder);
  const settings: FolderSettings = {
    scripts: config.get<string>('scripts'),
    world: config.get<string>('world'),
    imports: config.get<string>('imports'),
  };
  return resolveWorkspaceFolders(workspaceFolder.uri.fsPath, settings);
}
