/**
 * "Check for LoreFountain Updates" command: tells the writer whether a newer
 * LoreFountain release exists, via `checkForNewerVersion`
 * (`src/updates/versionCheck.ts`). Distinct from "Check for LoreFountain File
 * Updates" (`checkFileUpdates.ts`), which is about a *project's* scaffolded
 * agent docs and READMEs drifting from the installed extension's templates —
 * this one is about the extension itself.
 *
 * Notify-only by design: it never downloads or installs anything, because
 * Marketplace/Open VSX installs update themselves and side-loading a `.vsix`
 * over one would fight that updater. It just offers the release page, or the
 * Extensions view (where the store's own Update button lives).
 *
 * `vscode`-facing glue; not covered by the vitest unit suite (the comparison
 * logic is) — verify manually via the F5 Extension Development Host.
 */

import * as vscode from 'vscode';
import { registerTrackedCommand } from '../telemetry/trackedCommands';
import { checkForNewerVersion } from '../updates/versionCheck';

const EXTENSION_ID = 'All-Stone-Tech.lorefountain';

/**
 * Register the "Check for LoreFountain Updates" command.
 *
 * @param context - The extension context (used to read the running version and register the disposable).
 */
export function registerCheckForUpdatesCommand(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    registerTrackedCommand(context, 'lorefountain.checkForUpdates', () => void checkForUpdates(context)),
  );
}

async function checkForUpdates(context: vscode.ExtensionContext): Promise<void> {
  const installed = String(context.extension.packageJSON.version);
  const result = await checkForNewerVersion(installed, fetch);

  if (result.status === 'unavailable') {
    void vscode.window.showInformationMessage(
      `LoreFountain ${installed}: couldn't check for updates right now. If you installed from the Marketplace or Open VSX, your editor updates it automatically.`,
    );
    return;
  }
  if (result.status === 'up-to-date') {
    void vscode.window.showInformationMessage(`LoreFountain ${installed} is up to date.`);
    return;
  }

  const choice = await vscode.window.showInformationMessage(
    `LoreFountain ${result.latest} is available (you have ${installed}). Installs from the Marketplace or Open VSX update automatically.`,
    'View Release Notes',
    'Open Extensions View',
  );
  if (choice === 'View Release Notes') {
    void vscode.env.openExternal(vscode.Uri.parse(result.releaseUrl));
  } else if (choice === 'Open Extensions View') {
    void vscode.commands.executeCommand('extension.open', EXTENSION_ID);
  }
}
