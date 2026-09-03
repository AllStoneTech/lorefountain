/**
 * "How to use this" help: a `$(question)` item that opens a bundled Markdown
 * doc (`resources/help/*.md`) explaining a feature. The World, Scripts, and
 * Continuity views each get one in their title bar's `navigation` group;
 * the five Pro export/graph features (which aren't views, so have no title
 * bar of their own) each get one in whichever menu their own command
 * already lives in, in a non-`navigation` overflow group rather than a
 * sixth/seventh toolbar icon (`package.json`'s `contributes.menus`). The
 * Asset Manifest, Story Card, and Story Overview custom editors each get one
 * in their own editor title bar, gated by `when: "activeCustomEditorId ==
 * '...'"` — the custom-editor equivalent of a tree view's title bar, and the
 * same placement idea applied to a webview instead of a `TreeView`.
 *
 * `HELP_TOPICS` is the only place a new topic needs registering — this file
 * loops it generically, nothing hardcodes a count.
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
import { registerTrackedCommand } from '../telemetry/trackedCommands';
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
  { command: 'lorefountain.showEntityGraphHelp', docFile: 'entityGraph.md', title: 'Help: Entity Graph' },
  { command: 'lorefountain.showStoryBibleHelp', docFile: 'storyBible.md', title: 'Help: Story-Bible Export' },
  { command: 'lorefountain.showBBCRadioScriptHelp', docFile: 'bbcRadioScript.md', title: 'Help: BBC Radio Drama Export' },
  { command: 'lorefountain.showCueSheetHelp', docFile: 'cueSheet.md', title: 'Help: SFX/Cue-Sheet Export' },
  { command: 'lorefountain.showShotListHelp', docFile: 'shotList.md', title: 'Help: Shot List Export' },
  { command: 'lorefountain.showAssetManifestHelp', docFile: 'assetManifest.md', title: 'Help: Asset Manifests' },
  { command: 'lorefountain.showStoryCardHelp', docFile: 'storyCard.md', title: 'Help: Story Card' },
  { command: 'lorefountain.showStoryOverviewHelp', docFile: 'storyOverview.md', title: 'Help: Story Overview' },
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
      registerTrackedCommand(context, topic.command, () => void showHelpPanel(topic, helpResourcesPath)),
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
