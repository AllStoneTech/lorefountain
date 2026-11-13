/**
 * Style bible guided editor (ADR-0047): a `CustomTextEditorProvider` over a
 * project's `style.lf.md`, in the pattern of `storyOverviewEditorProvider.ts`.
 * The plain `TextDocument` stays underneath, so file watching, dirty state,
 * undo/redo and save all use VS Code's text model; each form change is one
 * whole-document `WorkspaceEdit`, which is one undo step.
 *
 * All decisions about what the file says are in `styleBibleForm.ts`. This glue
 * validates messages from the webview (zod), runs the file dialog for
 * reference images, checks which reference images exist, and offers
 * "Open as text". A file that can't be parsed shows an inline error with the
 * schema's messages instead of a form. Not covered by the vitest suite (needs
 * the extension host); verify in the Extension Development Host.
 *
 * Registered against `**\/*.lf.md` in package.json, so it works for any world
 * folder name. Overlap with the Story Card selector (`**\/world/*.md`) is
 * handled three ways: explicit view type wherever the extension opens the file,
 * an editor association default in package.json, and the Story Card provider's
 * own redirect (see `storyCardEditorProvider.ts`).
 */

import * as crypto from 'node:crypto';
import * as fsp from 'node:fs/promises';
import * as vscode from 'vscode';
import { KNOWN_STYLE_MEDIA } from 'lorefountain-core/model/styleBible';
import { resolveReferenceImage } from 'lorefountain-core/project/styleBible';
import { STYLE_BIBLE_VIEW_TYPE } from './projectDocumentEditors';
import { buildStyleBibleHtml } from './styleBibleHtml';
import {
  applyFormStateToText,
  BODY_SECTIONS,
  styleBibleToFormState,
  styleFormStateSchema,
  toProjectRelativePath,
  validateFormState,
  type ReferenceStatus,
  type StyleFormState,
} from './styleBibleForm';
import { ASPECT_RATIO_PRESETS, BOOK_TRIM_PRESETS, COMIC_TRIM_PRESETS, formatKindFor } from './styleBiblePresets';

export { STYLE_BIBLE_VIEW_TYPE };

/** Messages the webview's client script sends to the extension host. */
type WebviewInboundMessage =
  | { type: 'ready' }
  | { type: 'edit'; formState: unknown }
  | { type: 'pickReference' }
  | { type: 'openAsText' };

/**
 * Create the style bible `CustomTextEditorProvider`.
 *
 * @returns A provider to register for {@link STYLE_BIBLE_VIEW_TYPE}.
 */
export function createStyleBibleEditorProvider(): vscode.CustomTextEditorProvider {
  return {
    resolveCustomTextEditor(document, webviewPanel) {
      webviewPanel.webview.options = { enableScripts: true };
      const nonce = crypto.randomBytes(16).toString('base64');
      webviewPanel.webview.html = buildStyleBibleHtml(webviewPanel.webview.cspSource, nonce);
      const projectRoot = (): string | undefined => vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;

      const postState = async (): Promise<void> => {
        const read = styleBibleToFormState(document.getText(), document.uri.fsPath);
        const common = {
          type: 'update',
          sections: BODY_SECTIONS,
          presets: { aspect: ASPECT_RATIO_PRESETS, comicTrim: COMIC_TRIM_PRESETS, bookTrim: BOOK_TRIM_PRESETS },
          knownMedia: KNOWN_STYLE_MEDIA,
          formatKinds: Object.fromEntries(KNOWN_STYLE_MEDIA.map((medium) => [medium, formatKindFor(medium)])),
        };
        if (!read.ok) {
          void webviewPanel.webview.postMessage({ ...common, error: { message: read.message, issues: read.issues } });
          return;
        }
        const referenceStatus = await referenceStatusFor(read.state, projectRoot());
        void webviewPanel.webview.postMessage({
          ...common,
          state: read.state,
          issues: validateFormState(read.state, referenceStatus),
        });
      };

      const changeSubscription = vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.uri.toString() === document.uri.toString()) void postState();
      });

      const messageSubscription = webviewPanel.webview.onDidReceiveMessage(async (message: WebviewInboundMessage) => {
        try {
          switch (message.type) {
            case 'ready':
              await postState();
              break;
            case 'edit':
              await applyEdit(document, message.formState, postState);
              break;
            case 'pickReference': {
              const picked = await pickReferenceImage(projectRoot());
              if (picked !== undefined) void webviewPanel.webview.postMessage({ type: 'referencePicked', path: picked });
              break;
            }
            case 'openAsText':
              await vscode.commands.executeCommand('vscode.openWith', document.uri, 'default');
              break;
          }
        } catch (err) {
          void vscode.window.showErrorMessage(
            `LoreFountain: the style bible editor hit a problem: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      });

      webviewPanel.onDidDispose(() => {
        changeSubscription.dispose();
        messageSubscription.dispose();
      });
    },
  };
}

/** Existence and location of each reference image, for the form's inline warnings. */
async function referenceStatusFor(state: StyleFormState, projectRoot: string | undefined): Promise<Record<string, ReferenceStatus>> {
  const status: Record<string, ReferenceStatus> = {};
  if (projectRoot === undefined) return status;
  for (const entry of state.referenceImages) {
    const reference = resolveReferenceImage(entry, projectRoot);
    if (reference.kind === 'remote') status[entry] = 'remote';
    else if (reference.kind === 'outside-project') status[entry] = 'outside';
    else {
      try {
        status[entry] = (await fsp.stat(reference.absolutePath ?? '')).isFile() ? 'ok' : 'missing';
      } catch {
        status[entry] = 'missing';
      }
    }
  }
  return status;
}

/** Ask for a file inside the project and return its project-relative path. */
async function pickReferenceImage(projectRoot: string | undefined): Promise<string | undefined> {
  if (projectRoot === undefined) {
    void vscode.window.showWarningMessage('LoreFountain: open the project as a workspace folder to choose a project file.');
    return undefined;
  }
  const picked = await vscode.window.showOpenDialog({
    canSelectMany: false,
    canSelectFiles: true,
    canSelectFolders: false,
    defaultUri: vscode.Uri.file(projectRoot),
    openLabel: 'Use as reference image',
    title: 'Choose a reference image inside the project',
    filters: { Images: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif'], 'All files': ['*'] },
  });
  if (!picked || picked.length === 0) return undefined;
  const relative = toProjectRelativePath(projectRoot, picked[0].fsPath);
  if (relative === undefined) {
    void vscode.window.showWarningMessage(
      'LoreFountain: that file is outside the project, so it would not travel with it. Copy it into the project (for example into assets/) and choose it again.',
    );
    return undefined;
  }
  return relative;
}

/** Validate the webview's form state, turn it into text and replace the document with it (one undo step). */
async function applyEdit(document: vscode.TextDocument, formState: unknown, repaint: () => Promise<void>): Promise<void> {
  const parsed = styleFormStateSchema.safeParse(formState);
  if (!parsed.success) return; // not a form state we sent; ignore
  const current = document.getText();
  const result = applyFormStateToText(current, parsed.data);
  if (!result.ok) {
    void vscode.window.showWarningMessage(`LoreFountain: couldn't save the style bible change. ${result.message}`);
    await repaint();
    return;
  }
  if (result.text === current) {
    await repaint();
    return;
  }
  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, new vscode.Range(document.positionAt(0), document.positionAt(current.length)), result.text);
  await vscode.workspace.applyEdit(edit);
}
