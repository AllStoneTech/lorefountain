/**
 * Runs the per-file review step of "Check for LoreFountain File Updates"
 * so that one file failing never stops the files after it. Pure — no
 * `vscode` import — so the isolation is unit-tested.
 *
 * Exports {@link reviewEachIsolated}, {@link LARGE_FILE_BYTES}. Why it exists:
 * the command used to `await` each review in a bare loop, so an exception on
 * one file (for example the diff of the 600 KB minified `agents/validate.js`)
 * aborted the loop and the files queued after it (the README templates) were
 * never offered. In Orun that left `validate.js` and two READMEs stale.
 */

/** Above this size a file is not opened in the diff view (a minified bundle's diff is unreadable and can fail to open). */
export const LARGE_FILE_BYTES = 200_000;

/** Outcome of reviewing a list of files. */
export interface ReviewRunResult {
  /** Relative paths whose review finished without an exception (whether or not the writer accepted the update). */
  completed: string[];
  /** Files whose review threw, with the error message. */
  failed: Array<{ relativePath: string; message: string }>;
}

/**
 * Review each item in order, catching any exception per item and carrying on.
 *
 * @param items - The items to review, each with a `relativePath` used in the report.
 * @param review - Reviews one item; may throw.
 * @returns Which items completed and which failed.
 */
export async function reviewEachIsolated<T extends { relativePath: string }>(
  items: readonly T[],
  review: (item: T) => Promise<void>,
): Promise<ReviewRunResult> {
  const result: ReviewRunResult = { completed: [], failed: [] };
  for (const item of items) {
    try {
      await review(item);
      result.completed.push(item.relativePath);
    } catch (err) {
      result.failed.push({ relativePath: item.relativePath, message: err instanceof Error ? err.message : String(err) });
    }
  }
  return result;
}
