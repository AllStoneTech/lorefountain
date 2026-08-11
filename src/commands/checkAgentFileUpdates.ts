/**
 * "Check for Agent File Updates" command: `scaffoldAgentFilesIfAbsent`
 * (`src/config/agentFiles.ts`) copies `AGENTS.md`/`agents/*` into a
 * workspace once and never touches them again, so they silently drift from
 * the bundled templates as LoreFountain evolves. This command surfaces that
 * drift (`checkAgentFileVersions`, `src/config/agentFileVersions.ts`) and
 * lets the writer review each stale file in a real diff view before
 * choosing, per file, whether to replace it — never a silent bulk
 * overwrite, matching this codebase's "never clobber a writer's edits"
 * posture (the same one `scaffoldAgentFilesIfAbsent` itself follows).
 *
 * `vscode`-facing glue; not covered by the vitest unit suite — verify
 * manually via the F5 Extension Development Host.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { checkAgentFileVersions, type AgentFileVersionStatus } from '../config/agentFileVersions';

/**
 * Register the "Check for Agent File Updates" command.
 *
 * @param context - The extension context (used to locate the bundled agent-file templates and register the disposable).
 * @param outputChannel - Where to log the full drift report.
 * @param pickTargetWorkspaceFolder - Resolves which workspace folder to check (prompts if more than one is open).
 */
export function registerCheckAgentFileUpdatesCommand(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  pickTargetWorkspaceFolder: () => Promise<vscode.WorkspaceFolder | undefined>,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('lorefountain.checkAgentFileUpdates', () =>
      void checkAgentFileUpdatesCommand(context, outputChannel, pickTargetWorkspaceFolder),
    ),
  );
}

interface ActionableFinding {
  relativePath: string;
  description: string;
}

async function checkAgentFileUpdatesCommand(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  pickTargetWorkspaceFolder: () => Promise<vscode.WorkspaceFolder | undefined>,
): Promise<void> {
  const folder = await pickTargetWorkspaceFolder();
  if (!folder) return;

  const resourcesPath = path.join(context.extensionPath, 'resources');
  const statuses = await checkAgentFileVersions(folder.uri.fsPath);
  const findings = statuses.filter((s): s is Exclude<AgentFileVersionStatus, { status: 'current' }> => s.status !== 'current');

  if (findings.length === 0) {
    void vscode.window.showInformationMessage('LoreFountain: all agent files are up to date.');
    return;
  }

  const actionable: ActionableFinding[] = findings.map((finding) => {
    if (finding.status === 'stale') {
      outputChannel.appendLine(
        `[LoreFountain] ${finding.relativePath}: v${finding.workspaceVersion} → v${finding.currentVersion} available`,
      );
      return { relativePath: finding.relativePath, description: `v${finding.workspaceVersion} → v${finding.currentVersion}` };
    }
    outputChannel.appendLine(
      `[LoreFountain] ${finding.relativePath}: not version-tracked yet (predates this feature) → v${finding.currentVersion} available`,
    );
    return { relativePath: finding.relativePath, description: `untracked → v${finding.currentVersion}` };
  });
  outputChannel.show();

  const choice = await vscode.window.showInformationMessage(
    `LoreFountain: ${actionable.length} agent file(s) have updates available. See the "LoreFountain" output channel for details.`,
    'Review & Update...',
  );
  if (choice !== 'Review & Update...') return;

  const picks = await vscode.window.showQuickPick(
    actionable.map((finding) => ({ label: finding.relativePath, description: finding.description, relativePath: finding.relativePath })),
    { title: 'Select agent files to review', canPickMany: true },
  );
  if (!picks || picks.length === 0) return;

  for (const pick of picks) {
    await reviewAndUpdateFile(pick.relativePath, folder.uri.fsPath, resourcesPath);
  }
}

async function reviewAndUpdateFile(relativePath: string, workspaceRoot: string, resourcesPath: string): Promise<void> {
  const workspacePath = path.join(workspaceRoot, relativePath);
  const bundledPath = path.join(resourcesPath, relativePath);

  await vscode.commands.executeCommand(
    'vscode.diff',
    vscode.Uri.file(workspacePath),
    vscode.Uri.file(bundledPath),
    `${relativePath} (yours ↔ current template)`,
  );

  const confirm = await vscode.window.showWarningMessage(
    `Replace your copy of "${relativePath}" with the current template? This overwrites the whole file — copy anything you want to keep out of the diff first.`,
    { modal: true },
    'Replace with Current Template',
  );
  if (confirm !== 'Replace with Current Template') return;

  await fsp.copyFile(bundledPath, workspacePath);
  void vscode.window.showInformationMessage(`LoreFountain: updated "${relativePath}".`);
}
