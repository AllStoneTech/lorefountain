/**
 * License key commands (Spec §10): "Enter License Key" prompts and stores a
 * key, then a reload is needed to apply it — the pro module load decision
 * happens once, at activation (`extension.ts`), so toggling license state
 * mid-session can't take effect without VS Code re-running activation, same
 * as many other extensions' own settings-that-need-a-reload. "Show License
 * Status" and "Remove License Key" exist mainly for local testing against
 * the current stubbed `validateLicense` (see `licensing/validateLicense.ts`)
 * — the latter isn't in the original plan doc but is cheap and useful for
 * flipping licensed/unlicensed state back and forth while testing.
 *
 * `vscode`-facing glue; not covered by the vitest unit suite — verify
 * manually via the F5 Extension Development Host.
 */

import * as vscode from 'vscode';
import { clearLicenseKey, getLicenseStatus, storeLicenseKey } from '../licensing/licenseState';
import { registerTrackedCommand } from '../telemetry/trackedCommands';

/**
 * Register the `lorefountain.enterLicenseKey`, `lorefountain.showLicenseStatus`,
 * and `lorefountain.clearLicenseKey` commands.
 *
 * @param context - The extension context to register disposables against.
 */
export function registerLicensingCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    registerTrackedCommand(context, 'lorefountain.enterLicenseKey', () => void enterLicenseKeyCommand(context)),
    registerTrackedCommand(context, 'lorefountain.showLicenseStatus', () => void showLicenseStatusCommand(context)),
    registerTrackedCommand(context, 'lorefountain.clearLicenseKey', () => void clearLicenseKeyCommand(context)),
  );
}

async function enterLicenseKeyCommand(context: vscode.ExtensionContext): Promise<void> {
  const key = await vscode.window.showInputBox({
    title: 'LoreFountain Pro License Key',
    prompt: 'Paste the license key from your purchase confirmation',
    password: true,
    validateInput: (value) => (value.trim() ? undefined : 'Enter a license key.'),
  });
  if (key === undefined) return; // cancelled

  await storeLicenseKey(context, key.trim());
  const status = await getLicenseStatus(context);

  if (!status?.valid) {
    void vscode.window.showErrorMessage(
      `LoreFountain: that license key isn't valid${status?.reason ? ` (${status.reason})` : ''}.`,
    );
    return;
  }

  const reload = 'Reload Window';
  const choice = await vscode.window.showInformationMessage(
    'LoreFountain: license key accepted. Reload the window to unlock LoreFountain Pro.',
    reload,
  );
  if (choice === reload) {
    await vscode.commands.executeCommand('workbench.action.reloadWindow');
  }
}

async function showLicenseStatusCommand(context: vscode.ExtensionContext): Promise<void> {
  const status = await getLicenseStatus(context);
  if (!status) {
    void vscode.window.showInformationMessage('LoreFountain: no license key entered — running free tier only.');
    return;
  }

  const message = status.valid
    ? `LoreFountain: licensed (tier: ${status.tier ?? 'unknown'})${status.stale ? ' — from cache, offline' : ''}.`
    : `LoreFountain: license not valid${status.reason ? ` (${status.reason})` : ''}.`;
  void vscode.window.showInformationMessage(message);
}

async function clearLicenseKeyCommand(context: vscode.ExtensionContext): Promise<void> {
  await clearLicenseKey(context);
  void vscode.window.showInformationMessage('LoreFountain: license key removed. Reload the window to apply.');
}
