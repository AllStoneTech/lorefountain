/**
 * Fountain parsing (Spec §3, ADR-0002): a thin wrapper around `fountain-js`
 * plus our own position-recovery layer, since `fountain-js` tokens carry no
 * source position (line/column) — a known gap documented in ADR-0002.
 *
 * Position recovery uses a sequential, cursor-advancing text search: for each
 * content-bearing token in order, find its (verbatim) text starting from
 * wherever the previous token's match ended, rather than searching from the
 * start of the document. This is necessary — not just a performance
 * nicety — because names/lines repeat throughout a script (e.g. a character
 * cue appears once per line of dialogue); a global `indexOf` would resolve
 * every repeat to the *first* occurrence. Verified empirically against a
 * sample covering dual dialogue, a `(V.O.)` extension, a boneyard comment,
 * and a bracketed note — every content token's text was an exact substring
 * of the source, and the moving cursor correctly disambiguated repeats.
 *
 * This module is not yet consumed by hover/completion (Phase C) — those
 * operate directly on raw text via `src/index/mentions.ts`, which needs no
 * Fountain-structural awareness. It exists as the parse-integration layer
 * promised by the build plan and as groundwork for structural features nEEDing
 * real positions (outline, folding, a future presence/cue index).
 */

import { Fountain, type Token } from 'fountain-js';

export type { Token as FountainToken };

/** A parsed token with its recovered position in the source, when found. */
export interface PositionedToken {
  token: Token;
  /** 0-based character offset where the token's text starts. */
  start: number;
  /** 0-based character offset where the token's text ends (exclusive). */
  end: number;
  /** 0-based line number containing `start`. */
  line: number;
}

/**
 * Parse Fountain source into its token stream.
 *
 * @param text - Raw `.fountain` file contents.
 * @returns The token stream, in document order.
 */
export function parseFountain(text: string): Token[] {
  return new Fountain().parse(text, true).tokens;
}

/**
 * Recover source positions for every content-bearing token (one with
 * non-empty `text`), by searching for each token's text in turn, advancing a
 * cursor past each match so repeated text (a re-used character cue, a
 * repeated line) resolves to its own distinct occurrence rather than always
 * the first.
 *
 * A token whose text can't be found at or after the current cursor (should
 * not happen for any token type verified above, but Fountain has edge cases
 * this hasn't been tested against) is skipped rather than mis-positioned —
 * best-effort, not guaranteed-complete.
 *
 * @param text - The same source text that produced `tokens`.
 * @param tokens - The token stream from {@link parseFountain} for that text.
 * @returns Positioned tokens, in document order; a subset if any token's text couldn't be located.
 */
export function mapTokensToPositions(text: string, tokens: readonly Token[]): PositionedToken[] {
  const positioned: PositionedToken[] = [];
  let cursor = 0;
  let line = 0;

  for (const token of tokens) {
    const tokenText = token.text ?? '';
    if (!tokenText) continue;

    const start = text.indexOf(tokenText, cursor);
    if (start === -1) continue;

    // Advance the running line count only across the gap we just skipped,
    // not by rescanning from the start of the document each time.
    line += countNewlines(text, cursor, start);
    const end = start + tokenText.length;
    positioned.push({ token, start, end, line });
    cursor = end;
  }

  return positioned;
}

/** Count newline characters in `text` within `[from, to)`. */
function countNewlines(text: string, from: number, to: number): number {
  let count = 0;
  for (let i = from; i < to; i += 1) {
    if (text.charCodeAt(i) === 10 /* \n */) count += 1;
  }
  return count;
}
