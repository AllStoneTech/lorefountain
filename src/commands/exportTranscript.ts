/**
 * "Export Transcript" command (Spec §16): dialogue-only, cues-stripped
 * export of a `.fountain` script, free-tier since "accessibility should not
 * be a paywalled feature." `vscode`-facing glue over the pure
 * `src/export/transcript.ts`; not covered by the vitest unit suite — verify
 * manually via the F5 Extension Development Host.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { getWorkspaceFolders } from '../config/workspaceConfig';
import { buildTranscript, serializeTranscriptMarkdown } from '../export/transcript';
import { parseFountain } from '../fountain/parse';
import { listFilesWithExtension } from '../index/build';

/**
 * Register the "Export Transcript" command.
 *
 * @param context - The extension context to register the disposable against.
 */
export function registerExportTranscriptCommand(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('lorefountain.exportTranscript', () => void exportTranscriptCommand()),
  );
}

async function exportTranscriptCommand(): Promise<void> {
  const scriptUri = await resolveScriptUri();
  if (!scriptUri) return;

  const document = await vscode.workspace.openTextDocument(scriptUri);
  const tokens = parseFountain(document.getText());
  const entries = buildTranscript(tokens);
  const title = path.basename(scriptUri.fsPath, '.fountain');
  const markdown = serializeTranscriptMarkdown(title, entries);

  const defaultUri = vscode.Uri.file(scriptUri.fsPath.replace(/\.fountain$/, '.transcript.md'));
  const targetUri = await vscode.window.showSaveDialog({
    defaultUri,
    filters: { Markdown: ['md'] },
    title: 'Export Transcript',
  });
  if (!targetUri) return; // cancelled

  await fsp.writeFile(targetUri.fsPath, markdown, 'utf8');
  void vscode.window.showTextDocument(targetUri);
  void vscode.window.showInformationMessage(`LoreFountain: exported transcript to ${path.basename(targetUri.fsPath)}.`);
}

/** Prefer the active editor's `.fountain` document; otherwise offer a picker over every script in the workspace. */
async function resolveScriptUri(): Promise<vscode.Uri | undefined> {
  const active = vscode.window.activeTextEditor?.document;
  if (active?.languageId === 'fountain') {
    return active.uri;
  }

  const picks: { label: string; description: string; uri: vscode.Uri }[] = [];
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const { folders } = await getWorkspaceFolders(folder);
    const scripts = await listFilesWithExtension(folders.scripts, '.fountain');
    for (const scriptPath of scripts) {
      picks.push({
        label: path.relative(folder.uri.fsPath, scriptPath),
        description: folder.name,
        uri: vscode.Uri.file(scriptPath),
      });
    }
  }

  if (picks.length === 0) {
    void vscode.window.showErrorMessage('LoreFountain: no .fountain scripts found to export.');
    return undefined;
  }
  if (picks.length === 1) return picks[0].uri;

  const picked = await vscode.window.showQuickPick(picks, {
    title: 'Export Transcript',
    placeHolder: 'Choose a script to export',
  });
  return picked?.uri;
}
