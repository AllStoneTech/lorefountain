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
 * text. Both categories go through the same rendered-content path (a
 * read-only virtual document, via {@link ProposedContentProvider}, as the
 * diff's right-hand side) so the two kinds of finding need no special-casing
 * beyond how each renders its "what it should become" text.
 *
 * The diff's right-hand side is deliberately *not* an `untitled:` in-memory
 * document, despite that being the obvious first approach — an untitled
 * document is considered dirty the instant it has content, so closing that
 * tab (done automatically once the writer accepts/declines, see
 * {@link closeDiffTab}) triggered VS Code's "Do you want to save your
 * changes?" prompt on every single review, which reads as "confirm
 * deleting" to a writer who never touched that pane and has no reason to
 * expect a save dialog. A `vscode.TextDocumentContentProvider`-backed
 * virtual document (custom `lorefountain-check-updates:` scheme) is never
 * dirty and has no save affordance at all — the same pattern VS Code's own
 * `git show`/Peek Definition-style read-only previews use — so the tab
 * closes silently either way.
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

const PREVIEW_SCHEME = 'lorefountain-check-updates';

/**
 * Backs the diff view's read-only "what it would become" side. Content is
 * registered via {@link set} immediately before opening the document (which
 * triggers {@link provideTextDocumentContent} once, synchronously) and
 * removed via {@link delete} once that review is done — there's no need to
 * fire `onDidChange` since each URI is used exactly once and never edited.
 */
class ProposedContentProvider implements vscode.TextDocumentContentProvider {
  private readonly content = new Map<string, string>();

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.content.get(uri.toString()) ?? '';
  }

  set(uri: vscode.Uri, text: string): void {
    this.content.set(uri.toString(), text);
  }

  delete(uri: vscode.Uri): void {
    this.content.delete(uri.toString());
  }
}

let previewCounter = 0;

/**
 * Build a fresh, unique preview URI for one file's review — unique per call
 * (not just per file) so reviewing the same relative path more than once in
 * one command invocation can never collide with a stale map entry.
 *
 * @param relativePath - The tracked file's workspace-relative path, used only to make the tab's fallback title readable.
 */
function buildPreviewUri(relativePath: string): vscode.Uri {
  return vscode.Uri.from({ scheme: PREVIEW_SCHEME, path: `/${relativePath.replace(/\\/g, '/')}`, query: String(previewCounter++) });
}

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
  const previewProvider = new ProposedContentProvider();
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(PREVIEW_SCHEME, previewProvider),
    registerTrackedCommand(context, 'lorefountain.checkFileUpdates', () =>
      void checkFileUpdatesCommand(context, outputChannel, pickTargetWorkspaceFolder, previewProvider),
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
  previewProvider: ProposedContentProvider,
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
    await reviewAndUpdateFile(pick.finding, workspaceRoot, previewProvider);
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

async function reviewAndUpdateFile(
  finding: ActionableFinding,
  workspaceRoot: string,
  previewProvider: ProposedContentProvider,
): Promise<void> {
  const workspacePath = path.join(workspaceRoot, finding.relativePath);
  const effectiveContent = await finding.getEffectiveContent();
  const previewUri = buildPreviewUri(finding.relativePath);
  previewProvider.set(previewUri, effectiveContent);

  try {
    await vscode.commands.executeCommand(
      'vscode.diff',
      vscode.Uri.file(workspacePath),
      previewUri,
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

    // Close the diff tab regardless of the user's choice, so nothing lingers
    // looking like unfinished work — safe now that the right-hand side is a
    // read-only virtual document with nothing to save, so this closes
    // silently instead of prompting.
    await closeDiffTab(previewUri);

    if (confirm !== 'Replace with Current Template' && confirm !== 'Create from Current Template') return;

    // mkdir covers both cases uniformly: a no-op when the folder already
    // exists (the stale-replace path), and the actual folder creation (e.g.
    // assets/) when this file was never scaffolded at all.
    await fsp.mkdir(path.dirname(workspacePath), { recursive: true });
    await fsp.writeFile(workspacePath, effectiveContent, 'utf8');
    void vscode.window.showInformationMessage(`LoreFountain: ${finding.isNew ? 'created' : 'updated'} "${finding.relativePath}".`);
  } finally {
    previewProvider.delete(previewUri);
  }
}

/**
 * Close the diff tab opened by {@link reviewAndUpdateFile}, identified by
 * its virtual "proposed content" side — that URI is unique per review, so
 * this can't mistakenly close an unrelated diff. `vscode.diff` has no
 * corresponding "close" command of its own; the tab-groups API is the only
 * way to target one specific open tab.
 *
 * @param previewUri - The virtual document's URI used as the diff's modified/right-hand side.
 */
async function closeDiffTab(previewUri: vscode.Uri): Promise<void> {
  const tab = vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .find((t) => t.input instanceof vscode.TabInputTextDiff && t.input.modified.toString() === previewUri.toString());
  if (tab) await vscode.window.tabGroups.close(tab);
}
