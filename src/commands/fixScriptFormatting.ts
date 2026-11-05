/**
 * "LoreFountain: Fix All Script Formatting Issues" (ADR-0039): collects
 * every safe quick fix across every open workspace folder's scripts into one
 * `WorkspaceEdit` and applies it through VS Code's refactor preview, so the
 * writer reviews, and can untick, each change before anything is written.
 * Nothing is ever edited without that approval.
 *
 * Exports {@link registerFixScriptFormattingCommand} and
 * {@link runFixScriptFormatting} (also launched by the post-upgrade project
 * summary). The planning is pure and unit-tested in `upgrade/formatFixes.ts`;
 * this file is `vscode`-facing glue, verified manually in the F5 Extension
 * Development Host.
 *
 * Gotchas:
 * - A script open in an editor is read from its (possibly unsaved) buffer,
 *   so fixes line up with what's on screen; others are read from disk.
 * - Scripts that weren't already dirty are saved after the edit applies, so
 *   the index and sidecars refresh. Scripts with unsaved changes of their own
 *   are left for the writer to save.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { getWorkspaceFolders } from '../config/workspaceConfig';
import { listFilesWithExtension } from '../index/build';
import { FIX_SCRIPT_FORMATTING_COMMAND, toRange } from '../providers/scriptQuickFixes';
import { registerTrackedCommand } from '../telemetry/trackedCommands';
import { FIXABLE_CODES, planAllFixes } from '../upgrade/formatFixes';
import { buildShotMap } from '../shots/shotMap';

/**
 * Register the Fix All command.
 *
 * @param context - The extension context to register the disposable against.
 * @param outputChannel - Where unexpected failures are logged.
 */
export function registerFixScriptFormattingCommand(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel): void {
  context.subscriptions.push(
    registerTrackedCommand(context, FIX_SCRIPT_FORMATTING_COMMAND, () => void runFixScriptFormatting(outputChannel)),
  );
}

/**
 * Plan, preview and apply every safe script formatting fix in the workspace,
 * then report what changed.
 *
 * @param outputChannel - Where unexpected failures are logged.
 * @returns Resolves once the writer has accepted or cancelled the preview and the result is reported.
 */
export async function runFixScriptFormatting(outputChannel: vscode.OutputChannel): Promise<void> {
  try {
    const scripts = await listWorkspaceScripts();
    const edit = new vscode.WorkspaceEdit();
    const changedUris = new Map<string, vscode.Uri>();
    /** Skipped issues in files that get changes: still present afterwards, so excluded from "fixed". */
    let skippedInChanged = 0;
    let proposed = 0;
    let skipped = 0;

    for (const filePath of scripts) {
      const uri = vscode.Uri.file(filePath);
      const plan = planAllFixes(await readScript(uri));
      skipped += plan.skipped;
      if (plan.fixes.length > 0) skippedInChanged += plan.skipped;
      for (const fix of plan.fixes) {
        edit.replace(uri, toRange(fix.edit), fix.edit.newText, {
          needsConfirmation: true,
          label: fix.title,
          description: `${path.basename(filePath)}, line ${fix.line + 1}`,
        });
        changedUris.set(uri.toString(), uri);
        proposed += 1;
      }
    }

    if (proposed === 0) {
      const tail = skipped > 0 ? ` ${skipped} need a manual fix (see the Problems panel).` : '';
      void vscode.window.showInformationMessage(`LoreFountain: no script formatting issues can be fixed automatically.${tail}`);
      return;
    }

    const dirtyBefore = new Set(vscode.workspace.textDocuments.filter((doc) => doc.isDirty).map((doc) => doc.uri.toString()));
    const applied = await vscode.workspace.applyEdit(edit, { isRefactoring: true });
    if (!applied) return;

    let remaining = 0;
    for (const uri of changedUris.values()) {
      const document = await vscode.workspace.openTextDocument(uri);
      remaining += countFixableIssues(document.getText());
      if (document.isDirty && !dirtyBefore.has(uri.toString())) await document.save();
    }
    // Anything the writer unticked in the preview is still there, so count what actually went away.
    const fixed = Math.max(0, proposed - (remaining - skippedInChanged));
    void vscode.window.showInformationMessage(
      `LoreFountain: fixed ${fixed} script formatting issue(s).` +
        (skipped > 0 ? ` ${skipped} need a manual fix (see the Problems panel).` : ''),
    );
  } catch (err) {
    outputChannel.appendLine(`[LoreFountain] Fix All Script Formatting Issues failed: ${err instanceof Error ? err.message : String(err)}`);
    void vscode.window.showErrorMessage('LoreFountain: Fix All Script Formatting Issues failed. See the LoreFountain output for details.');
  }
}

/** Every `.fountain` script under each open workspace folder's scripts folder. */
async function listWorkspaceScripts(): Promise<string[]> {
  const scripts: string[] = [];
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const { folders } = await getWorkspaceFolders(folder);
    scripts.push(...(await listFilesWithExtension(folders.scripts, '.fountain')));
  }
  return scripts;
}

/** A script's current text: its open buffer if there is one, otherwise the file on disk. */
async function readScript(uri: vscode.Uri): Promise<string> {
  const open = vscode.workspace.textDocuments.find((doc) => doc.uri.toString() === uri.toString());
  return open ? open.getText() : fsp.readFile(uri.fsPath, 'utf8');
}

/** How many fixable-code issues a script still has. */
function countFixableIssues(text: string): number {
  return buildShotMap(text, []).issues.filter((issue) => FIXABLE_CODES.has(issue.code)).length;
}
