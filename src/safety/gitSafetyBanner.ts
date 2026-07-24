/**
 * VS Code-facing git-safety warning (Spec §13.7): "files are the source of
 * truth" is only as safe as the writer's own backup discipline, so a
 * workspace with no git repo and no recognized cloud-sync folder gets a
 * warning every time it's opened, until either git is initialized or the
 * writer explicitly dismisses it for that workspace folder.
 */

import * as vscode from 'vscode';
import { hasRecognizedBackup } from './backupCheck';

const DISMISSED_KEY = 'lorefountain.gitSafety.dismissedFolders';

/**
 * Checks one workspace folder for git/cloud-sync protection and, if absent
 * and not previously dismissed, shows a warning offering to initialize git
 * or to stop asking for this workspace.
 *
 * @param context - The extension context, used for the per-workspace dismissal flag.
 * @param folder - The workspace folder to check.
 * @param hasWorldOrScripts - Whether this folder actually has a `scripts` or `world` folder yet (Spec §13.7 scopes the check to LoreFountain-relevant workspaces).
 */
export async function checkGitSafety(
  context: vscode.ExtensionContext,
  folder: vscode.WorkspaceFolder,
  hasWorldOrScripts: boolean,
): Promise<void> {
  if (!hasWorldOrScripts) return;
  if (hasRecognizedBackup(folder.uri.fsPath)) return;

  const dismissed = context.workspaceState.get<string[]>(DISMISSED_KEY, []);
  const folderKey = folder.uri.toString();
  if (dismissed.includes(folderKey)) return;

  const initializeGit = 'Initialize Git';
  const dontAskAgain = "Don't ask again for this workspace";
  const choice = await vscode.window.showWarningMessage(
    `LoreFountain: "${folder.name}" isn't tracked by git or a recognized cloud-sync folder. ` +
      'Unversioned creative work can be lost to an accidental edit or delete with no way back.',
    initializeGit,
    dontAskAgain,
  );

  if (choice === initializeGit) {
    try {
      await vscode.commands.executeCommand('git.init');
    } catch {
      void vscode.window.showErrorMessage(
        'LoreFountain: could not run "Initialize Repository" — is the built-in Git extension enabled?',
      );
    }
  } else if (choice === dontAskAgain) {
    await context.workspaceState.update(DISMISSED_KEY, [...dismissed, folderKey]);
  }
}
