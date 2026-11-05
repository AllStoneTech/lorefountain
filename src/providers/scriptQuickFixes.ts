/**
 * Quick fixes (code actions) for the script diagnostics (ADR-0039):
 * `orphaned-parenthetical` (join to the previous speech, or re-cue the
 * speaker with `(CONT'D)`) and `bare-pause-line` (replace with `PAUSE:`).
 * Each applies exactly one standard Fountain correction; the planning is
 * pure and unit-tested in `upgrade/formatFixes.ts`. Every fix also comes
 * with a "fix all in the project" action that runs the Fix All command.
 *
 * Exports {@link registerScriptQuickFixes}. `vscode`-facing glue, verified
 * manually in the F5 Extension Development Host.
 */

import * as vscode from 'vscode';
import { FIXABLE_CODES, planLineFix, type TextEditPlan } from '../upgrade/formatFixes';
import { SCRIPT_DIAGNOSTIC_SOURCE } from './scriptDiagnostics';

/** The Fix All command id, also offered from every quick-fix menu. */
export const FIX_SCRIPT_FORMATTING_COMMAND = 'lorefountain.fixScriptFormatting';

/** Provides the per-diagnostic quick fixes for `.fountain` scripts. */
class ScriptQuickFixProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  /**
   * Offer a fix for each fixable LoreFountain diagnostic in the request.
   *
   * @param document - The script being edited.
   * @param _range - The requested range (the diagnostics in `context` already cover it).
   * @param context - The diagnostics at the cursor or selection.
   * @returns Quick fixes, plus one "fix all" action when any fix applies.
   */
  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    const text = document.getText();

    for (const diagnostic of context.diagnostics) {
      const code = typeof diagnostic.code === 'string' ? diagnostic.code : undefined;
      if (diagnostic.source !== SCRIPT_DIAGNOSTIC_SOURCE || code === undefined || !FIXABLE_CODES.has(code)) continue;

      const fix = planLineFix(text, code, diagnostic.range.start.line);
      if (!fix) continue;
      const action = new vscode.CodeAction(fix.title, vscode.CodeActionKind.QuickFix);
      action.edit = new vscode.WorkspaceEdit();
      action.edit.replace(document.uri, toRange(fix.edit), fix.edit.newText);
      action.diagnostics = [diagnostic];
      action.isPreferred = true;
      actions.push(action);
    }

    if (actions.length > 0) {
      const fixAll = new vscode.CodeAction('Fix all script formatting issues in the project…', vscode.CodeActionKind.QuickFix);
      fixAll.command = { command: FIX_SCRIPT_FORMATTING_COMMAND, title: 'Fix All Script Formatting Issues' };
      actions.push(fixAll);
    }
    return actions;
  }
}

/**
 * Register the script quick-fix provider for Fountain documents.
 *
 * @param context - The extension context to register the disposable against.
 */
export function registerScriptQuickFixes(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider({ language: 'fountain' }, new ScriptQuickFixProvider(), {
      providedCodeActionKinds: ScriptQuickFixProvider.providedCodeActionKinds,
    }),
  );
}

/**
 * Convert a planned edit's range to a `vscode.Range`.
 *
 * @param edit - The planned edit.
 * @returns The equivalent range.
 */
export function toRange(edit: TextEditPlan): vscode.Range {
  return new vscode.Range(edit.start.line, edit.start.character, edit.end.line, edit.end.character);
}
