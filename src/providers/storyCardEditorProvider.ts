/**
 * Story Card custom editor (Spec §6.1): the default authoring surface for
 * entity `.md` files, backed by a `CustomTextEditorProvider` over the plain
 * `TextDocument` — so file watching, dirty-state, undo/redo, and save all go
 * through VS Code's normal text-document machinery, and a power user can
 * still "Reopen Editor With…" the plain text editor at any time (files remain
 * plain Markdown/YAML on disk regardless — Spec §2.1). Thin `vscode`-facing
 * wrapper over the pure logic in `storyCardForm.ts`; not covered by the
 * vitest unit suite (would require the extension host) — verify manually via
 * the F5 Extension Development Host.
 *
 * A malformed file (invalid frontmatter) shows a plain-text fallback message
 * in the webview rather than a broken form, with no attempt to auto-repair —
 * consistent with §23's "never crash, never guess."
 */

import * as crypto from 'node:crypto';
import * as vscode from 'vscode';
import { idFromFilePath } from '../model/slug';
import { parseEntityFile, serializeEntity, type Entity, type EntityType } from '../model/entity';
import type { IndexStore } from '../index/store';
import { applyFormStateToEntity, entityToFormState, type EntityFormState } from './storyCardForm';
import { buildStoryCardHtml } from './storyCardHtml';

/** The view type this provider registers under (must match package.json's `customEditors` contribution). */
export const STORY_CARD_VIEW_TYPE = 'lorefountain.storyCard';

/** One entity offered to the webview's relationship/parent-location pickers. */
export interface StoryCardEntityCandidate {
  id: string;
  name: string;
  kind: EntityType;
}

/** Messages the webview's client script sends back to the extension host. */
type WebviewInboundMessage = { type: 'ready' } | { type: 'edit'; formState: EntityFormState };

/**
 * Create the Story Card `CustomTextEditorProvider`.
 *
 * @param getStoreForDocument - Resolves the index for a given document's workspace folder, for populating relationship/parent-location candidates.
 * @returns A provider to register for {@link STORY_CARD_VIEW_TYPE}.
 */
export function createStoryCardEditorProvider(
  getStoreForDocument: (document: vscode.TextDocument) => IndexStore | undefined,
): vscode.CustomTextEditorProvider {
  return {
    resolveCustomTextEditor(document, webviewPanel) {
      webviewPanel.webview.options = { enableScripts: true };
      const nonce = crypto.randomBytes(16).toString('base64');
      webviewPanel.webview.html = buildStoryCardHtml(webviewPanel.webview.cspSource, nonce);

      const postState = (): void => {
        const entity = parseCurrentEntity(document);
        if (!entity) return; // malformed — leave the webview showing its last good state
        void webviewPanel.webview.postMessage({
          type: 'update',
          formState: entityToFormState(entity),
          entityCandidates: listCandidates(getStoreForDocument(document)),
        });
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

/** Parse the document's current text into an {@link Entity}, or `undefined` if it's currently malformed. */
function parseCurrentEntity(document: vscode.TextDocument): Entity | undefined {
  const id = idFromFilePath(document.uri.fsPath);
  const result = parseEntityFile(document.getText(), { id, filePath: document.uri.fsPath });
  return result.ok ? result.entity : undefined;
}

/** Every entity currently in the index, as relationship/parent-location picker candidates. */
function listCandidates(store: IndexStore | undefined): StoryCardEntityCandidate[] {
  if (!store) return [];
  return store.listEntities().map((entity) => ({ id: entity.id, name: entity.name, kind: entity.type }));
}

/** Apply an edited form state to the document via a whole-document `WorkspaceEdit`. */
async function applyEdit(document: vscode.TextDocument, formState: EntityFormState): Promise<void> {
  const entity = parseCurrentEntity(document);
  if (!entity) return;

  const updated = applyFormStateToEntity(entity, formState);
  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), serializeEntity(updated));
  await vscode.workspace.applyEdit(edit);
}
