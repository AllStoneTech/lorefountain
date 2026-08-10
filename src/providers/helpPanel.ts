/**
 * Per-view "info" buttons: a `$(question)` icon in the World, Scripts, and
 * Continuity view title bars that opens a bundled Markdown doc
 * (`resources/help/*.md`) explaining how that section is meant to be used
 * and populated.
 *
 * Rendered in a dedicated webview panel (`helpHtml.ts`) rather than VS
 * Code's built-in Markdown preview (`markdown.showPreview`), specifically so
 * the tab reads "Help: <View>" — the built-in preview's tab title is always
 * "Preview <filename>" and isn't overridable through that command.
 *
 * Content lives in `resources/help/*.md`, shipped as-is in the packaged
 * `.vsix` (see `.vscodeignore`) — no per-workspace substitution, since these
 * are read-only reference docs rather than files scaffolded onto disk
 * (contrast `config/readmeFiles.ts`, which does substitute folder names
 * into templates it writes into the user's own project).
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { buildHelpHtml } from './helpHtml';

/** One help topic: the command that opens it, its bundled doc, and the webview panel's title. */
interface HelpTopic {
  command: string;
  docFile: string;
  title: string;
}

const HELP_TOPICS: readonly HelpTopic[] = [
  { command: 'lorefountain.showWorldViewHelp', docFile: 'world.md', title: 'Help: World View' },
  { command: 'lorefountain.showScriptsViewHelp', docFile: 'scripts.md', title: 'Help: Scripts View' },
  { command: 'lorefountain.showContinuityViewHelp', docFile: 'continuity.md', title: 'Help: Continuity View' },
];

/** The view type these panels register under. */
const HELP_VIEW_TYPE = 'lorefountain.help';

/** One open help panel per topic, so re-clicking the same info icon reveals rather than duplicates. */
const openPanels = new Map<string, vscode.WebviewPanel>();

/**
 * Register the three view-title "info" commands.
 *
 * @param context - The extension context to register command disposables against.
 */
export function registerHelpCommands(context: vscode.ExtensionContext): void {
  const helpResourcesPath = path.join(context.extensionPath, 'resources', 'help');

  for (const topic of HELP_TOPICS) {
    context.subscriptions.push(
      vscode.commands.registerCommand(topic.command, () => void showHelpPanel(topic, helpResourcesPath)),
    );
  }
}

/** Open (or reveal an already-open) help panel for one topic. */
async function showHelpPanel(topic: HelpTopic, helpResourcesPath: string): Promise<void> {
  const existing = openPanels.get(topic.command);
  if (existing) {
    existing.reveal();
    return;
  }

  const panel = vscode.window.createWebviewPanel(HELP_VIEW_TYPE, topic.title, vscode.ViewColumn.Active, {
    enableScripts: false,
  });
  openPanels.set(topic.command, panel);

  const markdown = await fsp.readFile(path.join(helpResourcesPath, topic.docFile), 'utf8');
  panel.webview.html = buildHelpHtml(panel.webview.cspSource, topic.title, markdown);

  panel.onDidDispose(() => openPanels.delete(topic.command));
}
