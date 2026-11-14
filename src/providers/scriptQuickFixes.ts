/**
 * Quick fixes (code actions) for the script diagnostics (ADR-0039):
 * `orphaned-parenthetical` (join to the previous speech, or re-cue the
 * speaker with `(CONT'D)`), `bare-pause-line` (replace with `PAUSE:`),
 * `unforced-transition` (add Fountain's `>` force marker) and
 * `misread-as-character` (add Fountain's forced-action `!`, preferred, or a
 * blank line after the line), and `cue-extension-parenthetical` (move `V.O.` and
 * friends onto the cue line). `untagged-shot` gets "Tag all shots" (ADR-0054).
 * Each applies exactly one standard Fountain correction; the planning is
 * pure and unit-tested in `upgrade/formatFixes.ts`. Every fix also comes
 * with a "fix all in the project" action that runs the Fix All command.
 *
 * Exports {@link registerScriptQuickFixes}. `vscode`-facing glue, verified
 * manually in the F5 Extension Development Host.
 */

import * as vscode from 'vscode';
import { planShotTags } from 'lorefountain-core/shots/tagShots';
import { panelTagPrefixFor } from '../comics/tagPrefix';
import { TAG_ALL_SHOTS_COMMAND } from '../commands/tagAllShots';
import { FIXABLE_CODES, planLineFixes, type TextEditPlan } from '../upgrade/formatFixes';
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

      planLineFixes(text, code, diagnostic.range.start.line).forEach((fix, index) => {
        const action = new vscode.CodeAction(fix.title, vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, toRange(fix.edit), fix.edit.newText);
        action.diagnostics = [diagnostic];
        // Only the first (preferred) fix is the Ctrl+. default.
        action.isPreferred = index === 0;
        actions.push(action);
      });
    }

    if (actions.length > 0) {
      const fixAll = new vscode.CodeAction('Fix all script formatting issues in the project…', vscode.CodeActionKind.QuickFix);
      fixAll.command = { command: FIX_SCRIPT_FORMATTING_COMMAND, title: 'Fix All Script Formatting Issues' };
      actions.push(fixAll);
    }

    // Untagged shots: tag this script's shots (previewed like any quick fix), or run the command for the
    // whole project. Kept apart from Fix All, which is for formatting (ADR-0054).
    const untagged = context.diagnostics.find(
      (diagnostic) => diagnostic.source === SCRIPT_DIAGNOSTIC_SOURCE && diagnostic.code === 'untagged-shot',
    );
    if (untagged) {
      const plan = planShotTags(text, panelTagPrefixFor(document.uri.fsPath, text));
      if (plan.edits.length > 0) {
        const tagScript = new vscode.CodeAction(`Tag all ${plan.edits.length} untagged shot(s) in this script`, vscode.CodeActionKind.QuickFix);
        tagScript.edit = new vscode.WorkspaceEdit();
        for (const tag of plan.edits) tagScript.edit.insert(document.uri, new vscode.Position(tag.line, tag.character), tag.insert);
        tagScript.diagnostics = [untagged];
        actions.push(tagScript);
      }
      const tagProject = new vscode.CodeAction('Tag all shots in the project…', vscode.CodeActionKind.QuickFix);
      tagProject.command = { command: TAG_ALL_SHOTS_COMMAND, title: 'Tag All Shots' };
      tagProject.diagnostics = [untagged];
      actions.push(tagProject);
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
