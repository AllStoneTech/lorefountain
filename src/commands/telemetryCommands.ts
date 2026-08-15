/**
 * Telemetry transparency/control commands: "Show Telemetry Queue" dumps
 * exactly what's queued to send, unredacted, so the promise of "anonymous,
 * inspectable" telemetry is something a user can actually verify rather
 * than take on faith. "Disable Telemetry" turns the setting back off and
 * drops whatever's currently queued, mirroring `clearLicenseKey`'s
 * "flipping state back and forth is exactly what testing/opting-out needs"
 * posture.
 *
 * `vscode`-facing glue; not covered by the vitest unit suite — verify
 * manually via the F5 Extension Development Host.
 */

import * as vscode from 'vscode';
import { flushSessionUsageFlags } from '../telemetry/events';
import { clearQueuedEvents, getQueuedEvents } from '../telemetry/telemetryState';
import { registerTrackedCommand } from '../telemetry/trackedCommands';

/**
 * Register the `lorefountain.showTelemetryQueue` and
 * `lorefountain.clearTelemetryOptIn` commands.
 *
 * @param context - The extension context to register disposables against.
 * @param outputChannel - Where the queue contents are shown.
 */
export function registerTelemetryCommands(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel): void {
  context.subscriptions.push(
    registerTrackedCommand(context, 'lorefountain.showTelemetryQueue', () =>
      void showTelemetryQueueCommand(context, outputChannel),
    ),
    registerTrackedCommand(context, 'lorefountain.clearTelemetryOptIn', () => void clearTelemetryOptInCommand(context)),
  );
}

async function showTelemetryQueueCommand(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel): Promise<void> {
  await flushSessionUsageFlags(context);
  const queue = getQueuedEvents(context);

  outputChannel.appendLine(`[LoreFountain] Telemetry queue (${queue.length} event(s) waiting to send):`);
  outputChannel.appendLine(JSON.stringify(queue, null, 2));
  outputChannel.show();

  void vscode.window.showInformationMessage(
    queue.length === 0
      ? 'LoreFountain: telemetry queue is empty.'
      : `LoreFountain: ${queue.length} queued event(s) — see the "LoreFountain" output channel.`,
  );
}

async function clearTelemetryOptInCommand(context: vscode.ExtensionContext): Promise<void> {
  await vscode.workspace.getConfiguration('lorefountain').update('telemetry.enabled', false, vscode.ConfigurationTarget.Global);
  await clearQueuedEvents(context);
  void vscode.window.showInformationMessage('LoreFountain: telemetry disabled and the local queue was cleared.');
}
