/**
 * "Migrate Existing Lore" command (Spec §13.5): surfaces the premade,
 * AI-agnostic migration prompt bundled with the extension — plain
 * natural-language instructions with no tool-specific syntax, so they work
 * pasted into Cursor, Copilot Chat, Gemini, or any other coding
 * agent. This command's only job is to hand that prompt to the writer with
 * this workspace's actual folder paths filled in; the migration itself is
 * carried out by whichever AI agent the writer pastes it into.
 *
 * `vscode`-facing glue; not covered by the vitest unit suite — verify
 * manually via the F5 Extension Development Host.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { getWorkspaceFolders } from '../config/workspaceConfig';

/**
 * Register the "Migrate Existing Lore" command.
 *
 * @param context - The extension context (used to locate the bundled prompt template).
 * @param pickTargetWorkspaceFolder - Resolves which workspace folder to migrate into (prompts if more than one is open).
 */
export function registerMigrateExistingLoreCommand(
  context: vscode.ExtensionContext,
  pickTargetWorkspaceFolder: () => Promise<vscode.WorkspaceFolder | undefined>,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('lorefountain.migrateExistingLore', () =>
      void migrateExistingLoreCommand(context, pickTargetWorkspaceFolder),
    ),
  );
}

async function migrateExistingLoreCommand(
  context: vscode.ExtensionContext,
  pickTargetWorkspaceFolder: () => Promise<vscode.WorkspaceFolder | undefined>,
): Promise<void> {
  const folder = await pickTargetWorkspaceFolder();
  if (!folder) return;

  const { folders } = await getWorkspaceFolders(folder);
  const templatePath = path.join(context.extensionPath, 'resources', 'migrate-existing-lore-prompt.md');
  const template = await fsp.readFile(templatePath, 'utf8');

  const importsRelative = path.relative(folder.uri.fsPath, folders.imports) || 'imports';
  const worldRelative = path.relative(folder.uri.fsPath, folders.world) || 'world';
  const prompt = template.replaceAll('{{IMPORTS_FOLDER}}', importsRelative).replaceAll('{{WORLD_FOLDER}}', worldRelative);

  await vscode.env.clipboard.writeText(prompt);
  const document = await vscode.workspace.openTextDocument({ content: prompt, language: 'markdown' });
  await vscode.window.showTextDocument(document);

  void vscode.window.showInformationMessage(
    'LoreFountain: migration prompt copied to your clipboard and opened for reference — paste it into your AI coding agent of choice.',
  );
}
