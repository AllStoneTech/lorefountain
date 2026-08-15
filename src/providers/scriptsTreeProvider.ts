/**
 * Scripts sidebar TreeView: one row per script, grouped by the immediate
 * subfolder of `scripts/` it sits in (a "season," by convention — see
 * `index/build.ts`'s {@link deriveScriptGroup}), sorted by `Order` (falling
 * back to filename for scripts with none). Expanding a script reveals its
 * folder's other files (audio, images, notes — anything a writer put
 * alongside it) as plain, generically-openable children; LoreFountain has
 * no awareness of what they are, the same as `imports/`.
 *
 * Supports drag-and-drop reordering within a season: dropping one script
 * onto another in the same group rewrites `Order` in every affected file's
 * title page via `setTitlePageField`, then relies on the existing `scripts/`
 * `FileSystemWatcher` (`workspaceIndex.ts`) to pick up the change and
 * refresh the index — this provider never touches the {@link IndexStore}
 * directly. Cross-group drops (moving a script to a different season) are a
 * known v1 gap, deliberately not handled — silently ignored rather than
 * half-built, since it would mean moving the file, not just rewriting a
 * field.
 *
 * `vscode`-facing glue; not covered by the vitest unit suite (would require
 * the extension host) — verify manually via the F5 Extension Development Host.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { deriveScriptGroup } from '../index/build';
import type { IndexStore, ScriptRecord } from '../index/store';
import { getWorkspaceFolders } from '../config/workspaceConfig';
import { setTitlePageField } from '../model/script';

const DRAG_MIME_TYPE = 'application/vnd.code.tree.lorefountain.scriptsview';

/** One node in the Scripts tree: a workspace folder, a season group, a script, or one of its sibling artifacts. */
export type ScriptsTreeNode =
  | { kind: 'folder'; folder: vscode.WorkspaceFolder }
  | { kind: 'group'; folder: vscode.WorkspaceFolder; group: string }
  | { kind: 'script'; folder: vscode.WorkspaceFolder; script: ScriptRecord }
  | { kind: 'artifact'; folder: vscode.WorkspaceFolder; filePath: string };

/**
 * TreeDataProvider + drag-and-drop controller backing the Scripts sidebar
 * view. Call {@link refresh} to repaint after the underlying index changes.
 */
export class ScriptsTreeProvider
  implements vscode.TreeDataProvider<ScriptsTreeNode>, vscode.TreeDragAndDropController<ScriptsTreeNode>
{
  private readonly changeEmitter = new vscode.EventEmitter<ScriptsTreeNode | undefined>();
  readonly onDidChangeTreeData = this.changeEmitter.event;

  readonly dragMimeTypes = [DRAG_MIME_TYPE];
  readonly dropMimeTypes = [DRAG_MIME_TYPE];

  constructor(private readonly getStoreForFolder: (folder: vscode.WorkspaceFolder) => IndexStore | undefined) {}

  /** Repaint the whole tree (or just one subtree, if `node` is given). */
  refresh(node?: ScriptsTreeNode): void {
    this.changeEmitter.fire(node);
  }

  /** Render a single {@link ScriptsTreeNode} into the `vscode.TreeItem` VS Code actually draws. */
  getTreeItem(node: ScriptsTreeNode): vscode.TreeItem {
    switch (node.kind) {
      case 'folder': {
        const item = new vscode.TreeItem(node.folder.name, vscode.TreeItemCollapsibleState.Expanded);
        item.contextValue = 'lorefountain.scriptsFolder';
        return item;
      }
      case 'group': {
        const item = new vscode.TreeItem(node.group, vscode.TreeItemCollapsibleState.Expanded);
        item.contextValue = 'lorefountain.scriptGroup';
        item.iconPath = new vscode.ThemeIcon('layers');
        return item;
      }
      case 'script': {
        const label = node.script.title ?? path.basename(node.script.filePath, '.fountain');
        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
        item.description = node.script.productionCode;
        item.contextValue = 'lorefountain.script';
        item.iconPath = new vscode.ThemeIcon('file-media');
        item.command = { command: 'vscode.open', title: 'Open', arguments: [vscode.Uri.file(node.script.filePath)] };
        return item;
      }
      case 'artifact': {
        const item = new vscode.TreeItem(path.basename(node.filePath), vscode.TreeItemCollapsibleState.None);
        item.contextValue = 'lorefountain.scriptArtifact';
        item.resourceUri = vscode.Uri.file(node.filePath);
        item.command = { command: 'vscode.open', title: 'Open', arguments: [vscode.Uri.file(node.filePath)] };
        return item;
      }
    }
  }

  /**
   * Resolve the children of `node` (or the tree's roots when `node` is
   * omitted). Root shape depends on workspace layout: a single-folder
   * workspace skips straight to that folder's top-level nodes, a
   * multi-folder workspace shows one folder node per workspace folder first.
   */
  async getChildren(node?: ScriptsTreeNode): Promise<ScriptsTreeNode[]> {
    const folders = vscode.workspace.workspaceFolders ?? [];

    if (!node) {
      return folders.length === 1 ? this.topLevelNodesFor(folders[0]) : folders.map((folder) => ({ kind: 'folder' as const, folder }));
    }
    if (node.kind === 'folder') return this.topLevelNodesFor(node.folder);
    if (node.kind === 'group') return this.scriptsInGroup(node.folder, node.group);
    if (node.kind === 'script') return this.artifactsFor(node.folder, node.script);
    return [];
  }

  private async topLevelNodesFor(folder: vscode.WorkspaceFolder): Promise<ScriptsTreeNode[]> {
    const store = this.getStoreForFolder(folder);
    if (!store) return [];
    const { folders } = await getWorkspaceFolders(folder);

    const groups = new Set<string>();
    const ungrouped: ScriptRecord[] = [];
    for (const script of store.listScripts()) {
      const group = deriveScriptGroup(folders.scripts, script.filePath);
      if (group === '') ungrouped.push(script);
      else groups.add(group);
    }

    const groupNodes: ScriptsTreeNode[] = [...groups].sort().map((group) => ({ kind: 'group', folder, group }));
    const ungroupedNodes: ScriptsTreeNode[] = sortScripts(ungrouped).map((script) => ({ kind: 'script', folder, script }));
    return [...groupNodes, ...ungroupedNodes];
  }

  private async scriptsInGroup(folder: vscode.WorkspaceFolder, group: string): Promise<ScriptsTreeNode[]> {
    const store = this.getStoreForFolder(folder);
    if (!store) return [];
    const { folders } = await getWorkspaceFolders(folder);

    const scripts = store.listScripts().filter((script) => deriveScriptGroup(folders.scripts, script.filePath) === group);
    return sortScripts(scripts).map((script) => ({ kind: 'script', folder, script }));
  }

  /** A script's sibling files in its own folder — audio, images, anything else a writer put there — excluding the script itself and its derived cue sidecar. */
  private async artifactsFor(folder: vscode.WorkspaceFolder, script: ScriptRecord): Promise<ScriptsTreeNode[]> {
    const dir = path.dirname(script.filePath);
    const scriptBasename = path.basename(script.filePath);
    const sidecarBasename = scriptBasename.replace(/\.fountain$/, '.cues.json');

    let entries: import('node:fs').Dirent[];
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return [];
    }

    return entries
      .filter((entry) => entry.isFile() && entry.name !== scriptBasename && entry.name !== sidecarBasename)
      .map((entry) => ({ kind: 'artifact' as const, folder, filePath: path.join(dir, entry.name) }))
      .sort((a, b) => path.basename(a.filePath).localeCompare(path.basename(b.filePath)));
  }

  handleDrag(source: readonly ScriptsTreeNode[], dataTransfer: vscode.DataTransfer): void {
    const scriptNode = source.find((node) => node.kind === 'script');
    if (!scriptNode || scriptNode.kind !== 'script') return;
    dataTransfer.set(DRAG_MIME_TYPE, new vscode.DataTransferItem(scriptNode.script.filePath));
  }

  async handleDrop(target: ScriptsTreeNode | undefined, dataTransfer: vscode.DataTransfer): Promise<void> {
    if (!target || target.kind !== 'script') return;

    const transferItem = dataTransfer.get(DRAG_MIME_TYPE);
    if (!transferItem) return;
    const draggedFilePath = (await transferItem.asString()).trim();
    if (!draggedFilePath || draggedFilePath === target.script.filePath) return;

    const store = this.getStoreForFolder(target.folder);
    if (!store) return;
    const draggedScript = store.getScriptByPath(draggedFilePath);
    if (!draggedScript) return;

    const { folders } = await getWorkspaceFolders(target.folder);
    const draggedGroup = deriveScriptGroup(folders.scripts, draggedScript.filePath);
    const targetGroup = deriveScriptGroup(folders.scripts, target.script.filePath);
    if (draggedGroup !== targetGroup) return; // cross-group moves are a known v1 gap — see the module doc comment.

    const siblings = sortScripts(
      store.listScripts().filter((script) => deriveScriptGroup(folders.scripts, script.filePath) === targetGroup),
    );
    const reordered = siblings.filter((script) => script.filePath !== draggedFilePath);
    const targetIndex = reordered.findIndex((script) => script.filePath === target.script.filePath);
    reordered.splice(targetIndex, 0, draggedScript);

    await Promise.all(
      reordered.map(async (script, index) => {
        const newOrder = index + 1;
        if (script.order === newOrder) return;
        const text = await fsp.readFile(script.filePath, 'utf8');
        await fsp.writeFile(script.filePath, setTitlePageField(text, 'Order', String(newOrder), script.filePath), 'utf8');
      }),
    );
  }
}

/** Sort by `Order` ascending (scripts with none sort after every ordered one), tie-broken by filename. */
function sortScripts(scripts: readonly ScriptRecord[]): ScriptRecord[] {
  return [...scripts].sort((a, b) => {
    const orderA = a.order ?? Number.POSITIVE_INFINITY;
    const orderB = b.order ?? Number.POSITIVE_INFINITY;
    if (orderA !== orderB) return orderA - orderB;
    return path.basename(a.filePath).localeCompare(path.basename(b.filePath));
  });
}
