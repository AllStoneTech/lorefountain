/**
 * "Send Feedback" command: opens the feedback webview (`providers/feedbackPanel.ts`).
 * Registered through `registerTrackedCommand` like every other command here,
 * so opening the feedback panel is itself one more (harmless, expected)
 * feature-usage event.
 *
 * `vscode`-facing glue; not covered by the vitest unit suite — verify
 * manually via the F5 Extension Development Host.
 */

import * as vscode from 'vscode';
import { getOrCreateDeviceId } from '../licensing/licenseState';
import { openFeedbackPanel } from '../providers/feedbackPanel';
import { registerTrackedCommand } from '../telemetry/trackedCommands';

/**
 * Register the `lorefountain.sendFeedback` command.
 *
 * @param context - The extension context to register the disposable against.
 */
export function registerFeedbackCommand(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    registerTrackedCommand(context, 'lorefountain.sendFeedback', () => void sendFeedbackCommand(context)),
  );
}

async function sendFeedbackCommand(context: vscode.ExtensionContext): Promise<void> {
  const deviceId = await getOrCreateDeviceId(context);
  openFeedbackPanel(context, deviceId);
}
