/**
 * Asset manifest custom editor: the form-based authoring surface for
 * `assets/manifests/{audio,characters,locations,objects,voice}.json`, backed
 * by a `CustomTextEditorProvider` over the plain `TextDocument` — the same
 * pattern as `storyCardEditorProvider.ts`, for the same reasons (file
 * watching, dirty-state, undo/redo, and save all go through VS Code's normal
 * text-document machinery; a power user can still "Reopen Editor With…" the
 * plain JSON editor at any time). Thin `vscode`-facing wrapper over the pure
 * logic in `manifestForm.ts`; not covered by the vitest unit suite (would
 * require the extension host) — verify manually via the F5 Extension
 * Development Host.
 *
 * Unlike a Story Card (one entity per file), a manifest file holds many
 * entries — so where `storyCardEditorProvider.ts` merges an edited form
 * state onto the currently-parsed entity (preserving fields the form doesn't
 * cover), a manifest write is a full replace: `manifestForm.ts`'s form state
 * covers every field the schema allows, so there's nothing left to preserve
 * from the document's prior text.
 *
 * A malformed file (invalid JSON, or JSON that fails that manifest kind's
 * schema) leaves the webview showing its last good state rather than a
 * broken form, with no attempt to auto-repair — consistent with §23's
 * "never crash, never guess."
 */

import * as crypto from 'node:crypto';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { IndexStore } from '../index/store';
import { buildManifestHtml } from './manifestHtml';
import {
  manifestKindFromFileName,
  parseManifestText,
  serializeManifestFormState,
  type ManifestFormState,
  type ManifestKind,
} from './manifestForm';

/** The view type this provider registers under (must match package.json's `customEditors` contribution). */
export const MANIFEST_EDITOR_VIEW_TYPE = 'lorefountain.assetManifest';

/** One entity offered to a manifest's key picker, filtered to the entity type that manifest kind is keyed against. */
export interface ManifestEntityCandidate {
  id: string;
  name: string;
}

/** Messages the webview's client script sends back to the extension host. */
type WebviewInboundMessage = { type: 'ready' } | { type: 'edit'; formState: ManifestFormState };

/**
 * Create the asset manifest `CustomTextEditorProvider`.
 *
 * @param getStoreForDocument - Resolves the index for a given document's workspace folder, for populating each manifest's entity-id key picker.
 * @returns A provider to register for {@link MANIFEST_EDITOR_VIEW_TYPE}.
 */
export function createManifestEditorProvider(
  getStoreForDocument: (document: vscode.TextDocument) => IndexStore | undefined,
): vscode.CustomTextEditorProvider {
  return {
    resolveCustomTextEditor(document, webviewPanel) {
      const kind = manifestKindFromFileName(path.basename(document.uri.fsPath));

      webviewPanel.webview.options = { enableScripts: true };
      const nonce = crypto.randomBytes(16).toString('base64');
      webviewPanel.webview.html = kind
        ? buildManifestHtml(webviewPanel.webview.cspSource, nonce, kind)
        : buildUnrecognizedManifestHtml(webviewPanel.webview.cspSource);
      if (!kind) return; // Shouldn't happen — package.json's selector only matches the five known filenames.

      const postState = (): void => {
        const formState = parseManifestText(kind, document.getText());
        if (!formState) return; // malformed — leave the webview showing its last good state
        void webviewPanel.webview.postMessage({
          type: 'update',
          formState,
          entityCandidates: listCandidatesFor(kind, getStoreForDocument(document)),
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

/** Every known entity of the type a manifest kind is keyed against, for its key picker. `audio` has none — its keys are free-text cue tags, not entity ids. */
function listCandidatesFor(kind: ManifestKind, store: IndexStore | undefined): ManifestEntityCandidate[] {
  if (!store) return [];
  const entityType = kind === 'characters' || kind === 'voice' ? 'character' : kind === 'locations' ? 'location' : kind === 'objects' ? 'object' : undefined;
  if (!entityType) return [];
  return store
    .listEntities()
    .filter((entity) => entity.type === entityType)
    .map((entity) => ({ id: entity.id, name: entity.name }));
}

/** Replace the whole document with the edited form state, re-serialized (see the module doc comment on why this is a full replace, not a merge). */
async function applyEdit(document: vscode.TextDocument, formState: ManifestFormState): Promise<void> {
  const text = serializeManifestFormState(formState);
  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), text);
  await vscode.workspace.applyEdit(edit);
}

/** Minimal fallback for the (unreachable in practice) case where the filename doesn't match any known manifest kind. */
function buildUnrecognizedManifestHtml(cspSource: string): string {
  return `<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource};"></head><body>Unrecognized manifest file.</body></html>`;
}
