/**
 * Fountain's boneyard (`/* ... *\/`): text the spec hides from the script
 * entirely. Nothing inside a boneyard is data to LoreFountain — no cue,
 * shot, entity mention or anything else is read from it.
 *
 * `fountain-js` already drops boneyard text from its token stream, so
 * token-based code needs nothing extra. Code that reads the raw script text
 * (line-based cue extraction, mention scanning, token position recovery)
 * runs it through {@link blankBoneyard} first.
 *
 * Exports {@link BONEYARD} and {@link blankBoneyard}.
 *
 * Gotchas:
 * - The pattern is `fountain-js`'s own, so both agree on what is hidden: the
 *   shortest `/*` to `*\/` span, across any number of lines (blank ones
 *   included). An unclosed `/*` hides nothing, in both.
 * - Blanking keeps every character offset and line number unchanged, so
 *   positions found in the blanked text are valid in the original.
 * - Editor conveniences (hover previews, autocomplete, Rename Entity) still
 *   read the raw text on purpose: a writer editing cut material should see
 *   the same help there, and a rename must keep cut text correct for when
 *   it's restored.
 */

/** A boneyard span, as `fountain-js` matches it. Global: use with `replace`, not `exec`. */
export const BONEYARD = /\/\*[\S\s]*?\*\//g;

/**
 * Replace every boneyard span (markers included) with spaces, keeping line
 * breaks, so the text has the same length and line layout but no hidden
 * content.
 *
 * @param text - Raw `.fountain` file contents.
 * @returns The text with each boneyard span blanked out.
 */
export function blankBoneyard(text: string): string {
  return text.replace(BONEYARD, (span) => span.replace(/[^\r\n]/g, ' '));
}
