/**
 * Breaks a Fountain scene heading into its standard parts: the INT./EXT.
 * prefix, the setting segments, and a trailing time of day.
 *
 * Exports {@link parseSceneHeading} and {@link SceneHeadingParts}. Pure, no
 * entity knowledge: resolving setting segments to location entities is
 * `shotMap.ts`'s job.
 *
 * Gotchas:
 * - Writers separate segments with a hyphen, an en dash or an em dash (all
 *   three appear in real scripts), always with whitespace around it.
 * - Segment order is kept exactly as written. Writers order them both ways
 *   (`LUCIEN'S BASEMENT — WEST ORANGE, NJ` runs specific to general), so no
 *   ordering is ever claimed.
 * - Only a recognized time-of-day word in the *final* segment becomes
 *   `timeOfDay`; anything else (`SPUNK, 1925`) stays part of the setting.
 *   Nothing is guessed.
 */

/** INT./EXT. as written in a heading's prefix. */
export type IntExt = 'INT' | 'EXT' | 'INT/EXT';

/** The parts of one scene heading. */
export interface SceneHeadingParts {
  /** From the heading prefix. Absent for a forced heading (`.HEADING`) or an `EST.` prefix, which doesn't say interior or exterior. */
  intExt?: IntExt;
  /** The final segment, raw, when it's a recognized time-of-day word. */
  timeOfDay?: string;
  /** The remaining segments, raw, in heading order. */
  setting: string[];
}

/** Recognized time-of-day words for a heading's final segment (compared case-insensitively). */
export const TIME_OF_DAY_WORDS: readonly string[] = [
  'DAY',
  'NIGHT',
  'MORNING',
  'AFTERNOON',
  'EVENING',
  'DAWN',
  'DUSK',
  'CONTINUOUS',
  'LATER',
  'MOMENTS LATER',
  'SAME',
];

const TIME_OF_DAY = new Set(TIME_OF_DAY_WORDS);

/** Heading prefixes, longest first so `INT./EXT.` isn't read as `INT.`. Group 1 is the prefix. */
const HEADING_PREFIX = /^(INT\.?\s*\/\s*EXT|EXT\.?\s*\/\s*INT|I\s*\/\s*E|INT|EXT|EST)\.?(?:\s+|$)/i;

/** A segment separator: hyphen, en dash or em dash with whitespace around it. */
const SEGMENT_SEPARATOR = /\s+[-–—]\s+/;

/** A trailing Fountain scene number, e.g. `#12#` or `#1A#`. */
const SCENE_NUMBER = /\s*#[^#]*#\s*$/;

/**
 * Break a scene heading into its parts.
 *
 * @param heading - The heading text, e.g. `INT. LUCIEN'S BASEMENT — WEST ORANGE, NJ — NIGHT`.
 * @returns The INT./EXT. value, time of day, and setting segments found.
 */
export function parseSceneHeading(heading: string): SceneHeadingParts {
  let remaining = heading.trim().replace(SCENE_NUMBER, '');
  if (remaining.startsWith('.')) remaining = remaining.slice(1);

  const parts: SceneHeadingParts = { setting: [] };
  const prefix = HEADING_PREFIX.exec(remaining);
  if (prefix) {
    const intExt = intExtFrom(prefix[1]);
    if (intExt) parts.intExt = intExt;
    remaining = remaining.slice(prefix[0].length);
  }

  const segments = remaining
    .split(SEGMENT_SEPARATOR)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  const last = segments[segments.length - 1];
  if (last !== undefined && TIME_OF_DAY.has(last.toUpperCase())) {
    parts.timeOfDay = last;
    segments.pop();
  }
  parts.setting = segments;
  return parts;
}

/** Map a matched heading prefix to its INT./EXT. value, or `undefined` for `EST`. */
function intExtFrom(prefix: string): IntExt | undefined {
  const normalized = prefix.toUpperCase().replace(/[\s.]/g, '');
  if (normalized === 'INT') return 'INT';
  if (normalized === 'EXT') return 'EXT';
  if (normalized === 'EST') return undefined;
  return 'INT/EXT';
}
