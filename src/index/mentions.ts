/**
 * Automatic mention detection (Spec §4.5).
 *
 * Mentions are lightweight, automatic links created whenever an entity's name
 * or an alias appears in another file's text — distinct from the deliberate,
 * typed `relations` field on entity frontmatter (handled in `relations.ts`).
 * No manual step required: this scans a body of text against every known
 * entity/glossary name and reports which ones appear.
 *
 * Scope, deliberately: only the Markdown body (or, for scripts, the raw
 * `.fountain` text) is scanned, not entity frontmatter fields — mentions are
 * for cross-referencing prose, not structured data. Matching is whole-word
 * (Unicode-aware: a match can't be immediately adjacent to another
 * letter/number/mark, so "Esu" doesn't match inside "Esux" or "xEsu") and
 * case-insensitive. A name that is itself a substring of another candidate's
 * name (e.g. "Ark" within "The Ark") matches both independently if both are
 * real candidates — this is accepted, not a bug. A `[[wikilink]]`-wrapped
 * name matches the same way, with no special-casing needed: the brackets
 * themselves already satisfy the word-boundary check.
 *
 * {@link findMentionOccurrences} is the position-aware primitive (every
 * match, with its character range) — used by the hover provider, which needs
 * to know exactly which span the cursor is over. {@link extractMentionTargets}
 * is a deduplicating wrapper over it, used where only "does source X mention
 * target Y at all" matters (building the index's mention edges).
 */

export type MentionKind = 'entity' | 'glossary' | 'script' | 'event';

/** One entity, glossary term, Timeline event, or script, as a source of mentionable name strings. */
export interface MentionCandidate {
  id: string;
  kind: MentionKind;
  /** Every string that counts as a mention of this candidate: name/term + aliases. Empty for scripts (scripts are never mention targets). */
  names: string[];
}

/** One resolved mention target (deduplicated per source text — occurrence count is not tracked). */
export interface MentionTarget {
  id: string;
  kind: MentionKind;
}

/** One mention match at a specific location in the scanned text. */
export interface MentionOccurrence {
  targets: MentionTarget[];
  /** 0-based character offset where the match starts. */
  start: number;
  /** 0-based character offset where the match ends (exclusive). */
  end: number;
}

/** Characters that count as "part of a word" for the Unicode-aware boundary check. */
const WORD_CHAR_CLASS = '\\p{L}\\p{N}\\p{M}';

/**
 * Find every occurrence of a candidate's name/alias in `text`, with its
 * character range.
 *
 * @param text - The text to scan (an entity/glossary body, or raw script text).
 * @param candidates - Every known entity/glossary candidate to match against.
 * @param excludeId - A candidate id to skip (an entity never mentions itself).
 * @returns Every match, in document order, each naming every candidate that shares that exact name string.
 */
export function findMentionOccurrences(
  text: string,
  candidates: readonly MentionCandidate[],
  excludeId?: string,
): MentionOccurrence[] {
  const targetsByName = new Map<string, MentionTarget[]>();
  const patterns: string[] = [];

  for (const candidate of candidates) {
    if (candidate.id === excludeId) continue;
    for (const rawName of candidate.names) {
      const name = rawName.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const target: MentionTarget = { id: candidate.id, kind: candidate.kind };
      const existing = targetsByName.get(key);
      if (existing) {
        existing.push(target);
      } else {
        targetsByName.set(key, [target]);
      }
      patterns.push(escapeRegExp(name));
    }
  }

  if (patterns.length === 0) return [];

  // Longer names first: purely so a longer alternative is attempted before a
  // shorter one at the same start position (see module doc — genuinely
  // distinct overlapping candidates still both match independently).
  patterns.sort((a, b) => b.length - a.length);

  const regex = new RegExp(
    `(?<![${WORD_CHAR_CLASS}])(?:${patterns.join('|')})(?![${WORD_CHAR_CLASS}])`,
    'giu',
  );

  const occurrences: MentionOccurrence[] = [];
  for (const match of text.matchAll(regex)) {
    const targets = targetsByName.get(match[0].toLowerCase());
    if (!targets || match.index === undefined) continue;
    occurrences.push({ targets, start: match.index, end: match.index + match[0].length });
  }
  return occurrences;
}

/**
 * Find every candidate mentioned in `text`, deduplicated — for callers that
 * only care about the resulting set of mention edges, not where in the text
 * each occurrence is (e.g. building the index).
 *
 * @param text - The body text to scan (e.g. an entity's Markdown body).
 * @param candidates - Every known entity/glossary candidate to match against.
 * @param excludeId - A candidate id to skip (an entity never mentions itself).
 * @returns Deduplicated mention targets, in first-occurrence order.
 */
export function extractMentionTargets(
  text: string,
  candidates: readonly MentionCandidate[],
  excludeId?: string,
): MentionTarget[] {
  const seen = new Set<string>();
  const results: MentionTarget[] = [];
  for (const occurrence of findMentionOccurrences(text, candidates, excludeId)) {
    for (const target of occurrence.targets) {
      const key = `${target.kind}:${target.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(target);
    }
  }
  return results;
}

/** Escape a literal string for safe use inside a `RegExp` pattern. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
