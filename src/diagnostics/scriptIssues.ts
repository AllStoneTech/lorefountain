/**
 * Pure bookkeeping behind the Problems-panel diagnostics for `.fountain`
 * scripts (ADR-0039): which index issues become diagnostics, at what
 * severity, and how a save merges with the results of the last full build.
 *
 * Exports {@link ScriptIssueData}, {@link ScriptIssueSink} (the interface
 * `index/workspaceIndex.ts` reports into), {@link toScriptIssueData} and
 * {@link mergeSavedIssues}. No `vscode` dependency; the glue that turns these
 * into `vscode.Diagnostic`s is `providers/scriptDiagnostics.ts`.
 *
 * Gotchas:
 * - Only issues that carry a 0-based `line` become diagnostics. Title-page
 *   warnings (`invalid-order`, ...) have no line and stay in the Output
 *   channel only.
 * - Manifest cross-checks (`unmapped-cue-tag`, `unmapped-shot-tag`) run on a
 *   full build only, never on save. A save therefore replaces only the
 *   save-time issues for that script and keeps the full-build ones until
 *   the next full build; otherwise saving would make them vanish.
 */

/** Issue codes produced only by a full build (`index/build.ts`), never by an incremental save. */
export const FULL_BUILD_ONLY_CODES: ReadonlySet<string> = new Set(['unmapped-cue-tag', 'unmapped-shot-tag']);

/** One script issue ready to show as a diagnostic. */
export interface ScriptIssueData {
  /** 0-based line. */
  line: number;
  code: string;
  severity: 'warning' | 'info';
  message: string;
  /** Which kind of index pass produced it: decides what a later save replaces. */
  phase: 'save' | 'full-build';
}

/** The loose shape of an index warning or note: every one has a message; some have a code and a line. */
export interface IssueLike {
  code?: string;
  line?: unknown;
  message: string;
}

/** One script's issues from a full build. */
export interface ScriptIssueEntry {
  filePath: string;
  warnings: readonly IssueLike[];
  notes: readonly IssueLike[];
}

/** Where `WorkspaceIndex` reports per-script issues, so they can be shown in the Problems panel. */
export interface ScriptIssueSink {
  /**
   * Replace every script diagnostic under `folderRoot` with a full build's results.
   *
   * @param folderRoot - Absolute path of the workspace folder that was rebuilt.
   * @param entries - Each script's warnings and notes from that build.
   */
  fullBuild(folderRoot: string, entries: readonly ScriptIssueEntry[]): void;
  /**
   * Update one script's save-time diagnostics after an incremental reindex.
   *
   * @param filePath - Absolute path of the saved script.
   * @param warnings - The reindex's warnings for it.
   * @param notes - The reindex's notes for it.
   */
  saved(filePath: string, warnings: readonly IssueLike[], notes: readonly IssueLike[]): void;
  /**
   * Drop a deleted script's diagnostics.
   *
   * @param filePath - Absolute path of the removed script.
   */
  removed(filePath: string): void;
}

/**
 * Turn a script's warnings and notes into diagnostic data, keeping only
 * issues with a code and a numeric line.
 *
 * @param warnings - Warning-severity issues.
 * @param notes - Informational notes.
 * @returns Issues sorted by line, each tagged with the pass that produces it.
 */
export function toScriptIssueData(warnings: readonly IssueLike[], notes: readonly IssueLike[]): ScriptIssueData[] {
  const result: ScriptIssueData[] = [];
  const add = (issue: IssueLike, severity: ScriptIssueData['severity']): void => {
    if (typeof issue.line !== 'number' || issue.code === undefined) return;
    result.push({
      line: issue.line,
      code: issue.code,
      severity,
      message: issue.message,
      phase: FULL_BUILD_ONLY_CODES.has(issue.code) ? 'full-build' : 'save',
    });
  };
  for (const warning of warnings) add(warning, 'warning');
  for (const note of notes) add(note, 'info');
  return result.sort((a, b) => a.line - b.line);
}

/**
 * Merge a save's issues into a script's existing ones: the save replaces
 * every save-time issue and keeps the full-build-only ones from the last
 * full build.
 *
 * @param previous - The script's current issues.
 * @param fromSave - Issues produced by the save (any full-build-only codes in it are ignored).
 * @returns The merged issues, sorted by line.
 */
export function mergeSavedIssues(previous: readonly ScriptIssueData[], fromSave: readonly ScriptIssueData[]): ScriptIssueData[] {
  return [
    ...previous.filter((issue) => issue.phase === 'full-build'),
    ...fromSave.filter((issue) => issue.phase === 'save'),
  ].sort((a, b) => a.line - b.line);
}
