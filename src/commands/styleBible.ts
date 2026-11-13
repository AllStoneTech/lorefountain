/**
 * The "Open Style Bible" command (ADR-0045, ADR-0047): opens the project's
 * `world/style.lf.md` in the guided editor, first creating it from the
 * bundled template if the
 * project doesn't have one yet. This is the only way the file gets created;
 * `Initialize Workspace` deliberately doesn't, since the style bible is
 * optional.
 *
 * Opens by explicit view type, never the Story Card form that the
 * `**\/world/*.md` selector would otherwise pick. `vscode`-facing glue; not
 * covered by the vitest unit suite (the scaffold is, in
 * `test/unit/styleBible.test.ts`). Verify manually in the Extension
 * Development Host.
 */

import * as path from 'node:path';
import * as vscode from 'vscode';
import { scaffoldStyleBibleIfAbsent } from '../config/styleBible';
import { getWorkspaceFolders } from '../config/workspaceConfig';
import { STYLE_BIBLE_VIEW_TYPE } from '../providers/projectDocumentEditors';
import type { WorldTreeNode } from '../providers/worldTreeProvider';
import { registerTrackedCommand } from '../telemetry/trackedCommands';

/**
 * Register `lorefountain.openStyleBible`.
 *
 * @param context - The extension context to register the disposable against.
 * @param pickTargetWorkspaceFolder - Resolves which workspace folder to target (prompts if more than one is open).
 * @param refreshTree - Repaints the World tree so a newly created file appears.
 */
export function registerStyleBibleCommand(
  context: vscode.ExtensionContext,
  pickTargetWorkspaceFolder: () => Promise<vscode.WorkspaceFolder | undefined>,
  refreshTree: () => void,
): void {
  context.subscriptions.push(
    registerTrackedCommand(context, 'lorefountain.openStyleBible', (node?: WorldTreeNode) =>
      void openStyleBible(context, node, pickTargetWorkspaceFolder, refreshTree),
    ),
  );
}

async function openStyleBible(
  context: vscode.ExtensionContext,
  node: WorldTreeNode | undefined,
  pickTargetWorkspaceFolder: () => Promise<vscode.WorkspaceFolder | undefined>,
  refreshTree: () => void,
): Promise<void> {
  const folder = node?.folder ?? (await pickTargetWorkspaceFolder());
  if (!folder) return;

  try {
    const { folders } = await getWorkspaceFolders(folder);
    const resourcesPath = path.join(context.extensionPath, 'resources');
    const { filePath, created } = await scaffoldStyleBibleIfAbsent(resourcesPath, folders.world, folder.name);
    if (created) refreshTree();
    await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(filePath), STYLE_BIBLE_VIEW_TYPE);
  } catch (err) {
    void vscode.window.showErrorMessage(
      `LoreFountain: couldn't open the style bible: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
