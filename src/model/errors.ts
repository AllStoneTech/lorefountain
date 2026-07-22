/**
 * Shared error and result types for the LoreFountain model layer.
 *
 * The model layer parses user-authored files that may be malformed, so most
 * entry points return discriminated result objects rather than throwing — the
 * index rebuild must skip/flag bad files and never crash the extension
 * (Spec §23). `LoreFountainError` exists for the rarer cases where throwing is
 * the right call (programmer error, unreachable state).
 */

/** Base class for LoreFountain business-logic errors. */
export class LoreFountainError extends Error {
  /**
   * @param message - Human-readable description.
   * @param code - Stable machine-readable identifier for the error kind.
   */
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'LoreFountainError';
  }
}

/** A single validation problem, flattened from a Zod issue for reporting. */
export interface ValidationIssue {
  /** Dot/bracket path to the offending field (empty string for the root). */
  path: string;
  /** Human-readable description of the problem. */
  message: string;
}
