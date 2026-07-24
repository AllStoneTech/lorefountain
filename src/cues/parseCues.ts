/**
 * Cue extraction from raw Fountain script text (Spec §15.1).
 *
 * Fountain has no formal syntax for audio cues — SFX:/MUSIC:/AMB: are a
 * plain-English convention this product defines, written as ordinary action
 * lines. Section 13.9's snippet-driven insertion (`resources/fountain-cues.code-snippets`)
 * is what keeps this contract reliable in practice: the writer never
 * hand-types the prefix, so extraction can stay simple, case-sensitive,
 * exact-prefix matching without needing to guess at typos.
 */

export type CueType = 'sfx' | 'music' | 'amb';
export type MusicModifier = 'IN' | 'OUT' | 'STING' | 'UNDER';

/** One cue found in a script. */
export interface CueEntry {
  type: CueType;
  /** Only ever present for `music` cues (Spec §15.1's modifier column). */
  modifier?: MusicModifier;
  description: string;
  /** 0-based line number in the script where the cue appears. */
  line: number;
}

const CUE_LINE = /^[ \t]*(SFX|MUSIC|AMB):[ \t]*(.*)$/;
const MUSIC_MODIFIER = /^(IN|OUT|STING|UNDER)\b[ \t]*-?[ \t]*(.*)$/;

/**
 * Extract every SFX:/MUSIC:/AMB: cue from a script's raw text.
 *
 * @param scriptText - The `.fountain` file's full text.
 * @returns Every cue found, in document order.
 */
export function extractCues(scriptText: string): CueEntry[] {
  const lines = scriptText.split(/\r\n|\r|\n/);
  const cues: CueEntry[] = [];

  lines.forEach((lineText, line) => {
    const match = CUE_LINE.exec(lineText);
    if (!match) return;

    const type = match[1].toLowerCase() as CueType;
    const rest = match[2].trim();

    if (type === 'music') {
      const modifierMatch = MUSIC_MODIFIER.exec(rest);
      if (modifierMatch) {
        cues.push({ type, modifier: modifierMatch[1] as MusicModifier, description: modifierMatch[2].trim(), line });
        return;
      }
    }

    cues.push({ type, description: rest, line });
  });

  return cues;
}
