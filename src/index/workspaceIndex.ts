/**
 * Per-workspace-folder index lifecycle: owns the sql.js {@link IndexStore} for
 * one workspace folder, builds it from disk, and keeps it current via
 * `vscode.FileSystemWatcher`s scoped to that folder's `world/` and `scripts/`
 * trees (Spec §2.2 — "incremental updates on file save"). This is the
 * `vscode`-facing activation glue on top of the pure `src/index/build.ts`
 * logic; it is not covered by the vitest unit suite (that would require the
 * extension host — @vscode/test-electron, not yet set up) and should be
 * exercised manually via the F5 Extension Development Host until that lands.
 */

import * as path from 'node:path';
import * as vscode from 'vscode';
import { getWorkspaceFolders } from '../config/workspaceConfig';
import { buildIndexFromDisk, reindexFile, removeFileFromIndex, type IndexBuildSummary } from './build';
import { createSqlJsIndexStore } from './sqlJsStore';
import type { IndexStore } from './store';

type WorldFileKind = 'entity' | 'glossary' | 'skip';

export class WorkspaceIndex implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];

  private constructor(
    public readonly folder: vscode.WorkspaceFolder,
    public readonly store: IndexStore,
    private readonly outputChannel: vscode.OutputChannel,
  ) {}

  /**
   * Create and populate an index for a workspace folder, and start watching
   * its `world/` and `scripts/` trees for incremental updates.
   *
   * @param folder - The workspace folder to index.
   * @param outputChannel - Channel to log build issues and watcher activity to.
   * @returns The ready-to-use index (already built once from disk).
   */
  static async create(
    folder: vscode.WorkspaceFolder,
    outputChannel: vscode.OutputChannel,
  ): Promise<WorkspaceIndex> {
    const store = await createSqlJsIndexStore();
    const index = new WorkspaceIndex(folder, store, outputChannel);
    await index.registerWatchers();
    return index;
  }

  /** Clear and fully re-walk this folder's `world/`, `glossary/`, and `scripts/` folders. */
  async rebuild(): Promise<IndexBuildSummary> {
    this.store.clear();
    const { folders, configIssue } = await getWorkspaceFolders(this.folder);
    if (configIssue) {
      this.outputChannel.appendLine(`[LoreFountain] ${this.folder.name}: ${configIssue}`);
    }
    const summary = await buildIndexFromDisk(this.store, {
      world: folders.world,
      glossary: folders.glossary,
      scripts: folders.scripts,
    });
    this.logSummary(summary);
    return summary;
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.store.dispose();
  }

  private async registerWatchers(): Promise<void> {
    const { folders } = await getWorkspaceFolders(this.folder);

    const worldPattern = new vscode.RelativePattern(vscode.Uri.file(folders.world), '**/*.md');
    const worldWatcher = vscode.workspace.createFileSystemWatcher(worldPattern);
    worldWatcher.onDidCreate((uri) => void this.handleWorldChange(uri, folders.world));
    worldWatcher.onDidChange((uri) => void this.handleWorldChange(uri, folders.world));
    worldWatcher.onDidDelete((uri) => this.handleWorldDelete(uri, folders.world));
    this.disposables.push(worldWatcher);

    const scriptsPattern = new vscode.RelativePattern(vscode.Uri.file(folders.scripts), '**/*.fountain');
    const scriptsWatcher = vscode.workspace.createFileSystemWatcher(scriptsPattern);
    scriptsWatcher.onDidCreate((uri) => void this.handleReindex(uri.fsPath, 'script'));
    scriptsWatcher.onDidChange((uri) => void this.handleReindex(uri.fsPath, 'script'));
    scriptsWatcher.onDidDelete((uri) => removeFileFromIndex(this.store, uri.fsPath, 'script'));
    this.disposables.push(scriptsWatcher);
  }

  private async handleWorldChange(uri: vscode.Uri, worldPath: string): Promise<void> {
    const kind = classifyWorldFile(uri.fsPath, worldPath);
    if (kind === 'skip') return;
    await this.handleReindex(uri.fsPath, kind);
  }

  private handleWorldDelete(uri: vscode.Uri, worldPath: string): void {
    const kind = classifyWorldFile(uri.fsPath, worldPath);
    if (kind === 'skip') return;
    removeFileFromIndex(this.store, uri.fsPath, kind);
  }

  private async handleReindex(filePath: string, kind: 'entity' | 'glossary' | 'script'): Promise<void> {
    const result = await reindexFile(this.store, filePath, kind);
    if (!result.ok) {
      this.outputChannel.appendLine(`[LoreFountain] SKIPPED (${result.reason}) ${filePath}: ${result.message}`);
      return;
    }
    for (const warning of result.warnings) {
      this.outputChannel.appendLine(`[LoreFountain] WARNING ${filePath}: ${warning.message}`);
    }
    for (const relation of result.danglingRelations) {
      this.outputChannel.appendLine(
        `[LoreFountain] WARNING ${filePath}: relation "${relation.relationType}" targets unknown entity "${relation.target}".`,
      );
    }
  }

  private logSummary(summary: IndexBuildSummary): void {
    this.outputChannel.appendLine(
      `[LoreFountain] ${this.folder.name}: ${summary.entityCount} entities, ${summary.glossaryCount} glossary terms, ${summary.scriptCount} scripts indexed.`,
    );
    for (const issue of summary.malformed) {
      this.outputChannel.appendLine(`[LoreFountain] SKIPPED (${issue.reason}) ${issue.filePath}: ${issue.message}`);
    }
    for (const entry of summary.warnings) {
      for (const warning of entry.warnings) {
        this.outputChannel.appendLine(`[LoreFountain] WARNING ${entry.filePath}: ${warning.message}`);
      }
    }
    for (const relation of summary.danglingRelations) {
      this.outputChannel.appendLine(
        `[LoreFountain] WARNING ${relation.filePath}: relation "${relation.relationType}" targets unknown entity "${relation.target}".`,
      );
    }
  }
}

/**
 * Classify a changed file path within `world/` as an entity, a glossary
 * term, or something to skip (the reserved `timeline/`/`notes/` subfolders,
 * per Spec §5/§13.4 — timeline events have no model yet, and notes are
 * deliberately never indexed).
 */
function classifyWorldFile(filePath: string, worldPath: string): WorldFileKind {
  const relative = path.relative(worldPath, filePath);
  const [firstSegment] = relative.split(path.sep);
  if (firstSegment === 'glossary') return 'glossary';
  if (firstSegment === 'timeline' || firstSegment === 'notes') return 'skip';
  return 'entity';
}
