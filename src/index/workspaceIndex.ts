/**
 * Per-workspace-folder index lifecycle: owns the sql.js {@link IndexStore} for
 * one workspace folder, builds it from disk, and keeps it current via a
 * `vscode.FileSystemWatcher` scoped to that folder's `world/` tree (Spec §2.2
 * — "incremental updates on file save"). This is the `vscode`-facing
 * activation glue on top of the pure `src/index/build.ts` logic; it is not
 * covered by the vitest unit suite (that would require the extension host —
 * @vscode/test-electron, not yet set up) and should be exercised manually via
 * the F5 Extension Development Host until that lands.
 */

import * as path from 'node:path';
import * as vscode from 'vscode';
import { getWorkspaceFolders } from '../config/workspaceConfig';
import { buildIndexFromDisk, reindexFile, removeFileFromIndex, type IndexBuildSummary } from './build';
import { createSqlJsIndexStore } from './sqlJsStore';
import type { IndexStore } from './store';

type FileKind = 'entity' | 'glossary' | 'skip';

export class WorkspaceIndex implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];

  private constructor(
    public readonly folder: vscode.WorkspaceFolder,
    public readonly store: IndexStore,
    private readonly outputChannel: vscode.OutputChannel,
  ) {}

  /**
   * Create and populate an index for a workspace folder, and start watching
   * its `world/` tree for incremental updates.
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
    await index.registerWatcher();
    return index;
  }

  /** Clear and fully re-walk this folder's `world/` and `glossary/` folders. */
  async rebuild(): Promise<IndexBuildSummary> {
    this.store.clear();
    const { folders, configIssue } = await getWorkspaceFolders(this.folder);
    if (configIssue) {
      this.outputChannel.appendLine(`[LoreFountain] ${this.folder.name}: ${configIssue}`);
    }
    const summary = await buildIndexFromDisk(this.store, { world: folders.world, glossary: folders.glossary });
    this.logSummary(summary);
    return summary;
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.store.dispose();
  }

  private async registerWatcher(): Promise<void> {
    const { folders } = await getWorkspaceFolders(this.folder);
    const pattern = new vscode.RelativePattern(vscode.Uri.file(folders.world), '**/*.md');
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    watcher.onDidCreate((uri) => void this.handleChange(uri, folders.world));
    watcher.onDidChange((uri) => void this.handleChange(uri, folders.world));
    watcher.onDidDelete((uri) => this.handleDelete(uri, folders.world));

    this.disposables.push(watcher);
  }

  private async handleChange(uri: vscode.Uri, worldPath: string): Promise<void> {
    const kind = classify(uri.fsPath, worldPath);
    if (kind === 'skip') return;

    const result = await reindexFile(this.store, uri.fsPath, kind);
    if (!result.ok) {
      this.outputChannel.appendLine(`[LoreFountain] SKIPPED (${result.reason}) ${uri.fsPath}: ${result.message}`);
      return;
    }
    for (const warning of result.warnings) {
      this.outputChannel.appendLine(`[LoreFountain] WARNING ${uri.fsPath}: ${warning.message}`);
    }
  }

  private handleDelete(uri: vscode.Uri, worldPath: string): void {
    const kind = classify(uri.fsPath, worldPath);
    if (kind === 'skip') return;
    removeFileFromIndex(this.store, uri.fsPath, kind);
  }

  private logSummary(summary: IndexBuildSummary): void {
    this.outputChannel.appendLine(
      `[LoreFountain] ${this.folder.name}: ${summary.entityCount} entities, ${summary.glossaryCount} glossary terms indexed.`,
    );
    for (const issue of summary.malformed) {
      this.outputChannel.appendLine(`[LoreFountain] SKIPPED (${issue.reason}) ${issue.filePath}: ${issue.message}`);
    }
    for (const entry of summary.warnings) {
      for (const warning of entry.warnings) {
        this.outputChannel.appendLine(`[LoreFountain] WARNING ${entry.filePath}: ${warning.message}`);
      }
    }
  }
}

/**
 * Classify a changed file path as an entity, a glossary term, or something to
 * skip (the reserved `timeline/`/`notes/` subfolders, per Spec §5/§13.4 —
 * timeline events have no model yet, and notes are deliberately never indexed).
 */
function classify(filePath: string, worldPath: string): FileKind {
  const relative = path.relative(worldPath, filePath);
  const [firstSegment] = relative.split(path.sep);
  if (firstSegment === 'glossary') return 'glossary';
  if (firstSegment === 'timeline' || firstSegment === 'notes') return 'skip';
  return 'entity';
}
