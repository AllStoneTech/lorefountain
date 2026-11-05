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
 *
 * A `SHOT:` line may carry an optional `[tag]` right after the prefix
 * (`SHOT: [archive-ident] WIDE, abstract`), the same slug-shaped handle cues
 * use (`fountain/conventions.ts`), keying the shot into
 * `assets/manifests/shots.json`. Position ("Scene 2, Shot 3") can't key a
 * manifest, since inserting one shot renumbers every later one; a tag can.
 * Tags are optional and never part of `description`.
 *
 * The line walk itself lives in `scanScript.ts`, shared with the
 * `.shots.json` sidecar builder (`shotMap.ts`), including the workaround for
 * Fountain misreading an all-caps `SHOT:` line as a character cue.
 */

import { matchLeadingTag, parseDurationSeconds } from '../fountain/conventions';
import { scanScript } from './scanScript';

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
  /** The shot's stable `[tag]` handle into `assets/manifests/shots.json`, when one was written. Optional: an untagged shot is valid, it just can't be mapped to an asset. */
  tag?: string;
}

/**
 * Split a `SHOT:` line's text into its optional tag and its description.
 *
 * @param rest - The text after `SHOT:`.
 * @returns The tag (if any) and the trimmed description, without the tag.
 */
export function parseShotText(rest: string): { tag?: string; description: string } {
  const { tag, rest: description } = matchLeadingTag(rest);
  return tag === undefined ? { description: description.trim() } : { tag, description: description.trim() };
}

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
  const shots: Shot[] = [];
  let sceneNumber = 0;
  let sceneHeadingText = '';
  let shotCounterInScene = 0;
  let current: Shot | undefined;

  const flush = (): void => {
    if (current) shots.push(current);
    current = undefined;
  };

  // `scanScript` already turns a SHOT:/POSE:/LIGHT:/DURATION: line that
  // Fountain misread as a character cue (likely here, since shot vocabulary
  // like WIDE or CLOSE-UP is conventionally capitalized) back into a
  // directive, so every shape Fountain's parser produces is handled.
  for (const item of scanScript(scriptText)) {
    if (item.kind === 'heading') {
      flush();
      sceneNumber += 1;
      sceneHeadingText = item.text;
      shotCounterInScene = 0;
      continue;
    }
    if (item.kind !== 'directive') continue;

    const value = item.rest.trim();
    switch (item.keyword) {
      case 'SHOT': {
        flush();
        shotCounterInScene += 1;
        const { tag, description } = parseShotText(item.rest);
        current = { sceneNumber, sceneHeadingText, shotNumber: shotCounterInScene, description };
        if (tag !== undefined) current.tag = tag;
        break;
      }
      case 'POSE':
        if (current) current.pose = value;
        break;
      case 'LIGHT':
        if (current) current.light = value;
        break;
      case 'DURATION':
        if (current) {
          current.durationText = value;
          current.durationSeconds = parseDurationSeconds(value);
        }
        break;
      default:
        break;
    }
  }
  flush();

  return shots;
}
