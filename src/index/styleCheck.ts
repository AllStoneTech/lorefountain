/**
 * Checks `world/style.lf.md` (ADR-0045) for the validator and the Output
 * channel: a malformed file is a problem, a missing reference image is only a
 * note. Pure over the file system (no `vscode`), built on Core's
 * `readStyleBible`, so `cli/validate.ts` and the extension report the same
 * things in the same words.
 *
 * Exports {@link checkStyleBible} and {@link describeStyleFailure}. A project
 * with no style bible is simply `absent`; nothing is reported.
 */

import { readStyleBible, type ReadStyleBibleResult } from 'lorefountain-core/project/styleBible';

/** What {@link checkStyleBible} found. */
export type StyleCheckReport =
  | { status: 'absent' }
  /** The file is usable. `notes` are informational and never fail a run. */
  | { status: 'ok'; filePath: string; notes: string[] }
  /** The file could not be used; `message` says why, with each invalid field. */
  | { status: 'malformed'; filePath: string; reason: string; message: string };

/**
 * Check a project's style bible.
 *
 * @param worldFolder - Absolute path to the project's world folder.
 * @param projectRoot - Absolute path to the project root, which `reference_images` are relative to.
 * @returns `absent`, `ok` with informational notes, or `malformed` with the reason.
 */
export async function checkStyleBible(worldFolder: string, projectRoot: string): Promise<StyleCheckReport> {
  const result = await readStyleBible(worldFolder, projectRoot);
  switch (result.status) {
    case 'absent':
      return { status: 'absent' };
    case 'ok': {
      const notes: string[] = [];
      for (const reference of result.style.referenceImages) {
        if (reference.kind === 'outside-project') {
          notes.push(`reference image "${reference.path}" is outside the project, so it won't travel with it`);
        } else if (reference.exists === false) {
          notes.push(`reference image "${reference.path}" doesn't exist yet`);
        }
      }
      return { status: 'ok', filePath: result.style.filePath, notes };
    }
    case 'invalid':
    case 'read-error':
      return {
        status: 'malformed',
        filePath: result.filePath,
        reason: result.status === 'invalid' ? result.reason : 'read-error',
        message: describeStyleFailure(result),
      };
  }
}

/**
 * One-line description of a style bible that could not be used, listing each
 * invalid field.
 *
 * @param result - A `ReadStyleBibleResult` that is `invalid` or `read-error`.
 * @returns The message, e.g. `Style bible frontmatter failed validation. palette: Item 1 is empty...`.
 */
export function describeStyleFailure(result: Extract<ReadStyleBibleResult, { status: 'invalid' | 'read-error' }>): string {
  if (result.status === 'read-error') return result.message;
  const issues = (result.issues ?? []).map((issue) => `${issue.path || '(frontmatter)'}: ${issue.message}`);
  return issues.length > 0 ? `${result.message} ${issues.join('; ')}` : result.message;
}
