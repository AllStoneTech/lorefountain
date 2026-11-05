/**
 * The two upgrade notices (ADR-0039), `vscode` side:
 * - {@link captureInstallState} + {@link maybeShowWhatsNew}: once per user per
 *   minor/major release, a non-modal "What's New" notification. The button
 *   opens the What's New help panel (`lorefountain.showWhatsNew`).
 * - {@link maybeShowProjectSummary}: once per project per minor/major
 *   release, after that folder's first index build, when it has script
 *   formatting issues Fix All can fix. Its buttons run Fix All, show the
 *   Problems panel, or dismiss until the next minor/major release.
 *
 * Settings: `lorefountain.notifications.whatsNew` and
 * `lorefountain.notifications.projectSummary` (both default on). The
 * decisions are pure and unit-tested in `upgrade/upgradeNotices.ts`; this
 * file is glue, verified manually in the F5 Extension Development Host.
 *
 * Gotcha: {@link captureInstallState} must run at the very start of
 * activation, before `getOrCreateDeviceId` writes the device id it checks.
 */

import * as vscode from 'vscode';
import { hasDeviceId } from '../licensing/licenseState';
import {
  decideProjectSummary,
  decideWhatsNew,
  projectSummaryCounts,
  projectSummaryMessage,
  whatsNewHeadline,
  type InstallState,
} from '../upgrade/upgradeNotices';
import type { IndexBuildSummary } from '../index/build';
import { FIX_SCRIPT_FORMATTING_COMMAND } from '../providers/scriptQuickFixes';

/** Global-state key for the version recorded on the last activation. */
const LAST_SEEN_VERSION_KEY = 'lorefountain.lastSeenVersion';
/** Workspace-state key prefix for the version a folder's project summary was last shown under. */
const PROJECT_SUMMARY_KEY_PREFIX = 'lorefountain.projectSummary.shownVersion:';
/** The What's New help panel command. */
export const SHOW_WHATS_NEW_COMMAND = 'lorefountain.showWhatsNew';

/**
 * Read the install facts the what's-new decision needs. Call before anything
 * else in activation touches global state.
 *
 * @param context - The extension context.
 * @returns The running version, the last recorded version, and whether 1.0-era state existed.
 */
export function captureInstallState(context: vscode.ExtensionContext): InstallState {
  return {
    current: String(context.extension.packageJSON.version),
    lastSeen: context.globalState.get<string>(LAST_SEEN_VERSION_KEY),
    hadPriorInstall: hasDeviceId(context),
  };
}

/**
 * Show the what's-new notice if this is a minor/major upgrade and the setting
 * allows it, then record the running version either way.
 *
 * @param context - The extension context.
 * @param state - The facts from {@link captureInstallState}.
 * @returns Resolves once the version is recorded (it doesn't wait for a button click).
 */
export async function maybeShowWhatsNew(context: vscode.ExtensionContext, state: InstallState): Promise<void> {
  const enabled = vscode.workspace.getConfiguration('lorefountain').get<boolean>('notifications.whatsNew', true);
  const decision = decideWhatsNew(state);
  await context.globalState.update(LAST_SEEN_VERSION_KEY, state.current);
  if (!enabled || !decision.show) return;

  void vscode.window.showInformationMessage(whatsNewHeadline(state.current), "What's New", 'Dismiss').then((choice) => {
    if (choice === "What's New") void vscode.commands.executeCommand(SHOW_WHATS_NEW_COMMAND);
  });
}

/**
 * Show the post-upgrade project summary for one workspace folder, at most
 * once per minor/major release, when it has fixable script issues.
 *
 * @param context - The extension context.
 * @param folder - The workspace folder that was just indexed.
 * @param summary - Its first full index build of this session.
 * @returns Resolves once the notification is shown (or skipped); it doesn't wait for a button click.
 */
export async function maybeShowProjectSummary(
  context: vscode.ExtensionContext,
  folder: vscode.WorkspaceFolder,
  summary: IndexBuildSummary,
): Promise<void> {
  const enabled = vscode.workspace.getConfiguration('lorefountain').get<boolean>('notifications.projectSummary', true);
  if (!enabled) return;

  const current = String(context.extension.packageJSON.version);
  const key = `${PROJECT_SUMMARY_KEY_PREFIX}${folder.uri.toString()}`;
  const counts = projectSummaryCounts(summary);
  if (!decideProjectSummary(current, context.workspaceState.get<string>(key), counts)) return;

  // Shown once per version whichever button is chosen (or none): "Not Now"
  // means "not until the next minor/major release".
  await context.workspaceState.update(key, current);
  void vscode.window
    .showInformationMessage(projectSummaryMessage(folder.name, counts), 'Fix All…', 'Show Problems', 'Not Now')
    .then((choice) => {
      if (choice === 'Fix All…') void vscode.commands.executeCommand(FIX_SCRIPT_FORMATTING_COMMAND);
      else if (choice === 'Show Problems') void vscode.commands.executeCommand('workbench.actions.view.problems');
    });
}
