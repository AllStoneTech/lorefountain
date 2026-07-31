/**
 * Story Overview custom editor (ADR-0029): a `CustomTextEditorProvider` over
 * `world/OVERVIEW.md`, mirroring `storyCardEditorProvider.ts`'s pattern
 * (plain `TextDocument` underneath, so file watching/dirty-state/undo/save
 * all go through VS Code's normal machinery). Registered against a selector
 * precise enough (`**\/world/OVERVIEW.md`, package.json) that it doesn't
 * collide with the Story Card editor's broader `**\/world/*.md` selector.
 *
 * A malformed file (invalid frontmatter) leaves the webview showing its last
 * good state rather than a broken form — same "never crash, never guess"
 * posture as Story Card (Spec §23).
 */

import * as crypto from 'node:crypto';
import * as vscode from 'vscode';
import { parseStoryOverviewFile, serializeStoryOverview, type StoryOverview } from '../model/storyOverview';
import { applyFormStateToStoryOverview, storyOverviewToFormState, type StoryOverviewFormState } from './storyOverviewForm';
import { buildStoryOverviewHtml } from './storyOverviewHtml';

/** The view type this provider registers under (must match package.json's `customEditors` contribution). */
export const STORY_OVERVIEW_VIEW_TYPE = 'lorefountain.storyOverview';

/** Messages the webview's client script sends back to the extension host. */
type WebviewInboundMessage = { type: 'ready' } | { type: 'edit'; formState: StoryOverviewFormState };

/**
 * Create the Story Overview `CustomTextEditorProvider`.
 *
 * @returns A provider to register for {@link STORY_OVERVIEW_VIEW_TYPE}.
 */
export function createStoryOverviewEditorProvider(): vscode.CustomTextEditorProvider {
  return {
    resolveCustomTextEditor(document, webviewPanel) {
      webviewPanel.webview.options = { enableScripts: true };
      const nonce = crypto.randomBytes(16).toString('base64');
      webviewPanel.webview.html = buildStoryOverviewHtml(webviewPanel.webview.cspSource, nonce);

      const postState = (): void => {
        const overview = parseCurrentOverview(document);
        if (!overview) return; // malformed — leave the webview showing its last good state
        void webviewPanel.webview.postMessage({ type: 'update', formState: storyOverviewToFormState(overview) });
      };

      const changeSubscription = vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.uri.toString() === document.uri.toString()) {
          postState();
        }
      });

      const messageSubscription = webviewPanel.webview.onDidReceiveMessage(async (message: WebviewInboundMessage) => {
        if (message.type === 'ready') {
          postState();
        } else if (message.type === 'edit') {
          await applyEdit(document, message.formState);
        }
      });

      webviewPanel.onDidDispose(() => {
        changeSubscription.dispose();
        messageSubscription.dispose();
      });
    },
  };
}

/** Parse the document's current text into a {@link StoryOverview}, or `undefined` if it's currently malformed. */
function parseCurrentOverview(document: vscode.TextDocument): StoryOverview | undefined {
  const result = parseStoryOverviewFile(document.getText(), document.uri.fsPath);
  return result.ok ? result.overview : undefined;
}

/** Apply an edited form state to the document via a whole-document `WorkspaceEdit`. */
async function applyEdit(document: vscode.TextDocument, formState: StoryOverviewFormState): Promise<void> {
  const overview = parseCurrentOverview(document);
  if (!overview) return;

  const updated = applyFormStateToStoryOverview(overview, formState);
  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), serializeStoryOverview(updated));
  await vscode.workspace.applyEdit(edit);
}
