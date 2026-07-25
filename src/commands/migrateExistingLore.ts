/**
 * "Migrate Existing Lore" command (Spec §13.5): surfaces the premade,
 * AI-agnostic migration prompt bundled with the extension — plain
 * natural-language instructions with no tool-specific syntax, so they work
 * pasted into Cursor, Copilot Chat, Gemini, or any other coding
 * agent. This command's only job is to hand that prompt to the writer; the
 * migration itself is carried out by whichever AI agent the writer pastes
 * it into.
 *
 * The prompt is read from the workspace's own `agents/initiator.md`
 * (scaffolded by `initializeWorkspace`) rather than the extension's bundled
 * template directly — so a writer's own edits to that file are honored,
 * and so the same file an AI would read on its own (per `AGENTS.md`) is
 * exactly what this command hands over. Falls back to scaffolding it on
 * the spot if `initializeWorkspace` was never run.
 *
 * `vscode`-facing glue; not covered by the vitest unit suite — verify
 * manually via the F5 Extension Development Host.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { scaffoldAgentFilesIfAbsent } from '../config/agentFiles';

/**
 * Register the "Migrate Existing Lore" command.
 *
 * @param context - The extension context (used to locate the bundled agent-file templates).
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

  await scaffoldAgentFilesIfAbsent(path.join(context.extensionPath, 'resources'), folder.uri.fsPath);

  const prompt = await fsp.readFile(path.join(folder.uri.fsPath, 'agents', 'initiator.md'), 'utf8');

  await vscode.env.clipboard.writeText(prompt);
  const document = await vscode.workspace.openTextDocument({ content: prompt, language: 'markdown' });
  await vscode.window.showTextDocument(document);

  void vscode.window.showInformationMessage(
    'LoreFountain: migration prompt copied to your clipboard and opened for reference — paste it into your AI coding agent of choice.',
  );
}
