/**
 * "LoreFountain: Tag All Shots" (ADR-0054): gives every untagged `SHOT:` line a
 * generated `[tag]` such as `[1x03-04-02]`, through VS Code's refactor
 * preview so the writer reviews, and can untick, each one before anything is
 * written. Never runs silently, never changes an existing tag.
 *
 * Exports {@link registerTagAllShotsCommand} and {@link TAG_ALL_SHOTS_COMMAND}.
 * The planning is pure and unit-tested (`shots/tagAllShots.ts`, Core's
 * `shots/tagShots`); this file is `vscode` glue, verified manually in the F5
 * Extension Development Host.
 *
 * Deliberately not part of "Fix All Script Formatting Issues": that fixes
 * formatting, while this writes an ID into every shot, a different kind of
 * change that earns its own explicit command.
 *
 * Gotchas:
 * - A shot with no `SHOT:` line to carry a tag (a scene's opening content) is
 *   not tagged; the warning on it says to add a `SHOT:` line.
 * - A script with no Production Code and no usable file slug is skipped and
 *   named in the result.
 * - A script open in an editor is read from its buffer; scripts that were
 *   not dirty are saved after the edit so sidecars and the index refresh.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { getWorkspaceFolders } from '../config/workspaceConfig';
import { listFilesWithExtension } from '../index/build';
import { planProjectShotTags, type ScriptSource } from '../shots/tagAllShots';
import { registerTrackedCommand } from '../telemetry/trackedCommands';

/** The command id, also offered from the untagged-shot quick fix. */
export const TAG_ALL_SHOTS_COMMAND = 'lorefountain.tagAllShots';

/**
 * Register the Tag All Shots command.
 *
 * @param context - The extension context to register the disposable against.
 * @param outputChannel - Where unexpected failures are logged.
 */
export function registerTagAllShotsCommand(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel): void {
  context.subscriptions.push(registerTrackedCommand(context, TAG_ALL_SHOTS_COMMAND, () => void runTagAllShots(outputChannel)));
}

async function runTagAllShots(outputChannel: vscode.OutputChannel): Promise<void> {
  try {
    const scripts = await readWorkspaceScripts();
    const active = vscode.window.activeTextEditor?.document;
    const activeScript = active && scripts.find((script) => script.path === active.uri.fsPath);

    let only: ReadonlySet<string> | undefined;
    if (activeScript) {
      const thisScript = 'This script';
      const everyScript = 'Every script in the project';
      const scope = await vscode.window.showQuickPick([thisScript, everyScript], {
        title: 'Tag all shots in…',
        placeHolder: 'Generated tags are written once and never change. You review each one before it is applied.',
      });
      if (scope === undefined) return;
      if (scope === thisScript) only = new Set([activeScript.path]);
    }

    const plans = planProjectShotTags(scripts, only);
    const edit = new vscode.WorkspaceEdit();
    const changed = new Map<string, vscode.Uri>();
    let proposed = 0;
    const skipped: string[] = [];
    for (const { path: scriptPath, plan } of plans) {
      const uri = vscode.Uri.file(scriptPath);
      for (const tag of plan.edits) {
        const position = new vscode.Position(tag.line, tag.character);
        edit.insert(uri, position, tag.insert, {
          needsConfirmation: true,
          label: `Tag shot [${tag.tag}]`,
          description: `${path.basename(scriptPath)}, line ${tag.line + 1}`,
        });
        changed.set(uri.toString(), uri);
        proposed += 1;
      }
      if (plan.skipped.length > 0) skipped.push(`${path.basename(scriptPath)} (${plan.skipped.length}: ${plan.skipped[0].reason})`);
    }

    if (proposed === 0) {
      void vscode.window.showInformationMessage(
        skipped.length > 0
          ? `LoreFountain: no shots could be tagged automatically: ${skipped.join('; ')}.`
          : 'LoreFountain: every SHOT: line already has a tag.',
      );
      return;
    }

    const dirtyBefore = new Set(vscode.workspace.textDocuments.filter((doc) => doc.isDirty).map((doc) => doc.uri.toString()));
    const applied = await vscode.workspace.applyEdit(edit, { isRefactoring: true });
    if (!applied) return;
    for (const uri of changed.values()) {
      const document = await vscode.workspace.openTextDocument(uri);
      if (document.isDirty && !dirtyBefore.has(uri.toString())) await document.save();
    }
    void vscode.window.showInformationMessage(
      `LoreFountain: tagged ${proposed} shot(s) in ${changed.size} script(s).` +
        (skipped.length > 0 ? ` Skipped: ${skipped.join('; ')}.` : '') +
        ' Scenes whose opening content has no SHOT: line need one added by hand (see the Problems panel).',
    );
  } catch (err) {
    outputChannel.appendLine(`[LoreFountain] Tag All Shots failed: ${err instanceof Error ? err.message : String(err)}`);
    void vscode.window.showErrorMessage('LoreFountain: Tag All Shots failed. See the LoreFountain output for details.');
  }
}

/** Every `.fountain` script under each open workspace folder's scripts folder, with its current text (open buffer, else disk). */
async function readWorkspaceScripts(): Promise<ScriptSource[]> {
  const result: ScriptSource[] = [];
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const { folders } = await getWorkspaceFolders(folder);
    for (const filePath of await listFilesWithExtension(folders.scripts, '.fountain')) {
      const open = vscode.workspace.textDocuments.find((doc) => doc.uri.fsPath === filePath);
      result.push({ path: filePath, text: open ? open.getText() : await fsp.readFile(filePath, 'utf8') });
    }
  }
  return result;
}
