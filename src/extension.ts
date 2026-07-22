/**
 * LoreFountain extension entry point.
 *
 * This is the activation surface VS Code loads. At this scaffold stage it only
 * registers a placeholder command so the extension activates and can be
 * exercised in the Extension Development Host. Feature wiring (index, providers,
 * Story Card editor, commands) is added in later build phases.
 */

import * as vscode from 'vscode';

/**
 * Called by VS Code when the extension is activated.
 *
 * Registers command handlers and long-lived services, pushing their disposables
 * onto {@link vscode.ExtensionContext.subscriptions} so they are cleaned up on
 * deactivation.
 *
 * @param context - The extension context provided by the VS Code host.
 */
export function activate(context: vscode.ExtensionContext): void {
  const reindexCommand = vscode.commands.registerCommand(
    'lorefountain.reindexWorkspace',
    () => {
      void vscode.window.showInformationMessage(
        'LoreFountain: index rebuild is not implemented yet.',
      );
    },
  );

  context.subscriptions.push(reindexCommand);
}

/**
 * Called by VS Code when the extension is deactivated.
 *
 * Registered disposables are released automatically via the context
 * subscriptions, so no explicit teardown is required here yet.
 */
export function deactivate(): void {
  // No-op for now.
}
