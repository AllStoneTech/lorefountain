/**
 * Shot extraction from raw Fountain script text — a second plain-English
 * convention this product defines, alongside `cues/parseCues.ts`'s
 * SFX:/MUSIC:/AMB:. Fountain has no camera/lighting/duration syntax at
 * all, so `SHOT:`/`POSE:`/`LIGHT:`/`DURATION:` lines, written as ordinary
 * action-line prose, fill that gap the same way cues do.
 *
 * `SHOT:` is deliberately freeform text, not a fixed enum — real shot-type
 * vocabulary (WIDE/CLOSE-UP/OTS/DUTCH/etc., endlessly combinable) doesn't
 * decompose into clean orthogonal axes the way MUSIC's role/timing split
 * eventually did (see `cues/parseCues.ts`'s doc comment); locking it down
 * would repeat the mistake that split fixed.
 */

import { parseFountain, mapTokensToPositions } from '../fountain/parse';

/** One camera shot, extracted from a script. */
export interface Shot {
  /** Sequential across the whole script (1-based), by encounter order. */
  sceneNumber: number;
  sceneHeadingText: string;
  /** 1-based, sequential *within the scene* — resets at each scene_heading, matching slate/clapperboard convention ("Scene 4, Shot 2"), not a global counter. */
  shotNumber: number;
  /** Freeform camera angle/framing/subject description. */
  description: string;
  /** Character poses/action within this shot. Mentions of entity names here are auto-linked like any other action-line text — no special handling needed. */
  pose?: string;
  /** Freeform lighting description. */
  light?: string;
  /** Raw, as-authored duration text (e.g. "4s", "~5 seconds", "quick") — always kept, even when {@link durationSeconds} can't be parsed from it. */
  durationText?: string;
  /** A numeric seconds value parsed leniently out of `durationText`, when possible — for potential future runtime-summing. Never guessed at; left unset rather than misparsed. */
  durationSeconds?: number;
}

const SHOT_LINE = /^[ \t]*SHOT:[ \t]*(.*)$/;
const POSE_LINE = /^[ \t]*POSE:[ \t]*(.*)$/;
const LIGHT_LINE = /^[ \t]*LIGHT:[ \t]*(.*)$/;
const DURATION_LINE = /^[ \t]*DURATION:[ \t]*(.*)$/;
const DURATION_SECONDS = /(?:about\s+|~\s*)?(\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)\b/i;

/**
 * Extract every shot from a script's raw text.
 *
 * A `SHOT:` line opens a new shot (flushing whatever shot was previously
 * open); any `POSE:`/`LIGHT:`/`DURATION:` lines that follow — until the
 * next `SHOT:` line or the next scene heading — set fields on that same
 * shot (last value wins if a prefix repeats within one shot). A shot never
 * spans scenes: a scene heading always flushes and resets the per-scene
 * shot counter. A `POSE:`/`LIGHT:`/`DURATION:` line with no `SHOT:` open
 * yet is inert — collected data, not an error, same "collect and
 * continue" posture as the rest of this codebase.
 *
 * @param scriptText - The `.fountain` file's full text.
 * @returns Every shot found, in document order.
 */
export function extractShots(scriptText: string): Shot[] {
  const tokens = parseFountain(scriptText);
  const positioned = mapTokensToPositions(scriptText, tokens);

  const shots: Shot[] = [];
  let sceneNumber = 0;
  let sceneHeadingText = '';
  let shotCounterInScene = 0;
  let current: Shot | undefined;

  const flush = (): void => {
    if (current) shots.push(current);
    current = undefined;
  };

  for (const pt of positioned) {
    const token = pt.token;

    if (token.type === 'scene_heading') {
      flush();
      sceneNumber += 1;
      sceneHeadingText = (token.text ?? '').trim();
      shotCounterInScene = 0;
      continue;
    }
    // A SHOT:/POSE:/LIGHT:/DURATION: line is ordinary action-line prose by
    // intent, but Fountain's own character-cue heuristic (an ALL-CAPS line
    // immediately followed by non-blank text = character + dialogue) can
    // misclassify one as `character`, with any lines stacked immediately
    // after it (no blank line between) glommed into one `dialogue` token —
    // this is *likely* here specifically because real shot-type vocabulary
    // (WIDE, CLOSE-UP, ESTABLISHING) is conventionally capitalized, unlike
    // this project's existing SFX:/MUSIC:/AMB: cue descriptions, which
    // happen to always be lowercase prose in practice and so never trigger
    // it. Scanning `character` and `dialogue` token text the same way as
    // `action` — rather than requiring users to avoid natural
    // capitalization or blank-line-separate every field — keeps this
    // convention working regardless of which shape Fountain's parser
    // produces; a genuine character cue's text simply never matches these
    // four prefixes, so real dialogue is untouched.
    if (token.type !== 'action' && token.type !== 'character' && token.type !== 'dialogue') continue;

    const physicalLines = (token.text ?? '').split('\n');
    for (const lineText of physicalLines) {
      const shotMatch = SHOT_LINE.exec(lineText);
      if (shotMatch) {
        flush();
        shotCounterInScene += 1;
        current = { sceneNumber, sceneHeadingText, shotNumber: shotCounterInScene, description: shotMatch[1].trim() };
        continue;
      }

      const poseMatch = POSE_LINE.exec(lineText);
      if (poseMatch) {
        if (current) current.pose = poseMatch[1].trim();
        continue;
      }

      const lightMatch = LIGHT_LINE.exec(lineText);
      if (lightMatch) {
        if (current) current.light = lightMatch[1].trim();
        continue;
      }

      const durationMatch = DURATION_LINE.exec(lineText);
      if (durationMatch && current) {
        const durationText = durationMatch[1].trim();
        current.durationText = durationText;
        const secondsMatch = DURATION_SECONDS.exec(durationText);
        current.durationSeconds = secondsMatch ? Number(secondsMatch[1]) : undefined;
      }
    }
  }
  flush();

  return shots;
}
