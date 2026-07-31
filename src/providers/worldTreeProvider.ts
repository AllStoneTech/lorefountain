/**
 * World sidebar TreeView (Spec §6): "Sidebar navigation: Characters /
 * Locations / Factions / Timeline. Each row surfaces its entity's Story Card
 * on selection." Selecting an entity opens it via the Story Card custom
 * editor (Phase D3); selecting a glossary term or Timeline event opens its
 * plain Markdown file (Spec §4.7/§4.6 — both stay lightweight, no custom
 * editor, same posture as glossary). A single "Story Overview" row (the project owner,
 * 2026-07-29) sits above every category when `world/OVERVIEW.md` exists —
 * see `config/storyOverview.ts`.
 *
 * `vscode`-facing glue; not covered by the vitest unit suite (would require
 * the extension host) — verify manually via the F5 Extension Development Host.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { getWorkspaceFolders } from '../config/workspaceConfig';
import type { EntityType } from '../model/entity';
import type { IndexStore } from '../index/store';
import { titleizeSlug } from '../model/slug';
import { STORY_CARD_VIEW_TYPE } from './storyCardEditorProvider';
import { STORY_OVERVIEW_VIEW_TYPE } from './storyOverviewEditorProvider';

/** Exported for reuse by the settings panel, which offers the same categories as show/hide checkboxes. */
export type Category = EntityType | 'glossary' | 'timeline' | 'notes';

/** Exported for reuse by the settings panel — see {@link Category}. */
export const CATEGORIES: readonly Category[] = [
  'character',
  'location',
  'faction',
  'object',
  'concept',
  'arc',
  'glossary',
  'timeline',
  'notes',
];

/** Exported for reuse by the settings panel — see {@link Category}. */
export const CATEGORY_LABELS: Record<Category, string> = {
  character: 'Characters',
  location: 'Locations',
  faction: 'Factions',
  object: 'Objects',
  concept: 'Concepts',
  arc: 'Arcs',
  glossary: 'Glossary',
  timeline: 'Timeline',
  notes: 'Notes',
};

const CATEGORY_ICONS: Record<Category, string> = {
  character: 'person',
  location: 'location',
  faction: 'organization',
  object: 'package',
  concept: 'lightbulb',
  arc: 'bookmark',
  glossary: 'book',
  timeline: 'history',
  notes: 'edit',
};

/** One node in the World tree: a workspace folder, the single Story Overview, a category, an entity, a glossary term, a Timeline event, or a scratch note. */
export type WorldTreeNode =
  | { kind: 'folder'; folder: vscode.WorkspaceFolder }
  | { kind: 'storyOverview'; folder: vscode.WorkspaceFolder; filePath: string }
  | { kind: 'category'; folder: vscode.WorkspaceFolder; category: Category }
  | { kind: 'entity'; folder: vscode.WorkspaceFolder; name: string; filePath: string }
  | { kind: 'glossaryTerm'; folder: vscode.WorkspaceFolder; term: string; filePath: string }
  | { kind: 'timelineEvent'; folder: vscode.WorkspaceFolder; name: string; filePath: string }
  | { kind: 'note'; folder: vscode.WorkspaceFolder; title: string; filePath: string };

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
      case 'storyOverview': {
        const item = new vscode.TreeItem('Story Overview', vscode.TreeItemCollapsibleState.None);
        item.contextValue = 'lorefountain.storyOverview';
        item.iconPath = new vscode.ThemeIcon('book');
        // Explicitly target the Story Overview custom editor, not
        // `vscode.open` — this file sits directly in `world/`, which is also
        // the Story Card custom editor's selector (`**/world/*.md`,
        // package.json). Without an explicit view type here, resolution
        // between two "default"-priority custom editors over overlapping
        // selectors isn't something to rely on.
        item.command = {
          command: 'vscode.openWith',
          title: 'Open',
          arguments: [vscode.Uri.file(node.filePath), STORY_OVERVIEW_VIEW_TYPE],
        };
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
      case 'timelineEvent': {
        const item = new vscode.TreeItem(node.name, vscode.TreeItemCollapsibleState.None);
        item.contextValue = 'lorefountain.timelineEvent';
        item.command = { command: 'vscode.open', title: 'Open', arguments: [vscode.Uri.file(node.filePath)] };
        return item;
      }
      case 'note': {
        const item = new vscode.TreeItem(node.title, vscode.TreeItemCollapsibleState.None);
        item.contextValue = 'lorefountain.note';
        item.command = { command: 'vscode.open', title: 'Open', arguments: [vscode.Uri.file(node.filePath)] };
        return item;
      }
    }
  }

  async getChildren(node?: WorldTreeNode): Promise<WorldTreeNode[]> {
    const folders = vscode.workspace.workspaceFolders ?? [];

    if (!node) {
      return folders.length === 1 ? await categoryNodesFor(folders[0]) : folders.map((folder) => ({ kind: 'folder', folder }));
    }
    if (node.kind === 'folder') {
      return categoryNodesFor(node.folder);
    }
    if (node.kind === 'category') {
      return node.category === 'notes' ? this.notesFor(node.folder) : this.itemsFor(node);
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
    if (node.category === 'timeline') {
      return store
        .listEvents()
        .map((event) => ({ kind: 'timelineEvent', folder: node.folder, name: event.name, filePath: event.filePath }));
    }
    if (node.category === 'notes') return [];
    return store
      .listEntities({ type: node.category })
      .map((entity) => ({ kind: 'entity', folder: node.folder, name: entity.name, filePath: entity.filePath }));
  }

  /**
   * Notes (Spec §13.4) are deliberately never indexed (`src/index/build.ts`),
   * so — unlike every other category — they're listed straight off disk
   * rather than from the {@link IndexStore}.
   */
  private async notesFor(folder: vscode.WorkspaceFolder): Promise<WorldTreeNode[]> {
    const { folders } = await getWorkspaceFolders(folder);

    let entries: import('node:fs').Dirent[];
    try {
      entries = await fsp.readdir(folders.notes, { withFileTypes: true });
    } catch {
      return [];
    }

    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry) => ({
        kind: 'note' as const,
        folder,
        title: titleizeSlug(entry.name.replace(/\.md$/, '')),
        filePath: path.join(folders.notes, entry.name),
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }
}

/**
 * The category rows plus, when it actually exists on disk, a "Story
 * Overview" row above all of them — not shown before `Initialize Workspace`
 * (or a migration pass) has actually scaffolded/written `world/OVERVIEW.md`,
 * so this never links to a file that isn't there yet.
 */
async function categoryNodesFor(folder: vscode.WorkspaceFolder): Promise<WorldTreeNode[]> {
  const { folders, hiddenCategories } = await getWorkspaceFolders(folder);
  const hidden = new Set(hiddenCategories);
  const categoryNodes: WorldTreeNode[] = CATEGORIES.filter((category) => !hidden.has(category)).map((category) => ({
    kind: 'category',
    folder,
    category,
  }));

  const overviewPath = path.join(folders.world, 'OVERVIEW.md');
  if (await pathExists(overviewPath)) {
    return [{ kind: 'storyOverview', folder, filePath: overviewPath }, ...categoryNodes];
  }
  return categoryNodes;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fsp.access(target);
    return true;
  } catch {
    return false;
  }
}
