/**
 * LoreFountain's extensions to Fountain, kept in one place so every parser
 * that recognizes them agrees.
 *
 * Fountain itself is outside this project's control (ADR-0038): LoreFountain
 * may *extend* it — plain-English prefix lines written as ordinary action
 * prose, and a slug-shaped `[tag]` right after some of those prefixes — but it
 * never changes how standard Fountain parses. Everything here is an
 * extension in that sense.
 *
 * Exports:
 * - {@link ASSET_TAG_BODY} / {@link matchLeadingTag}: the `[tag]` handle shared
 *   by `SFX:`/`MUSIC:`/`AMB:` cues (`cues/parseCues.ts`) and `SHOT:` lines
 *   (`shots/parseShots.ts`), so the two can't drift apart.
 * - {@link PREFIX_LINE} / {@link matchPrefixLine}: every LoreFountain prefix
 *   line, for code that must tell a convention line apart from real
 *   dialogue (e.g. when Fountain misreads an all-caps `SHOT:` line as a
 *   character cue).
 * - {@link parseDurationSeconds}: the lenient seconds parser shared by
 *   `DURATION:` and `PAUSE:`.
 */

/**
 * The body of an asset tag: lowercase letters, digits, and single internal
 * hyphens, no leading/trailing hyphen. Deliberately narrower than free text:
 * it can never collide with a `[[Wikilink]]` (whose first inner character is
 * `[`, which `[a-z0-9]` rejects), and it keeps tag matching exact rather than
 * fuzzy, so a rename never silently maps to the wrong asset.
 */
export const ASSET_TAG_BODY = '[a-z0-9]+(?:-[a-z0-9]+)*';

/** A leading `[tag]` on a prefix line's remaining text, with the rest captured after it. */
const LEADING_TAG = new RegExp(`^\\[(${ASSET_TAG_BODY})\\][ \\t]*(.*)$`);

/** Result of {@link matchLeadingTag}. */
export interface LeadingTagMatch {
  /** The tag, when the text started with a valid `[tag]`. */
  tag?: string;
  /** The text after the tag (or the whole text, untouched, when there was no tag). */
  rest: string;
}

/**
 * Split an optional leading `[tag]` off a prefix line's remaining text.
 *
 * @param text - The text after a prefix such as `SHOT:` or `SFX:`.
 * @returns The tag (if any) and the remaining text. Text that doesn't start
 *   with a valid tag is returned unchanged as `rest`.
 */
export function matchLeadingTag(text: string): LeadingTagMatch {
  const match = LEADING_TAG.exec(text);
  if (!match) return { rest: text };
  return { tag: match[1], rest: match[2] };
}

/** Every LoreFountain prefix keyword, in no particular order. */
export const PREFIX_KEYWORDS = ['SHOT', 'POSE', 'LIGHT', 'DURATION', 'PAUSE', 'SFX', 'MUSIC', 'AMB'] as const;

/** One LoreFountain prefix keyword. */
export type PrefixKeyword = (typeof PREFIX_KEYWORDS)[number];

/** A whole physical line that is a LoreFountain prefix line. Group 1 is the keyword, group 2 the remaining text. */
export const PREFIX_LINE = new RegExp(`^[ \\t]*(${PREFIX_KEYWORDS.join('|')}):[ \\t]*(.*)$`);

/** Result of {@link matchPrefixLine}. */
export interface PrefixLineMatch {
  keyword: PrefixKeyword;
  /** Everything after the prefix and its following whitespace, untrimmed at the end. */
  rest: string;
}

/**
 * Recognize a physical line as a LoreFountain prefix line.
 *
 * @param lineText - One physical line of script text.
 * @returns The keyword and remaining text, or `undefined` if the line isn't a prefix line.
 */
export function matchPrefixLine(lineText: string): PrefixLineMatch | undefined {
  const match = PREFIX_LINE.exec(lineText);
  if (!match) return undefined;
  return { keyword: match[1] as PrefixKeyword, rest: match[2] };
}

const DURATION_SECONDS = /(?:about\s+|~\s*)?(\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)\b/i;

/**
 * Leniently parse a seconds value out of freeform duration text ("4s",
 * "~5 seconds", "about 2 sec"). Never guesses: text with no recognizable
 * seconds value ("quick", "long") yields `undefined`.
 *
 * @param text - The as-authored duration text.
 * @returns The number of seconds, or `undefined` when none can be read.
 */
export function parseDurationSeconds(text: string): number | undefined {
  const match = DURATION_SECONDS.exec(text);
  return match ? Number(match[1]) : undefined;
}
