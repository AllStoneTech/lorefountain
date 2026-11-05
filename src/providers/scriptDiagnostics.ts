/**
 * Problems-panel diagnostics for `.fountain` scripts (ADR-0039): the
 * `vscode` side of `diagnostics/scriptIssues.ts`. Each workspace folder's
 * `WorkspaceIndex` reports per-script warnings and notes here; warnings
 * show as `Warning` diagnostics and notes as `Information`, on the line the
 * issue is about. The quick fixes (`scriptQuickFixes.ts`) attach to these.
 *
 * Exports {@link ScriptDiagnostics}. The Output channel keeps logging every
 * issue as before; diagnostics are an addition, not a replacement, and
 * manifest-level issues (no script, no line) stay Output-only.
 *
 * `vscode`-facing glue: the merge/selection logic is unit-tested in
 * `scriptIssues.ts`; this class is verified manually in the F5 Extension
 * Development Host.
 */

import * as path from 'node:path';
import * as vscode from 'vscode';
import {
  mergeSavedIssues,
  toScriptIssueData,
  type IssueLike,
  type ScriptIssueData,
  type ScriptIssueEntry,
  type ScriptIssueSink,
} from '../diagnostics/scriptIssues';

/** The `source` shown next to every LoreFountain script diagnostic. */
export const SCRIPT_DIAGNOSTIC_SOURCE = 'LoreFountain';

/** Owns the script diagnostic collection and the issue data behind it. */
export class ScriptDiagnostics implements ScriptIssueSink, vscode.Disposable {
  private readonly collection = vscode.languages.createDiagnosticCollection('lorefountain-scripts');
  /** Current issues per absolute script path. */
  private readonly issuesByFile = new Map<string, ScriptIssueData[]>();

  /** @inheritdoc */
  fullBuild(folderRoot: string, entries: readonly ScriptIssueEntry[]): void {
    const prefix = withTrailingSeparator(folderRoot);
    for (const filePath of [...this.issuesByFile.keys()]) {
      if (filePath.startsWith(prefix)) this.set(filePath, []);
    }
    for (const entry of entries) {
      if (!entry.filePath.toLowerCase().endsWith('.fountain')) continue;
      this.set(entry.filePath, toScriptIssueData(entry.warnings, entry.notes));
    }
  }

  /** @inheritdoc */
  saved(filePath: string, warnings: readonly IssueLike[], notes: readonly IssueLike[]): void {
    const previous = this.issuesByFile.get(filePath) ?? [];
    this.set(filePath, mergeSavedIssues(previous, toScriptIssueData(warnings, notes)));
  }

  /** @inheritdoc */
  removed(filePath: string): void {
    this.set(filePath, []);
  }

  /** Dispose the diagnostic collection. */
  dispose(): void {
    this.collection.dispose();
    this.issuesByFile.clear();
  }

  /** Store one file's issues and publish them as diagnostics (an empty list clears the file). */
  private set(filePath: string, issues: ScriptIssueData[]): void {
    const uri = vscode.Uri.file(filePath);
    if (issues.length === 0) {
      this.issuesByFile.delete(filePath);
      this.collection.delete(uri);
      return;
    }
    this.issuesByFile.set(filePath, issues);
    this.collection.set(uri, issues.map(toDiagnostic));
  }
}

/** Build a whole-line diagnostic for one issue. */
function toDiagnostic(issue: ScriptIssueData): vscode.Diagnostic {
  // The end column is clamped to the line's real length by VS Code.
  const range = new vscode.Range(issue.line, 0, issue.line, Number.MAX_SAFE_INTEGER);
  const severity = issue.severity === 'warning' ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Information;
  const diagnostic = new vscode.Diagnostic(range, issue.message, severity);
  diagnostic.code = issue.code;
  diagnostic.source = SCRIPT_DIAGNOSTIC_SOURCE;
  return diagnostic;
}

/** A folder path guaranteed to end in a path separator, so `/a/b` never matches `/a/bc/x`. */
function withTrailingSeparator(folderPath: string): string {
  return folderPath.endsWith(path.sep) ? folderPath : `${folderPath}${path.sep}`;
}
