/**
 * Wikilink completion context detection (Spec §6, §13.2).
 *
 * Typing `[[` in a `.fountain` script or a world Markdown file triggers
 * autocomplete against known entity/glossary names — the same convention
 * Obsidian/Foam use, and one Fountain already recognizes natively as a
 * bracketed note (Spec §15), so a `[[Entity Name]]` link is simultaneously a
 * valid Fountain note and, by this extension's own convention, a deliberate
 * link. Pure text logic, no `vscode` dependency, so it's unit-testable
 * without the extension host; `completionProvider.ts` is the thin
 * `vscode`-facing wrapper.
 */

/** Where the cursor sits relative to an open `[[` on the current line, and what's been typed since. */
export interface WikilinkContext {
  /** Text typed since the `[[`, used to filter/insert. */
  typed: string;
  /** Column (0-based) where `typed` starts — i.e. right after the `[[`. */
  typedStartColumn: number;
}

/**
 * Determine whether the cursor is inside an open `[[...]]` wikilink on the
 * current line, and if so, what's been typed since the opening `[[`.
 *
 * Only looks at text on the current line before the cursor — Fountain notes
 * don't span multiple lines in practice, and restricting to one line keeps
 * this cheap to call on every keystroke.
 *
 * @param linePrefix - The current line's text, up to (not including) the cursor.
 * @returns The wikilink context if the cursor is inside an open `[[`, else `undefined`.
 */
export function computeWikilinkContext(linePrefix: string): WikilinkContext | undefined {
  const openIndex = linePrefix.lastIndexOf('[[');
  if (openIndex === -1) return undefined;

  const afterOpen = linePrefix.slice(openIndex + 2);
  // A closing `]]` already typed after the most recent `[[` means we're no
  // longer inside an open link. (`afterOpen` can never itself contain another
  // `[[`, by definition of `lastIndexOf` finding the *last* one — an earlier,
  // unclosed `[[` on the same line is simply superseded by this one.)
  if (afterOpen.includes(']]')) return undefined;

  return { typed: afterOpen, typedStartColumn: openIndex + 2 };
}
