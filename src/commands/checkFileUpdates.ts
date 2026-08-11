/**
 * "Check for LoreFountain File Updates" command: `scaffoldAgentFilesIfAbsent`
 * (`src/config/agentFiles.ts`) and `scaffoldReadmesIfAbsent`
 * (`src/config/readmeFiles.ts`) each copy their templates into a workspace
 * once and never touch them again, so both silently drift from the bundled
 * templates as LoreFountain evolves. This command surfaces that drift for
 * both categories together (`checkAgentFileVersions`/`checkReadmeVersions`)
 * and lets the writer review each stale file in a real diff view before
 * choosing, per file, whether to replace it — never a silent bulk
 * overwrite, matching the "never clobber a writer's edits" posture both
 * scaffolders already follow.
 *
 * READMEs get per-workspace `{{...}}` placeholder substitution
 * (`renderReadmeTemplate`), so their diff/replace step compares against a
 * *rendered* copy, not the raw bundled template — otherwise a user's real
 * folder names would show as changed against literal `{{WORLD_FOLDER}}`
 * text. Both categories go through the same rendered-content path (an
 * untitled in-memory document as the diff's right-hand side) so the two
 * kinds of finding need no special-casing beyond how each renders its
 * "what it should become" text.
 *
 * `vscode`-facing glue; not covered by the vitest unit suite — verify
 * manually via the F5 Extension Development Host.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { checkAgentFileVersions, type AgentFileVersionStatus } from '../config/agentFileVersions';
import { renderReadmeTemplate } from '../config/readmeFiles';
import { checkReadmeVersions, type ReadmeVersionStatus } from '../config/readmeVersions';
import { getWorkspaceFolders } from '../config/workspaceConfig';

/**
 * Register the "Check for LoreFountain File Updates" command.
 *
 * @param context - The extension context (used to locate the bundled templates and register the disposable).
 * @param outputChannel - Where to log the full drift report.
 * @param pickTargetWorkspaceFolder - Resolves which workspace folder to check (prompts if more than one is open).
 */
export function registerCheckFileUpdatesCommand(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  pickTargetWorkspaceFolder: () => Promise<vscode.WorkspaceFolder | undefined>,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('lorefountain.checkFileUpdates', () =>
      void checkFileUpdatesCommand(context, outputChannel, pickTargetWorkspaceFolder),
    ),
  );
}

interface ActionableFinding {
  relativePath: string;
  description: string;
  getEffectiveContent: () => Promise<string>;
}

async function checkFileUpdatesCommand(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  pickTargetWorkspaceFolder: () => Promise<vscode.WorkspaceFolder | undefined>,
): Promise<void> {
  const folder = await pickTargetWorkspaceFolder();
  if (!folder) return;

  const resourcesPath = path.join(context.extensionPath, 'resources');
  const workspaceRoot = folder.uri.fsPath;
  const { folders } = await getWorkspaceFolders(folder);
  const folderNames = {
    world: path.relative(workspaceRoot, folders.world) || 'world',
    scripts: path.relative(workspaceRoot, folders.scripts) || 'scripts',
    imports: path.relative(workspaceRoot, folders.imports) || 'imports',
  };

  const agentStatuses = await checkAgentFileVersions(workspaceRoot);
  const readmeStatuses = await checkReadmeVersions(workspaceRoot, folderNames);
  const agentFindings = agentStatuses.filter(
    (s): s is Exclude<AgentFileVersionStatus, { status: 'current' }> => s.status !== 'current',
  );
  const readmeFindings = readmeStatuses.filter(
    (s): s is Exclude<ReadmeVersionStatus, { status: 'current' }> => s.status !== 'current',
  );

  if (agentFindings.length === 0 && readmeFindings.length === 0) {
    void vscode.window.showInformationMessage('LoreFountain: all agent and README files are up to date.');
    return;
  }

  const actionable: ActionableFinding[] = [
    ...agentFindings.map((finding) => reportAgentFinding(finding, outputChannel, resourcesPath)),
    ...readmeFindings.map((finding) => reportReadmeFinding(finding, outputChannel, resourcesPath, folder.name, folderNames)),
  ];
  outputChannel.show();

  const choice = await vscode.window.showInformationMessage(
    `LoreFountain: ${actionable.length} file(s) have updates available. See the "LoreFountain" output channel for details.`,
    'Review & Update...',
  );
  if (choice !== 'Review & Update...') return;

  const picks = await vscode.window.showQuickPick(
    actionable.map((finding) => ({ label: finding.relativePath, description: finding.description, finding })),
    { title: 'Select files to review', canPickMany: true },
  );
  if (!picks || picks.length === 0) return;

  for (const pick of picks) {
    await reviewAndUpdateFile(pick.finding, workspaceRoot);
  }
}

function reportAgentFinding(
  finding: Exclude<AgentFileVersionStatus, { status: 'current' }>,
  outputChannel: vscode.OutputChannel,
  resourcesPath: string,
): ActionableFinding {
  if (finding.status === 'stale') {
    outputChannel.appendLine(`[LoreFountain] ${finding.relativePath}: v${finding.workspaceVersion} → v${finding.currentVersion} available`);
    return {
      relativePath: finding.relativePath,
      description: `v${finding.workspaceVersion} → v${finding.currentVersion}`,
      getEffectiveContent: () => fsp.readFile(path.join(resourcesPath, finding.relativePath), 'utf8'),
    };
  }
  outputChannel.appendLine(
    `[LoreFountain] ${finding.relativePath}: not version-tracked yet (predates this feature) → v${finding.currentVersion} available`,
  );
  return {
    relativePath: finding.relativePath,
    description: `untracked → v${finding.currentVersion}`,
    getEffectiveContent: () => fsp.readFile(path.join(resourcesPath, finding.relativePath), 'utf8'),
  };
}

function reportReadmeFinding(
  finding: Exclude<ReadmeVersionStatus, { status: 'current' }>,
  outputChannel: vscode.OutputChannel,
  resourcesPath: string,
  projectName: string,
  folderNames: { world: string; scripts: string; imports: string },
): ActionableFinding {
  const getEffectiveContent = async (): Promise<string> => {
    const raw = await fsp.readFile(path.join(resourcesPath, 'readmes', finding.templateName), 'utf8');
    return renderReadmeTemplate(raw, projectName, folderNames);
  };

  if (finding.status === 'stale') {
    outputChannel.appendLine(`[LoreFountain] ${finding.relativePath}: v${finding.workspaceVersion} → v${finding.currentVersion} available`);
    return { relativePath: finding.relativePath, description: `v${finding.workspaceVersion} → v${finding.currentVersion}`, getEffectiveContent };
  }
  outputChannel.appendLine(
    `[LoreFountain] ${finding.relativePath}: not version-tracked yet (predates this feature) → v${finding.currentVersion} available`,
  );
  return { relativePath: finding.relativePath, description: `untracked → v${finding.currentVersion}`, getEffectiveContent };
}

async function reviewAndUpdateFile(finding: ActionableFinding, workspaceRoot: string): Promise<void> {
  const workspacePath = path.join(workspaceRoot, finding.relativePath);
  const effectiveContent = await finding.getEffectiveContent();
  const proposed = await vscode.workspace.openTextDocument({ content: effectiveContent, language: 'markdown' });

  await vscode.commands.executeCommand(
    'vscode.diff',
    vscode.Uri.file(workspacePath),
    proposed.uri,
    `${finding.relativePath} (yours ↔ current template)`,
  );

  const confirm = await vscode.window.showWarningMessage(
    `Replace your copy of "${finding.relativePath}" with the current template? This overwrites the whole file — copy anything you want to keep out of the diff first.`,
    { modal: true },
    'Replace with Current Template',
  );
  if (confirm !== 'Replace with Current Template') return;

  await fsp.writeFile(workspacePath, effectiveContent, 'utf8');
  void vscode.window.showInformationMessage(`LoreFountain: updated "${finding.relativePath}".`);
}
