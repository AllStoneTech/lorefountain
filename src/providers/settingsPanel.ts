/**
 * Project settings webview panel. The extension's first standalone
 * `vscode.window.createWebviewPanel` — every other webview here (the Story
 * Card) is a `CustomTextEditorProvider` bound to one open document; this one
 * edits `lorefountain.config.json` as a whole, so it isn't backed by a
 * document the same way.
 *
 * v1 scope, deliberately narrow: one checkbox per World-tree category,
 * bound to `world.hiddenCategories`. Folder-path editing (`folders.*`)
 * isn't covered here — nothing edits those via UI today either.
 *
 * No `FileSystemWatcher` on `lorefountain.config.json` — this panel is the
 * only writer, so it calls `onSaved` directly after a successful write
 * instead of waiting to observe its own change on disk.
 */

import * as crypto from 'node:crypto';
import * as vscode from 'vscode';
import { hiddenCategoriesFromConfig, readLoreFountainConfig, writeLoreFountainConfig } from '../config/configFile';
import { buildSettingsHtml } from './settingsHtml';
import { CATEGORIES, CATEGORY_LABELS } from './worldTreeProvider';

/** The view type this panel registers under. */
export const SETTINGS_VIEW_TYPE = 'lorefountain.settings';

/** Messages the webview's client script sends back to the extension host. */
type WebviewInboundMessage = { type: 'ready' } | { type: 'save'; hiddenCategories: string[] };

/** One open settings panel per workspace folder, so a multi-root workspace can have one open per folder without them clobbering each other. */
const openPanels = new Map<string, vscode.WebviewPanel>();

/**
 * Open (or reveal an already-open) settings panel for a workspace folder.
 *
 * @param folder - The workspace folder whose `lorefountain.config.json` this panel edits.
 * @param onSaved - Called after a successful save, so the caller can refresh the World tree.
 */
export function openSettingsPanel(folder: vscode.WorkspaceFolder, onSaved: () => void): void {
  const key = folder.uri.toString();
  const existing = openPanels.get(key);
  if (existing) {
    existing.reveal();
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    SETTINGS_VIEW_TYPE,
    `LoreFountain Settings — ${folder.name}`,
    vscode.ViewColumn.Active,
    { enableScripts: true, retainContextWhenHidden: true },
  );
  openPanels.set(key, panel);

  const nonce = crypto.randomBytes(16).toString('base64');
  const categories = CATEGORIES.map((category) => ({ id: category, label: CATEGORY_LABELS[category] }));
  panel.webview.html = buildSettingsHtml(panel.webview.cspSource, nonce, categories);

  const postState = async (): Promise<void> => {
    const result = await readLoreFountainConfig(folder.uri.fsPath);
    const hiddenCategories = result.ok ? hiddenCategoriesFromConfig(result.config) : [];
    void panel.webview.postMessage({ type: 'init', hiddenCategories });
  };

  const messageSubscription = panel.webview.onDidReceiveMessage(async (message: WebviewInboundMessage) => {
    if (message.type === 'ready') {
      await postState();
    } else if (message.type === 'save') {
      await writeLoreFountainConfig(folder.uri.fsPath, { world: { hiddenCategories: message.hiddenCategories } });
      onSaved();
    }
  });

  panel.onDidDispose(() => {
    messageSubscription.dispose();
    openPanels.delete(key);
  });
}
