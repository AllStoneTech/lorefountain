/**
 * "Check for LoreFountain File Updates" command: `scaffoldAgentFilesIfAbsent`
 * (`src/config/agentFiles.ts`) and `scaffoldReadmesIfAbsent`
 * (`src/config/readmeFiles.ts`) each copy their templates into a workspace
 * once and never touch them again, so both silently drift from the bundled
 * templates as LoreFountain evolves. This command surfaces that drift for
 * both categories together (`checkAgentFileVersions`/`checkReadmeVersions`)
 * and lets the writer review each stale *or missing* file in a real diff
 * view before choosing, per file, whether to replace or create it — never a
 * silent bulk write, matching the "never clobber a writer's edits" posture
 * both scaffolders already follow.
 *
 * A `missing` finding (a tracked file never scaffolded into this workspace
 * at all — e.g. `assets/README.md` in a project that predates the
 * asset-manifest feature) goes through the exact same review/diff/confirm
 * path as a `stale` one: `vscode.diff` handles a nonexistent left-hand URI
 * gracefully (shown as an empty "new file"), and the write step already
 * creates any missing parent folder via `fs.mkdir(..., { recursive: true })`
 * — so this command effectively subsumes what "Initialize Workspace" would
 * otherwise be needed for, but per file and with the same explicit
 * confirmation everything else here already requires.
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
import { registerTrackedCommand } from '../telemetry/trackedCommands';

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
    registerTrackedCommand(context, 'lorefountain.checkFileUpdates', () =>
      void checkFileUpdatesCommand(context, outputChannel, pickTargetWorkspaceFolder),
    ),
  );
}

interface ActionableFinding {
  relativePath: string;
  description: string;
  /** `true` for a `missing` finding — never scaffolded into this workspace at all, as opposed to an existing file that's merely stale. Changes the confirmation dialog's wording and the diff view isn't comparing against real prior content. */
  isNew: boolean;
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
    assets: path.relative(workspaceRoot, folders.assets) || 'assets',
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
  const getEffectiveContent = () => fsp.readFile(path.join(resourcesPath, finding.relativePath), 'utf8');

  if (finding.status === 'stale') {
    outputChannel.appendLine(`[LoreFountain] ${finding.relativePath}: v${finding.workspaceVersion} → v${finding.currentVersion} available`);
    return {
      relativePath: finding.relativePath,
      description: `v${finding.workspaceVersion} → v${finding.currentVersion}`,
      isNew: false,
      getEffectiveContent,
    };
  }
  if (finding.status === 'missing') {
    outputChannel.appendLine(`[LoreFountain] ${finding.relativePath}: not created yet → v${finding.currentVersion} available`);
    return {
      relativePath: finding.relativePath,
      description: `not created yet → v${finding.currentVersion}`,
      isNew: true,
      getEffectiveContent,
    };
  }
  outputChannel.appendLine(
    `[LoreFountain] ${finding.relativePath}: not version-tracked yet (predates this feature) → v${finding.currentVersion} available`,
  );
  return {
    relativePath: finding.relativePath,
    description: `untracked → v${finding.currentVersion}`,
    isNew: false,
    getEffectiveContent,
  };
}

function reportReadmeFinding(
  finding: Exclude<ReadmeVersionStatus, { status: 'current' }>,
  outputChannel: vscode.OutputChannel,
  resourcesPath: string,
  projectName: string,
  folderNames: { world: string; scripts: string; imports: string; assets: string },
): ActionableFinding {
  const getEffectiveContent = async (): Promise<string> => {
    const raw = await fsp.readFile(path.join(resourcesPath, 'readmes', finding.templateName), 'utf8');
    return renderReadmeTemplate(raw, projectName, folderNames);
  };

  if (finding.status === 'stale') {
    outputChannel.appendLine(`[LoreFountain] ${finding.relativePath}: v${finding.workspaceVersion} → v${finding.currentVersion} available`);
    return {
      relativePath: finding.relativePath,
      description: `v${finding.workspaceVersion} → v${finding.currentVersion}`,
      isNew: false,
      getEffectiveContent,
    };
  }
  if (finding.status === 'missing') {
    outputChannel.appendLine(`[LoreFountain] ${finding.relativePath}: not created yet → v${finding.currentVersion} available`);
    return {
      relativePath: finding.relativePath,
      description: `not created yet → v${finding.currentVersion}`,
      isNew: true,
      getEffectiveContent,
    };
  }
  outputChannel.appendLine(
    `[LoreFountain] ${finding.relativePath}: not version-tracked yet (predates this feature) → v${finding.currentVersion} available`,
  );
  return { relativePath: finding.relativePath, description: `untracked → v${finding.currentVersion}`, isNew: false, getEffectiveContent };
}

async function reviewAndUpdateFile(finding: ActionableFinding, workspaceRoot: string): Promise<void> {
  const workspacePath = path.join(workspaceRoot, finding.relativePath);
  const effectiveContent = await finding.getEffectiveContent();
  const proposed = await vscode.workspace.openTextDocument({ content: effectiveContent, language: 'markdown' });

  await vscode.commands.executeCommand(
    'vscode.diff',
    vscode.Uri.file(workspacePath),
    proposed.uri,
    finding.isNew ? `${finding.relativePath} (not yet created ↔ current template)` : `${finding.relativePath} (yours ↔ current template)`,
  );

  const confirm = finding.isNew
    ? await vscode.window.showWarningMessage(
        `Create "${finding.relativePath}" from the current template? Any missing parent folder is created too.`,
        { modal: true },
        'Create from Current Template',
      )
    : await vscode.window.showWarningMessage(
        `Replace your copy of "${finding.relativePath}" with the current template? This overwrites the whole file — copy anything you want to keep out of the diff first.`,
        { modal: true },
        'Replace with Current Template',
      );

  // The diff's right-hand side is a throwaway untitled document with nowhere
  // to save to — left open, it looks like unfinished work. Close the tab
  // regardless of the user's choice; the real file was never touched by
  // opening the diff, only by the writeFile below.
  await closeDiffTab(proposed.uri);

  if (confirm !== 'Replace with Current Template' && confirm !== 'Create from Current Template') return;

  // mkdir covers both cases uniformly: a no-op when the folder already
  // exists (the stale-replace path), and the actual folder creation (e.g.
  // assets/) when this file was never scaffolded at all.
  await fsp.mkdir(path.dirname(workspacePath), { recursive: true });
  await fsp.writeFile(workspacePath, effectiveContent, 'utf8');
  void vscode.window.showInformationMessage(`LoreFountain: ${finding.isNew ? 'created' : 'updated'} "${finding.relativePath}".`);
}

/**
 * Close the diff tab opened by {@link reviewAndUpdateFile}, identified by
 * its untitled "proposed content" side — that URI is unique per review, so
 * this can't mistakenly close an unrelated diff. `vscode.diff` has no
 * corresponding "close" command of its own; the tab-groups API is the only
 * way to target one specific open tab.
 *
 * @param proposedUri - The untitled document's URI used as the diff's modified/right-hand side.
 */
async function closeDiffTab(proposedUri: vscode.Uri): Promise<void> {
  const tab = vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .find((t) => t.input instanceof vscode.TabInputTextDiff && t.input.modified.toString() === proposedUri.toString());
  if (tab) await vscode.window.tabGroups.close(tab);
}
