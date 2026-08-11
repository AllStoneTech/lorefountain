/**
 * Cue extraction from raw Fountain script text (Spec §15.1).
 *
 * Fountain has no formal syntax for audio cues — SFX:/MUSIC:/AMB: are a
 * plain-English convention this product defines, written as ordinary action
 * lines. Section 13.9's snippet-driven insertion (`resources/fountain-cues.code-snippets`)
 * is what keeps this contract reliable in practice: the writer never
 * hand-types the prefix, so extraction can stay simple, case-sensitive,
 * exact-prefix matching without needing to guess at typos.
 *
 * MUSIC cues carry two independent, both-optional modifiers: `role` (what
 * kind of musical moment this is) and `timing` (fade in/out). Either, both,
 * or neither may be present on a given cue — `MUSIC: BED IN low, patient`,
 * `MUSIC: STING - the reveal`, `MUSIC: OUT`, and a bare `MUSIC: a single
 * soprano voice, rising` are all valid. Role is checked before timing, each
 * separated from what follows by the same permissive optional-dash pattern
 * (`MUSIC: STING - the reveal` and `MUSIC: STING the reveal` parse
 * identically) this convention has always used.
 *
 * `UNDER` (the old flat modifier's fourth value, meaning "continuous music
 * under dialogue") is retired, not kept as a deprecated alias — `BED` is
 * the more precise replacement for the same concept, and there is no
 * persisted-data migration concern to preserve it for: `.cues.json`
 * sidecars are fully derived/disposable, regenerated from the script on
 * every save (see `sidecar.ts`), never authoritative. A `MUSIC:` line still
 * using `UNDER` after this change simply matches neither keyword list below
 * and gracefully falls through to become the start of the free-text
 * `description` instead — collect-and-continue, the same posture as
 * `index/relations.ts`'s dangling-relation handling: never guess or error
 * on an unrecognized keyword.
 */

export type CueType = 'sfx' | 'music' | 'amb';

/** What kind of musical moment a MUSIC cue is. Independent of {@link MusicTiming} — see `CueEntry`. */
export type MusicRole = 'BED' | 'STING' | 'BRIDGE' | 'SOURCE BED';

/** Fade in/out. Independent of {@link MusicRole} — see `CueEntry`. */
export type MusicTiming = 'IN' | 'OUT';

/** One cue found in a script. */
export interface CueEntry {
  type: CueType;
  /** Only ever present for `music` cues. Independent of `timing` — either, both, or neither may be set. */
  role?: MusicRole;
  /** Only ever present for `music` cues. Independent of `role` — either, both, or neither may be set. */
  timing?: MusicTiming;
  description: string;
  /** 0-based line number in the script where the cue appears. */
  line: number;
}

const CUE_LINE = /^[ \t]*(SFX|MUSIC|AMB):[ \t]*(.*)$/;

// "SOURCE BED" is listed before "BED" for longest-match-first readability,
// though it's not actually load-bearing: none of these four alternatives
// shares a starting character with another, so the "BED" branch can never
// partially match a "SOURCE BED ..." line and strand its tail unconsumed —
// whichever alternative doesn't match at position 0 fails immediately and
// ordinary alternation tries the next one.
const MUSIC_ROLE = /^(SOURCE BED|BED|STING|BRIDGE)\b[ \t]*-?[ \t]*(.*)$/;
const MUSIC_TIMING = /^(IN|OUT)\b[ \t]*-?[ \t]*(.*)$/;

/**
 * Extract every SFX:/MUSIC:/AMB: cue from a script's raw text.
 *
 * For a MUSIC cue, role and timing are extracted independently, in
 * sequence — role first, then timing against whatever's left — each
 * anchored only at the very start of the remaining text. That's what keeps
 * a word like "sting" appearing later in free-text prose (e.g. "BRIDGE
 * Transition sting.") from ever being mistaken for a second role keyword:
 * neither regex is ever re-run against already-consumed description text.
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
      let remaining = rest;
      let role: MusicRole | undefined;
      let timing: MusicTiming | undefined;

      const roleMatch = MUSIC_ROLE.exec(remaining);
      if (roleMatch) {
        role = roleMatch[1] as MusicRole;
        remaining = roleMatch[2];
      }

      const timingMatch = MUSIC_TIMING.exec(remaining);
      if (timingMatch) {
        timing = timingMatch[1] as MusicTiming;
        remaining = timingMatch[2];
      }

      cues.push({ type, role, timing, description: remaining.trim(), line });
      return;
    }

    cues.push({ type, description: rest, line });
  });

  return cues;
}
