/**
 * Slug derivation for entity ids.
 *
 * Entity ids are stable slugs derived from a filename or display name
 * (Spec §4.2). The derivation is Unicode-aware so non-ASCII names — e.g. ORUN's
 * Yoruba characters — survive rather than being stripped to noise.
 */

/**
 * Convert an arbitrary string into a lowercase, hyphen-separated slug.
 *
 * Letters and numbers (in any script) are preserved; every other run of
 * characters collapses to a single hyphen, with leading/trailing hyphens
 * trimmed.
 *
 * @param input - Source string (a filename stem or display name).
 * @returns The derived slug. May be empty if the input has no letters/numbers.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}
