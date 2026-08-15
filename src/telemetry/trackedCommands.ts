/**
 * `registerTrackedCommand`: a drop-in replacement for
 * `vscode.commands.registerCommand` that also records one coarse telemetry
 * event per invocation. Used at every command registration site in this
 * codebase (`extension.ts` and every `src/commands/*.ts`) so feature-usage
 * tracking never has to be remembered per-feature — a new command gets it
 * for free just by using this instead of the raw
 * `vscode.commands.registerCommand`.
 *
 * The one place this can't reach is the paid tier's own command
 * implementations, registered by the separate `lorefountain-pro` submodule
 * once a license (or the public-launch promo) is active
 * (`extension.ts`'s `activateProTier`) — that repo isn't present in this
 * working tree (see `pro/README.md`), so its own commands need this same
 * wrapper added there directly; flagged, not silently skipped. The
 * *placeholder* commands registered here when Pro isn't active
 * (`GATED_PRO_COMMANDS` in `extension.ts`) already go through this wrapper,
 * which captures "a free-tier user clicked a gated feature" — real
 * product-demand signal in its own right.
 */

import * as vscode from 'vscode';
import { recordEvent } from './events';

/**
 * Register a command that also records a telemetry event (the command id,
 * as the event name) on every invocation, before the real handler runs.
 *
 * @param context - The extension context (for the local telemetry queue, and to register the disposable against).
 * @param command - The command id, also used verbatim as the telemetry event name.
 * @param callback - The real command handler.
 * @returns The disposable, same as `vscode.commands.registerCommand`.
 */
export function registerTrackedCommand(
  context: vscode.ExtensionContext,
  command: string,
  // `any` here matches vscode.d.ts's own `registerCommand` signature exactly
  // — command arguments are inherently dynamic (Command Palette,
  // keybindings, and tree-view context menus all supply them differently),
  // and `unknown[]` would make this wrapper incompatible with every
  // existing command handler's own narrower parameter type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  callback: (...args: any[]) => any,
): vscode.Disposable {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return vscode.commands.registerCommand(command, (...args: any[]) => {
    void recordEvent(context, command);
    return callback(...args);
  });
}
