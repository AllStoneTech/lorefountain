/**
 * LoreFountain extension entry point.
 *
 * Owns one {@link WorkspaceIndex} per open workspace folder — built from disk
 * on activation and kept current by a file watcher — the
 * `lorefountain.reindexWorkspace` command for a manual, safe full rebuild
 * (Spec §2.2, §23), and the `lorefountain.initializeWorkspace` command that
 * scaffolds a brand-new project's standard folders and config file.
 *
 * The extension activates on `workspaceContains:**\/*.fountain` or the
 * presence of `lorefountain.config.json` (ADR-0006) — but a completely fresh,
 * empty workspace has neither yet. Command Palette invocation activates an
 * extension regardless of `activationEvents`, so `initializeWorkspace` is the
 * bootstrap path for that case. Multi-root workspaces get one independent
 * index per folder. Feature wiring beyond the index (hover, completion,
 * Story Card editor) is added in later build phases.
 */

import * as fsp from 'node:fs/promises';
import * as vscode from 'vscode';
import { writeDefaultConfigIfAbsent } from './config/configFile';
import { getWorkspaceFolders } from './config/workspaceConfig';
import { WorkspaceIndex } from './index/workspaceIndex';

let outputChannel: vscode.OutputChannel;
const indexes = new Map<string, WorkspaceIndex>();

/**
 * Called by VS Code when the extension is activated.
 *
 * @param context - The extension context provided by the VS Code host.
 */
export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel('LoreFountain');
  context.subscriptions.push(outputChannel);

  context.subscriptions.push(
    vscode.commands.registerCommand('lorefountain.reindexWorkspace', () => void rebuildAllWorkspaceIndexes()),
    vscode.commands.registerCommand('lorefountain.initializeWorkspace', () => void initializeWorkspace()),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders((event) => {
      for (const removed of event.removed) {
        disposeIndexFor(removed);
      }
      for (const added of event.added) {
        void addIndexFor(added);
      }
    }),
  );

  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    void addIndexFor(folder);
  }
}

/**
 * Called by VS Code when the extension is deactivated. Disposes every
 * per-folder index (closing its sql.js database and file watcher).
 */
export function deactivate(): void {
  for (const index of indexes.values()) {
    index.dispose();
  }
  indexes.clear();
}

async function addIndexFor(folder: vscode.WorkspaceFolder): Promise<void> {
  try {
    const index = await WorkspaceIndex.create(folder, outputChannel);
    indexes.set(folder.uri.toString(), index);
    await index.rebuild();
  } catch (err) {
    outputChannel.appendLine(
      `[LoreFountain] Failed to initialize the index for "${folder.name}": ${errorMessage(err)}`,
    );
  }
}

function disposeIndexFor(folder: vscode.WorkspaceFolder): void {
  const key = folder.uri.toString();
  indexes.get(key)?.dispose();
  indexes.delete(key);
}

async function rebuildAllWorkspaceIndexes(): Promise<void> {
  if (indexes.size === 0) {
    void vscode.window.showInformationMessage('LoreFountain: no workspace folder is open.');
    return;
  }

  for (const index of indexes.values()) {
    await index.rebuild();
  }

  let entityCount = 0;
  let glossaryCount = 0;
  for (const index of indexes.values()) {
    const stats = index.store.stats();
    entityCount += stats.entityCount;
    glossaryCount += stats.glossaryCount;
  }

  void vscode.window.showInformationMessage(
    `LoreFountain: indexed ${entityCount} entities and ${glossaryCount} glossary terms. ` +
      'See the "LoreFountain" output channel for details.',
  );
}

/**
 * Scaffold a workspace folder's standard folder structure (Spec §5) and write
 * a default `lorefountain.config.json` if one doesn't already exist. This is
 * the bootstrap path for a brand-new project with no config file and no
 * `.fountain` script yet — reachable via the Command Palette even before the
 * extension would otherwise activate.
 */
async function initializeWorkspace(): Promise<void> {
  const folder = await pickTargetWorkspaceFolder();
  if (!folder) return;

  const { folders } = await getWorkspaceFolders(folder);
  await Promise.all(
    [folders.scripts, folders.world, folders.glossary, folders.timeline, folders.notes, folders.imports].map(
      (dir) => fsp.mkdir(dir, { recursive: true }),
    ),
  );
  const wroteConfig = await writeDefaultConfigIfAbsent(folder.uri.fsPath);

  const existing = indexes.get(folder.uri.toString());
  if (existing) {
    await existing.rebuild();
  } else {
    await addIndexFor(folder);
  }

  void vscode.window.showInformationMessage(
    wroteConfig
      ? `LoreFountain: initialized "${folder.name}" — created lorefountain.config.json and the standard folders.`
      : `LoreFountain: standard folders ensured for "${folder.name}" (lorefountain.config.json already existed).`,
  );
}

/** Resolve which workspace folder a workspace-scoped command should target. */
async function pickTargetWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    void vscode.window.showErrorMessage('LoreFountain: open a folder or workspace first.');
    return undefined;
  }
  if (folders.length === 1) {
    return folders[0];
  }
  return vscode.window.showWorkspaceFolderPick({ placeHolder: 'Select a workspace folder to initialize' });
}

/** Extract a message from an unknown thrown value. */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
