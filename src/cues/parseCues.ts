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
 *
 * An optional `[tag]` immediately after the prefix (e.g. `SFX: [kola-nuts-clatter]
 * the kola nuts clatter in a bowl`) is this convention's stable handle into
 * `assets/manifests/audio.json` (`index/build.ts`'s cross-file check warns
 * when a tagged cue has no matching manifest entry). A tag is required to be
 * slug-shaped — lowercase letters, digits, and single internal hyphens only,
 * no leading/trailing hyphen — deliberately narrower than free text: that
 * shape can never collide with a `[[Wikilink]]` entity mention appearing
 * later in the same cue's description (a wikilink's first inner character is
 * itself `[`, which the tag pattern's `[a-z0-9]` class rejects), and it keeps
 * tag matching exact rather than fuzzy, so a rename never silently maps to
 * the wrong asset. The tag is optional — a cue can exist before anyone has
 * tagged or sourced its asset — and is extracted before role/timing on a
 * `MUSIC:` line, since it always sits closest to the prefix.
 */

export type CueType = 'sfx' | 'music' | 'amb';

/** What kind of musical moment a MUSIC cue is. Independent of {@link MusicTiming} — see `CueEntry`. */
export type MusicRole = 'BED' | 'STING' | 'BRIDGE' | 'SOURCE BED';

/** Fade in/out. Independent of {@link MusicRole} — see `CueEntry`. */
export type MusicTiming = 'IN' | 'OUT';

/** One cue found in a script. */
export interface CueEntry {
  type: CueType;
  /** The cue's stable `[tag]` handle into `assets/manifests/audio.json`, if one was written. Absent for an untagged cue — not yet an error, since a cue can exist before its asset is sourced. */
  tag?: string;
  /** Only ever present for `music` cues. Independent of `timing` — either, both, or neither may be set. */
  role?: MusicRole;
  /** Only ever present for `music` cues. Independent of `role` — either, both, or neither may be set. */
  timing?: MusicTiming;
  description: string;
  /** 0-based line number in the script where the cue appears. */
  line: number;
}

const CUE_LINE = /^[ \t]*(SFX|MUSIC|AMB):[ \t]*(.*)$/;

/**
 * A leading `[tag]` on a cue's remaining text, e.g. `[kola-nuts-clatter] the
 * kola nuts clatter`. Deliberately restricted to slug shape (see the module
 * doc comment) so it can never be confused with a `[[Wikilink]]` entity
 * mention appearing later in the same description.
 */
const CUE_TAG = /^\[([a-z0-9]+(?:-[a-z0-9]+)*)\][ \t]*(.*)$/;

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
 * A leading `[tag]` (see the module doc comment) is extracted first, before
 * anything else — including a MUSIC cue's role/timing keywords, which always
 * sit after it if both are present, e.g. `MUSIC: [tense-swell] BED IN low,
 * patient`.
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
    let rest = match[2];

    let tag: string | undefined;
    const tagMatch = CUE_TAG.exec(rest);
    if (tagMatch) {
      tag = tagMatch[1];
      rest = tagMatch[2];
    }
    rest = rest.trim();

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

      cues.push({ type, tag, role, timing, description: remaining.trim(), line });
      return;
    }

    cues.push({ type, tag, description: rest, line });
  });

  return cues;
}
