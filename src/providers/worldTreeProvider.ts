/**
 * World sidebar TreeView (Spec §6): "Sidebar navigation: Characters /
 * Locations / Factions / ... . Each row surfaces its entity's Story Card on
 * selection." Selecting an entity opens it via the Story Card custom editor
 * (Phase D3); selecting a glossary term opens its plain Markdown file (Spec
 * §4.7 — glossary stays lightweight, no custom editor).
 *
 * Scope note: the spec's TreeView row lists a "Timeline" category alongside
 * Characters/Locations/Factions, but no Event/timeline entity model exists
 * yet (`world/timeline/` is still explicitly unindexed, per §5/§13.4-adjacent
 * scope decisions carried since Phase B) — omitted here rather than shown
 * empty, until that model exists.
 *
 * `vscode`-facing glue; not covered by the vitest unit suite (would require
 * the extension host) — verify manually via the F5 Extension Development Host.
 */

import * as vscode from 'vscode';
import type { EntityType } from '../model/entity';
import type { IndexStore } from '../index/store';
import { STORY_CARD_VIEW_TYPE } from './storyCardEditorProvider';

type Category = EntityType | 'glossary';

const CATEGORIES: readonly Category[] = ['character', 'location', 'faction', 'object', 'concept', 'glossary'];

const CATEGORY_LABELS: Record<Category, string> = {
  character: 'Characters',
  location: 'Locations',
  faction: 'Factions',
  object: 'Objects',
  concept: 'Concepts',
  glossary: 'Glossary',
};

const CATEGORY_ICONS: Record<Category, string> = {
  character: 'person',
  location: 'location',
  faction: 'organization',
  object: 'package',
  concept: 'lightbulb',
  glossary: 'book',
};

/** One node in the World tree: a workspace folder, a category, an entity, or a glossary term. */
export type WorldTreeNode =
  | { kind: 'folder'; folder: vscode.WorkspaceFolder }
  | { kind: 'category'; folder: vscode.WorkspaceFolder; category: Category }
  | { kind: 'entity'; folder: vscode.WorkspaceFolder; name: string; filePath: string }
  | { kind: 'glossaryTerm'; folder: vscode.WorkspaceFolder; term: string; filePath: string };

/**
 * TreeDataProvider backing the World sidebar view. Call {@link refresh} to
 * repaint after the underlying index changes.
 */
export class WorldTreeProvider implements vscode.TreeDataProvider<WorldTreeNode> {
  private readonly changeEmitter = new vscode.EventEmitter<WorldTreeNode | undefined>();
  readonly onDidChangeTreeData = this.changeEmitter.event;

  constructor(private readonly getStoreForFolder: (folder: vscode.WorkspaceFolder) => IndexStore | undefined) {}

  /** Repaint the whole tree (or just one subtree, if `node` is given). */
  refresh(node?: WorldTreeNode): void {
    this.changeEmitter.fire(node);
  }

  getTreeItem(node: WorldTreeNode): vscode.TreeItem {
    switch (node.kind) {
      case 'folder': {
        const item = new vscode.TreeItem(node.folder.name, vscode.TreeItemCollapsibleState.Expanded);
        item.contextValue = 'lorefountain.folder';
        return item;
      }
      case 'category': {
        const item = new vscode.TreeItem(CATEGORY_LABELS[node.category], vscode.TreeItemCollapsibleState.Collapsed);
        item.contextValue = `lorefountain.category.${node.category}`;
        item.iconPath = new vscode.ThemeIcon(CATEGORY_ICONS[node.category]);
        return item;
      }
      case 'entity': {
        const item = new vscode.TreeItem(node.name, vscode.TreeItemCollapsibleState.None);
        item.contextValue = 'lorefountain.entity';
        item.command = {
          command: 'vscode.openWith',
          title: 'Open Story Card',
          arguments: [vscode.Uri.file(node.filePath), STORY_CARD_VIEW_TYPE],
        };
        return item;
      }
      case 'glossaryTerm': {
        const item = new vscode.TreeItem(node.term, vscode.TreeItemCollapsibleState.None);
        item.contextValue = 'lorefountain.glossaryTerm';
        item.command = { command: 'vscode.open', title: 'Open', arguments: [vscode.Uri.file(node.filePath)] };
        return item;
      }
    }
  }

  getChildren(node?: WorldTreeNode): WorldTreeNode[] {
    const folders = vscode.workspace.workspaceFolders ?? [];

    if (!node) {
      return folders.length === 1 ? categoryNodesFor(folders[0]) : folders.map((folder) => ({ kind: 'folder', folder }));
    }
    if (node.kind === 'folder') {
      return categoryNodesFor(node.folder);
    }
    if (node.kind === 'category') {
      return this.itemsFor(node);
    }
    return [];
  }

  private itemsFor(node: { folder: vscode.WorkspaceFolder; category: Category }): WorldTreeNode[] {
    const store = this.getStoreForFolder(node.folder);
    if (!store) return [];

    if (node.category === 'glossary') {
      return store
        .listGlossaryTerms()
        .map((term) => ({ kind: 'glossaryTerm', folder: node.folder, term: term.term, filePath: term.filePath }));
    }
    return store
      .listEntities({ type: node.category })
      .map((entity) => ({ kind: 'entity', folder: node.folder, name: entity.name, filePath: entity.filePath }));
  }
}

function categoryNodesFor(folder: vscode.WorkspaceFolder): WorldTreeNode[] {
  return CATEGORIES.map((category) => ({ kind: 'category', folder, category }));
}
