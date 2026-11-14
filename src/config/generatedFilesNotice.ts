/**
 * The one-time "generated files" offer (ADR-0053), `vscode`-free part: which
 * files LoreFountain regenerates, when to mention them, and how to append them
 * to a project's `.gitignore` text file if the writer says yes.
 *
 * Exports {@link GENERATED_FILE_PATTERNS}, {@link decideGeneratedFilesNotice}
 * and {@link appendMissingPatterns}. LoreFountain never runs a source-control
 * command and never assumes git: the only write is to a `.gitignore` that
 * already exists, and only after the writer clicks the button. Pure and
 * unit-tested; the glue is `commands/generatedFilesNotice.ts`.
 */

/**
 * Files LoreFountain regenerates from a project's scripts or builds locally.
 * Safe to leave out of version control. Producer files (`*.lfp.json`) are
 * deliberately absent: they hold state that cannot be rebuilt.
 */
export const GENERATED_FILE_PATTERNS: readonly string[] = [
  '*.shots.json',
  '*.cues.json',
  '*.pages.json',
  '.lorefountain/',
  '*.lorefountain.db',
  '*.lorefountain.db-journal',
];

/** The comment line written above appended patterns. */
export const GITIGNORE_HEADER = '# LoreFountain generated files (rebuilt from your scripts; safe to leave untracked)';

/** What is known about a project when deciding whether to make the offer. */
export interface GeneratedFilesNoticeState {
  /** The `lorefountain.notifications.generatedFiles` setting. */
  enabled: boolean;
  /** Whether the project has a `lorefountain.config.json` (i.e. is a LoreFountain project). */
  hasConfigFile: boolean;
  /** Whether the writer was already offered this for the project. */
  alreadyOffered: boolean;
}

/** What the offer should contain, or `undefined` for no offer. */
export interface GeneratedFilesNotice {
  /** Whether an "Add to .gitignore" button is offered (only when a `.gitignore` exists and lacks patterns). */
  canAppend: boolean;
}

/**
 * Decide whether to make the one-time offer and what it can do.
 *
 * Offers once per project, never when turned off, and only for a LoreFountain
 * project. The append button appears only when a `.gitignore` already exists
 * and does not already cover every pattern: with no `.gitignore` there is no
 * evidence the project uses git, so the offer is information only.
 *
 * @param state - What is known about the project.
 * @param gitignoreText - The existing `.gitignore` text, or `undefined` if there is none.
 * @returns The offer to show, or `undefined` when nothing should be shown.
 */
export function decideGeneratedFilesNotice(
  state: GeneratedFilesNoticeState,
  gitignoreText: string | undefined,
): GeneratedFilesNotice | undefined {
  if (!state.enabled || !state.hasConfigFile || state.alreadyOffered) return undefined;
  if (gitignoreText === undefined) return { canAppend: false };
  return { canAppend: missingPatterns(gitignoreText).length > 0 };
}

/**
 * Patterns from {@link GENERATED_FILE_PATTERNS} that a `.gitignore` text lacks.
 * A pattern counts as present when a non-comment line equals it (ignoring
 * surrounding whitespace and a leading `/`).
 *
 * @param gitignoreText - The `.gitignore` text.
 * @returns The patterns still to add, in canonical order.
 */
export function missingPatterns(gitignoreText: string): string[] {
  const present = new Set(
    gitignoreText
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/^\//, ''))
      .filter((line) => line !== '' && !line.startsWith('#')),
  );
  return GENERATED_FILE_PATTERNS.filter((pattern) => !present.has(pattern));
}

/**
 * Append the missing patterns, under a header comment, to `.gitignore` text.
 * Existing content and line endings are preserved; nothing is removed or
 * reordered. Idempotent: returns the text unchanged when nothing is missing.
 *
 * @param gitignoreText - The existing `.gitignore` text.
 * @returns The text to write back.
 */
export function appendMissingPatterns(gitignoreText: string): string {
  const missing = missingPatterns(gitignoreText);
  if (missing.length === 0) return gitignoreText;

  const eol = gitignoreText.includes('\r\n') ? '\r\n' : '\n';
  const separator = gitignoreText === '' ? '' : gitignoreText.endsWith('\n') ? eol : eol + eol;
  return `${gitignoreText}${separator}${[GITIGNORE_HEADER, ...missing].join(eol)}${eol}`;
}
