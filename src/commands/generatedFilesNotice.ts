/**
 * The one-time "generated files" offer (ADR-0053), `vscode` side. Shown once
 * per project, after its first index build (an existing project after an
 * update) or when Initialize Workspace creates it. Tells the writer which
 * files LoreFountain regenerates, and, only if a `.gitignore` already exists,
 * offers to append them to it.
 *
 * LoreFountain never runs source-control commands. The only possible write is
 * appending text to an existing `.gitignore`, on a click. The decision rules
 * and text edit are pure and unit-tested in `config/generatedFilesNotice.ts`;
 * this file is glue, verified manually in the Extension Development Host.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { readLoreFountainConfig } from '../config/configFile';
import { appendMissingPatterns, decideGeneratedFilesNotice } from '../config/generatedFilesNotice';

/** Workspace-state key prefix recording that a folder was offered this. */
const OFFERED_KEY_PREFIX = 'lorefountain.generatedFiles.offered:';

/**
 * Make the one-time offer for a project if it is due.
 *
 * Marks the folder as offered before showing anything, so concurrent callers
 * (the index build and Initialize Workspace) never produce two prompts.
 *
 * @param context - The extension context, for the per-project flag and the README location.
 * @param folder - The workspace folder to consider.
 * @returns Resolves once the offer was answered, dismissed, or wasn't due.
 */
export async function maybeOfferGeneratedFilesNotice(context: vscode.ExtensionContext, folder: vscode.WorkspaceFolder): Promise<void> {
  const enabled = vscode.workspace.getConfiguration('lorefountain').get<boolean>('notifications.generatedFiles', true);
  const key = `${OFFERED_KEY_PREFIX}${folder.uri.toString()}`;
  const read = await readLoreFountainConfig(folder.uri.fsPath);
  const gitignorePath = path.join(folder.uri.fsPath, '.gitignore');
  const gitignoreText = await readTextIfExists(gitignorePath);

  const notice = decideGeneratedFilesNotice(
    { enabled, hasConfigFile: read.ok && read.found, alreadyOffered: context.workspaceState.get<boolean>(key) === true },
    gitignoreText,
  );
  if (!notice) return;
  await context.workspaceState.update(key, true);

  const append = 'Add to .gitignore';
  const learnMore = 'Show Details';
  const buttons = notice.canAppend ? [append, learnMore] : [learnMore];
  const choice = await vscode.window.showInformationMessage(
    `LoreFountain: in "${folder.name}", the *.shots.json, *.cues.json and *.pages.json files and the .lorefountain folder are rebuilt from your scripts, ` +
      "so they don't need to be kept in version control or backups. LoreFountain never changes your source control.",
    ...buttons,
  );

  if (choice === learnMore) {
    await openRootReadme(folder);
  } else if (choice === append && gitignoreText !== undefined) {
    try {
      await fsp.writeFile(gitignorePath, appendMissingPatterns(gitignoreText), 'utf8');
      void vscode.window.showInformationMessage(
        'LoreFountain: added the generated-file patterns to .gitignore. Files your source control already tracks stay tracked until you remove them from it yourself.',
      );
    } catch (err) {
      void vscode.window.showErrorMessage(`LoreFountain: couldn't update .gitignore — ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

async function readTextIfExists(filePath: string): Promise<string | undefined> {
  try {
    return await fsp.readFile(filePath, 'utf8');
  } catch {
    return undefined;
  }
}

async function openRootReadme(folder: vscode.WorkspaceFolder): Promise<void> {
  const readme = vscode.Uri.joinPath(folder.uri, 'README.md');
  try {
    await vscode.commands.executeCommand('vscode.open', readme);
  } catch {
    void vscode.window.showInformationMessage('LoreFountain: this project has no README.md. "Check for LoreFountain File Updates" can create it.');
  }
}
