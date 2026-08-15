/**
 * Feedback webview panel. One global panel (not per-workspace-folder, unlike
 * `settingsPanel.ts` — feedback isn't scoped to a project). Validates the
 * webview's `submit` message against `feedback.ts`'s `feedbackFormMessageSchema`
 * before ever building a payload or making a network call — a webview
 * message is untrusted input crossing a real extension-host boundary, same
 * posture as any other external input this project validates.
 */

import * as crypto from 'node:crypto';
import * as vscode from 'vscode';
import { getSessionTier } from '../telemetry/telemetryState';
import { buildFeedbackPayload, feedbackFormMessageSchema, submitFeedback } from '../telemetry/feedback';
import { buildFeedbackHtml } from './feedbackHtml';

/** The view type this panel registers under. */
export const FEEDBACK_VIEW_TYPE = 'lorefountain.feedback';

/** Messages the webview's client script sends back to the extension host. */
type WebviewInboundMessage = { type: 'submit'; feedback: unknown };

let openPanel: vscode.WebviewPanel | undefined;

/**
 * Open (or reveal an already-open) feedback panel.
 *
 * @param context - The extension context (for the device id and extension version).
 * @param deviceId - This install's stable anonymous id.
 */
export function openFeedbackPanel(context: vscode.ExtensionContext, deviceId: string): void {
  if (openPanel) {
    openPanel.reveal();
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    FEEDBACK_VIEW_TYPE,
    'LoreFountain Feedback',
    vscode.ViewColumn.Active,
    { enableScripts: true, retainContextWhenHidden: true },
  );
  openPanel = panel;

  const nonce = crypto.randomBytes(16).toString('base64');
  panel.webview.html = buildFeedbackHtml(panel.webview.cspSource, nonce);

  panel.webview.onDidReceiveMessage((message: WebviewInboundMessage) => {
    if (message.type === 'submit') {
      void handleSubmit(context, deviceId, panel, message.feedback);
    }
  });

  panel.onDidDispose(() => {
    openPanel = undefined;
  });
}

async function handleSubmit(
  context: vscode.ExtensionContext,
  deviceId: string,
  panel: vscode.WebviewPanel,
  rawFeedback: unknown,
): Promise<void> {
  const parsed = feedbackFormMessageSchema.safeParse(rawFeedback);
  if (!parsed.success) {
    void panel.webview.postMessage({ type: 'result', ok: false, error: parsed.error.issues[0]?.message });
    return;
  }

  const payload = buildFeedbackPayload(
    parsed.data,
    deviceId,
    getSessionTier(),
    String(context.extension.packageJSON.version ?? '0.0.0'),
    process.platform,
  );

  try {
    await submitFeedback(payload);
    void panel.webview.postMessage({ type: 'result', ok: true });
  } catch {
    void panel.webview.postMessage({
      type: 'result',
      ok: false,
      error: "Couldn't reach LoreFountain's feedback service — try again later.",
    });
  }
}
