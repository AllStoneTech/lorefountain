/**
 * Builds the per-shot "shot map" written to a script's `.shots.json`
 * sidecar (`sidecar.ts`): each shot's line range, what's heard in it, the
 * entities it mentions, its scene heading broken into parts, and pointers to
 * the cues that start inside it. It is the contract with downstream tools
 * (a video pipeline), which read it instead of parsing Fountain themselves.
 *
 * Exports {@link buildShotMap} plus the sidecar's entry types. Pure: entity
 * knowledge comes in as {@link ShotMapEntity}s built by the caller from the
 * index, so this module has no store or `vscode` dependency.
 *
 * Also reports per-script issues found during the same walk:
 * - `orphaned-parenthetical` (warning): an action block that starts with a
 *   parenthetical line, e.g. `(beat)` after a blank line. Under the Fountain
 *   spec a blank line ends a dialogue block, so it and the speech after it
 *   parse as action. It is reported, never reinterpreted (ADR-0038).
 * - `bare-pause-line` (info): a standalone action line such as `Beat.`,
 *   which stays ordinary action; the scene-pause convention is `PAUSE:`.
 * - `ambiguous-location` (info): a heading setting segment matching more
 *   than one location entity, left unresolved rather than guessed.
 * - `unforced-transition` (info): a transition that isn't forced with `>`
 *   but needs it under the Fountain spec, which detects only uppercase
 *   lines ending in `TO:`. Either a standalone line like `FADE IN:` that
 *   Fountain reads as action, or `FADE OUT.`/`FADE TO BLACK.`/`CUT TO
 *   BLACK.`, which `fountain-js` detects but other Fountain apps don't.
 *
 * Per shot, `spoken` holds every dialogue line, parenthetical (pauses and
 * other directions, wording kept), `PAUSE:` and lyric line, each with its
 * `line`, so `spoken`, `action` and `onScreen` merge into one timeline.
 *
 * Gotchas:
 * - Content before a scene's first `SHOT:` becomes an implicit shot 0 (no
 *   tag, no description) only when there is any: blank lines don't count.
 *   Content before the first scene heading becomes scene 0, shot 0.
 * - `cues` means "starts within this shot", not "audible during it".
 * - `entities` are mentions in the shot's own text (description, pose,
 *   light, action lines, speaker names) only: never dialogue, parentheticals
 *   or cue descriptions, and the heading's locations aren't added unless the
 *   shot's text names them.
 */

import { extractCues } from '../cues/parseCues';
import { parseDurationSeconds } from '../fountain/conventions';
import { extractMentionTargets, type MentionCandidate } from '../index/mentions';
import type { ValidationIssue } from '../model/errors';
import { parseShotText } from './parseShots';
import { scanScript, type CharacterItem, type ScriptItem } from './scanScript';
import { parseSceneHeading, type IntExt } from './sceneHeading';

/** One entity as the shot map needs it: id, entity type, and every name/alias that refers to it. */
export interface ShotMapEntity {
  id: string;
  /** The entity's `type` (`character`, `location`, ...). Only `location` entities resolve heading segments. */
  type: string;
  names: string[];
}

/** A line of dialogue heard in a shot. */
export interface SpokenLine {
  /** The character cue name, without extensions or `^`. */
  speaker: string;
  /** The entity id `speaker` resolves to, when it matches exactly one entity's name or alias. */
  speakerEntity?: string;
  /** Extensions on the character cue line (`V.O.`, `O.S.`, `FILTERED`, ...), in order, with `CONT'D` dropped. */
  extensions: string[];
  /** The spoken text, parentheticals removed. */
  text: string;
  /** True for the second speaker of Fountain dual dialogue (`^`): this line overlaps the entry just before it. */
  simultaneous?: true;
  /** 0-based line the text starts on. */
  line: number;
}

/** A parenthetical inside a character's dialogue that isn't a pause: a direction to the speaker, such as `(exhales)`. */
export interface SpeakerDirection {
  /** The parenthetical exactly as written, trimmed, parentheses included. */
  direction: string;
  speaker: string;
  speakerEntity?: string;
  line: number;
}

/** A pause written as a parenthetical inside a character's dialogue: dialogue coaching, owned by that speaker. */
export interface SpeakerPause {
  pause: 'speaker';
  /** The parenthetical exactly as written, trimmed, e.g. `(long beat)`. */
  direction: string;
  speaker: string;
  speakerEntity?: string;
  line: number;
}

/** A `PAUSE:` line: a silence that belongs to the scene, not to any speaker. */
export interface ScenePause {
  pause: 'scene';
  durationText?: string;
  durationSeconds?: number;
  line: number;
}

/** One line of Fountain lyrics (`~`): a sung line. */
export interface LyricLine {
  /** The lyric text without its `~`. */
  lyric: string;
  line: number;
}

/** Everything heard in a shot, in script order. */
export type SpokenEntry = SpokenLine | SpeakerDirection | SpeakerPause | ScenePause | LyricLine;

/** One Fountain action block in a shot (LoreFountain prefix lines excluded). */
export interface ShotAction {
  /** The block's lines, trimmed, joined with `\n`. */
  text: string;
  /** 0-based line of the block's first line. */
  line: number;
}

/** What kind of on-screen text an {@link OnScreenText} is. Only `centered` is written by scripts today; `super`, `titleCard` and `chyron` are reserved for the `SUPER:`/`TITLE CARD:`/`CHYRON:` prefix lines. */
export type OnScreenKind = 'super' | 'titleCard' | 'chyron' | 'centered';

/** Text meant to be seen on screen. */
export interface OnScreenText {
  kind: OnScreenKind;
  /** A style tag, for the prefix-line kinds. */
  tag?: string;
  text: string;
  line: number;
}

/** One shot in the `.shots.json` sidecar. */
export interface ShotMapEntry {
  /** Scene number (1-based), or 0 for content before the first scene heading. */
  scene: number;
  /** Shot number within the scene (1-based), or 0 for the implicit shot before the scene's first `SHOT:`. */
  shot: number;
  tag?: string;
  /** The scene heading text; absent for scene 0. */
  sceneHeading?: string;
  intExt?: IntExt;
  timeOfDay?: string;
  /** Heading setting segments, raw, in heading order. */
  setting: string[];
  /** Location entity ids resolved from `setting`, in the same order; unmatched and ambiguous segments are left out. */
  locations: string[];
  /** The `SHOT:` text without its tag; absent on shot 0. */
  description?: string;
  pose?: string;
  light?: string;
  durationText?: string;
  durationSeconds?: number;
  /** 0-based, inclusive line range: from the `SHOT:` line (or scene heading, for shot 0) to the line before the next shot or heading, or the end of the file. */
  lines: { start: number; end: number };
  spoken: SpokenEntry[];
  /** The shot's action blocks, in script order. */
  action: ShotAction[];
  /** On-screen text in the shot, in script order. */
  onScreen: OnScreenText[];
  /** The last Fountain transition inside the shot's lines, as Fountain reads it (no leading `>`), e.g. `DISSOLVE TO:`. */
  transition?: string;
  /** Deduplicated ids of entities mentioned in the shot's own text. */
  entities: string[];
  /** 0-based lines of `SFX:`/`MUSIC:`/`AMB:` cues that start in this shot: pointers into `.cues.json`. */
  cues: number[];
}

/** A per-script issue found while building the shot map. */
export interface ScriptShotIssue extends ValidationIssue {
  code: 'orphaned-parenthetical' | 'bare-pause-line' | 'ambiguous-location' | 'unforced-transition';
  /** `warning` is reported like every other non-blocking warning; `info` is a note. */
  severity: 'warning' | 'info';
  /** 0-based line the issue is on. */
  line: number;
}

/** Result of {@link buildShotMap}. */
export interface ShotMapResult {
  /** Every shot, including implicit shot 0s, in document order. */
  shots: ShotMapEntry[];
  /** True when the script has at least one explicit `SHOT:` line (an implicit shot 0 alone doesn't count). */
  hasExplicitShots: boolean;
  issues: ScriptShotIssue[];
}

/** Pause parentheticals inside dialogue, compared lowercased with whitespace collapsed. */
export const SPEAKER_PAUSE_PARENTHETICALS: readonly string[] = [
  '(beat)',
  '(a beat)',
  '(long beat)',
  '(pause)',
  '(a pause)',
  '(long pause)',
  '(silence)',
];

/** Standalone action lines that look like a pause, compared lowercased with whitespace collapsed. */
export const BARE_PAUSE_LINES: readonly string[] = [
  'beat.',
  'a beat.',
  'a long beat.',
  'pause.',
  'a pause.',
  'silence.',
  'a long silence.',
  'a moment.',
];

const SPEAKER_PAUSES = new Set(SPEAKER_PAUSE_PARENTHETICALS);
const BARE_PAUSES = new Set(BARE_PAUSE_LINES);

/** A shot being accumulated before its line range is closed. */
interface OpenShot {
  entry: ShotMapEntry;
  /** Text whose entity mentions count for this shot. */
  mentionText: string[];
  hasContent: boolean;
  explicit: boolean;
  /** The line of the action line just applied, while the next item could still continue its block. */
  lastActionLine?: number;
}

/** The current scene's heading-derived fields. */
interface SceneContext {
  scene: number;
  sceneHeading?: string;
  intExt?: IntExt;
  timeOfDay?: string;
  setting: string[];
  locations: string[];
}

/**
 * Build a script's shot map and per-script shot issues.
 *
 * @param scriptText - The `.fountain` file's full text.
 * @param entities - Every known entity, for mention, speaker and location resolution.
 * @returns The shots, whether any explicit `SHOT:` exists, and any issues found.
 */
export function buildShotMap(scriptText: string, entities: readonly ShotMapEntity[]): ShotMapResult {
  const items = scanScript(scriptText);
  const lastLine = lastLineIndex(scriptText);
  const cueLines = extractCues(scriptText).map((cue) => cue.line);
  const candidates: MentionCandidate[] = entities.map((entity) => ({ id: entity.id, kind: 'entity', names: entity.names }));

  const shots: ShotMapEntry[] = [];
  const issues: ScriptShotIssue[] = [...findFormatIssues(items, scriptText.split(/\r\n|\r|\n/))];
  let hasExplicitShots = false;
  let scene: SceneContext | undefined;
  let shotCounter = 0;
  let open: OpenShot | undefined;

  const close = (endLine: number): void => {
    if (!open) return;
    if (open.explicit || open.hasContent) {
      const { entry } = open;
      entry.lines.end = Math.max(entry.lines.start, endLine);
      entry.cues = cueLines.filter((line) => line >= entry.lines.start && line <= entry.lines.end);
      entry.entities = extractMentionTargets(open.mentionText.join('\n'), candidates).map((target) => target.id);
      shots.push(inFieldOrder(entry));
    }
    open = undefined;
  };

  const openShot = (line: number, shot: number, explicit: boolean): OpenShot => {
    const context: SceneContext = scene ?? { scene: 0, setting: [], locations: [] };
    const entry: ShotMapEntry = {
      scene: context.scene,
      shot,
      ...(context.sceneHeading !== undefined ? { sceneHeading: context.sceneHeading } : {}),
      ...(context.intExt !== undefined ? { intExt: context.intExt } : {}),
      ...(context.timeOfDay !== undefined ? { timeOfDay: context.timeOfDay } : {}),
      setting: [...context.setting],
      locations: [...context.locations],
      lines: { start: line, end: line },
      spoken: [],
      action: [],
      onScreen: [],
      entities: [],
      cues: [],
    };
    return { entry, mentionText: [], hasContent: false, explicit };
  };

  for (const item of items) {
    if (item.kind === 'heading') {
      close(item.line - 1);
      const parts = parseSceneHeading(item.text);
      const resolved = resolveLocations(parts.setting, entities, item);
      issues.push(...resolved.issues);
      scene = {
        scene: (scene?.scene ?? 0) + 1,
        sceneHeading: item.text,
        intExt: parts.intExt,
        timeOfDay: parts.timeOfDay,
        setting: parts.setting,
        locations: resolved.ids,
      };
      shotCounter = 0;
      open = openShot(item.line, 0, false);
      continue;
    }

    if (item.kind === 'directive' && item.keyword === 'SHOT') {
      close(item.line - 1);
      hasExplicitShots = true;
      shotCounter += 1;
      open = openShot(item.line, shotCounter, true);
      const { tag, description } = parseShotText(item.rest);
      if (tag !== undefined) open.entry.tag = tag;
      open.entry.description = description;
      open.mentionText.push(description);
      continue;
    }

    // Content before the first scene heading: scene 0, shot 0.
    open ??= openShot(item.line, 0, false);
    open.hasContent = true;
    applyItem(open, item, entities);
  }
  close(lastLine);

  return { shots, hasExplicitShots, issues };
}

/** Apply one non-heading, non-SHOT item to the open shot. */
function applyItem(open: OpenShot, item: ScriptItem, entities: readonly ShotMapEntity[]): void {
  const { entry } = open;
  switch (item.kind) {
    case 'directive': {
      const value = item.rest.trim();
      // POSE:/LIGHT:/DURATION: before any SHOT: are inert, exactly as in `extractShots`.
      if (item.keyword === 'POSE' && open.explicit) {
        entry.pose = value;
        open.mentionText.push(value);
      } else if (item.keyword === 'LIGHT' && open.explicit) {
        entry.light = value;
        open.mentionText.push(value);
      } else if (item.keyword === 'DURATION' && open.explicit) {
        entry.durationText = value;
        const seconds = parseDurationSeconds(value);
        if (seconds === undefined) delete entry.durationSeconds;
        else entry.durationSeconds = seconds;
      } else if (item.keyword === 'PAUSE') {
        entry.spoken.push(scenePause(value, item.line));
      }
      open.lastActionLine = undefined;
      return;
    }
    case 'action': {
      open.mentionText.push(item.text);
      const last = entry.action[entry.action.length - 1];
      if (!item.blockStart && last !== undefined && open.lastActionLine === item.line - 1) {
        last.text = `${last.text}\n${item.text}`;
      } else {
        entry.action.push({ text: item.text, line: item.line });
      }
      open.lastActionLine = item.line;
      return;
    }
    case 'character':
      open.mentionText.push(item.name);
      break;
    case 'parenthetical':
      entry.spoken.push(
        SPEAKER_PAUSES.has(normalize(item.text))
          ? speakerPause(item.speaker, item.text, item.line, entities)
          : speakerDirection(item.speaker, item.text, item.line, entities),
      );
      break;
    case 'dialogue':
      entry.spoken.push(spokenLine(item.speaker, item.text, item.line, entities));
      break;
    case 'lyric':
      entry.spoken.push({ lyric: item.text, line: item.line });
      break;
    case 'centered':
      entry.onScreen.push({ kind: 'centered', text: item.text, line: item.line });
      break;
    case 'transition':
      entry.transition = item.text;
      break;
    default:
      break;
  }
  open.lastActionLine = undefined;
}

/** Build a `{ pause: 'scene' }` entry from a `PAUSE:` line's text. */
function scenePause(value: string, line: number): ScenePause {
  const seconds = value ? parseDurationSeconds(value) : undefined;
  return {
    pause: 'scene',
    ...(value ? { durationText: value } : {}),
    ...(seconds !== undefined ? { durationSeconds: seconds } : {}),
    line,
  };
}

/** Build a `{ pause: 'speaker' }` entry for a pause parenthetical. */
function speakerPause(
  speaker: CharacterItem,
  direction: string,
  line: number,
  entities: readonly ShotMapEntity[],
): SpeakerPause {
  const speakerEntity = resolveExactName(speaker.name, entities);
  return {
    pause: 'speaker',
    direction,
    speaker: speaker.name,
    ...(speakerEntity !== undefined ? { speakerEntity } : {}),
    line,
  };
}

/** Build a `{ direction }` entry for a non-pause parenthetical. */
function speakerDirection(
  speaker: CharacterItem,
  direction: string,
  line: number,
  entities: readonly ShotMapEntity[],
): SpeakerDirection {
  const speakerEntity = resolveExactName(speaker.name, entities);
  return {
    direction,
    speaker: speaker.name,
    ...(speakerEntity !== undefined ? { speakerEntity } : {}),
    line,
  };
}

/** Build a spoken-line entry. */
function spokenLine(speaker: CharacterItem, text: string, line: number, entities: readonly ShotMapEntity[]): SpokenLine {
  const speakerEntity = resolveExactName(speaker.name, entities);
  // Built in sidecar field order: speaker, speakerEntity, extensions, text, simultaneous, line.
  return {
    speaker: speaker.name,
    ...(speakerEntity !== undefined ? { speakerEntity } : {}),
    extensions: [...speaker.extensions],
    text,
    ...(speaker.simultaneous ? { simultaneous: true as const } : {}),
    line,
  };
}

/**
 * Resolve a whole name to the one entity whose name or alias equals it
 * (case-insensitive, trimmed). Never guesses: no match, or more than one
 * distinct entity, yields `undefined`.
 */
function resolveExactName(name: string, entities: readonly ShotMapEntity[]): string | undefined {
  const ids = idsMatchingName(name, entities);
  return ids.length === 1 ? ids[0] : undefined;
}

/** Distinct ids of entities with a name or alias equal to `name` (case-insensitive, trimmed). */
function idsMatchingName(name: string, entities: readonly ShotMapEntity[]): string[] {
  const key = name.trim().toLowerCase();
  if (!key) return [];
  const ids = new Set<string>();
  for (const entity of entities) {
    if (entity.names.some((candidate) => candidate.trim().toLowerCase() === key)) ids.add(entity.id);
  }
  return [...ids];
}

/** Resolve heading setting segments to location entity ids, reporting ambiguous segments. */
function resolveLocations(
  setting: readonly string[],
  entities: readonly ShotMapEntity[],
  heading: { line: number; text: string },
): { ids: string[]; issues: ScriptShotIssue[] } {
  const locations = entities.filter((entity) => entity.type === 'location');
  const ids: string[] = [];
  const issues: ScriptShotIssue[] = [];
  for (const segment of setting) {
    const matches = idsMatchingName(segment, locations);
    if (matches.length === 1) {
      ids.push(matches[0]);
    } else if (matches.length > 1) {
      issues.push({
        code: 'ambiguous-location',
        severity: 'info',
        line: heading.line,
        path: `lines[${heading.line}]`,
        message: `Scene heading "${heading.text}" (line ${heading.line + 1}): "${segment}" matches more than one location (${matches.join(', ')}), so it was left unresolved. Give one of them a more specific name or alias.`,
      });
    }
  }
  return { ids, issues };
}

/**
 * True for an uppercase line that reads as a transition but that the
 * Fountain spec only detects when forced with `>`: `FADE IN:`, `FADE OUT.`,
 * `CUT TO BLACK.` and the like, plus a `... TO:` line Fountain didn't detect.
 *
 * @param text - The line's text, trimmed.
 * @returns Whether the line looks like a transition.
 */
export function looksLikeTransition(text: string): boolean {
  if (!/[A-Z]/.test(text) || text !== text.toUpperCase()) return false;
  return TRANSITION_LIKE.test(text);
}

/** Transition wordings the Fountain spec doesn't detect without `>` (it detects only uppercase lines ending in `TO:`). */
const TRANSITION_LIKE =
  /^(?:(?:FADE (?:IN|OUT|UP|TO BLACK|TO WHITE)|CUT TO BLACK|CUT TO WHITE|SMASH TO BLACK|IRIS (?:IN|OUT))[.:]?|.+ TO:)$/;

/** Find `orphaned-parenthetical`, `bare-pause-line` and `unforced-transition` issues in a scanned script. */
function findFormatIssues(items: readonly ScriptItem[], rawLines: readonly string[]): ScriptShotIssue[] {
  const issues: ScriptShotIssue[] = [];
  const isBlank = (line: number): boolean => (rawLines[line] ?? '').trim() === '';
  for (const item of items) {
    if (item.kind === 'transition' && !item.forced && !/ TO:$/.test(item.text)) {
      issues.push({
        code: 'unforced-transition',
        severity: 'info',
        line: item.line,
        path: `lines[${item.line}]`,
        message: `"${item.text}" (line ${item.line + 1}) is read as a transition here, but the Fountain spec only detects transitions that end in TO:, so other Fountain apps read it as action. Start it with > to force the transition.`,
      });
      continue;
    }
    if (item.kind !== 'action') continue;
    if (item.blockStart && isBlank(item.line - 1) && isBlank(item.line + 1) && looksLikeTransition(item.text)) {
      issues.push({
        code: 'unforced-transition',
        severity: 'info',
        line: item.line,
        path: `lines[${item.line}]`,
        message: `"${item.text}" (line ${item.line + 1}) looks like a transition, but Fountain only detects transitions that end in TO:, so it reads this line as action. Start it with > to force the transition.`,
      });
    }
    if (item.blockStart && /^\(.*\)$/.test(item.text)) {
      issues.push({
        code: 'orphaned-parenthetical',
        severity: 'warning',
        line: item.line,
        path: `lines[${item.line}]`,
        message: `"${item.text}" (line ${item.line + 1}) follows a blank line, so Fountain reads it, and the lines after it, as action rather than dialogue. Remove the blank line to keep the speech in one dialogue block, or, if a SHOT: or other line interrupts the speech, repeat the character cue with (CONT'D).`,
      });
    }
    if (BARE_PAUSES.has(normalize(item.text))) {
      issues.push({
        code: 'bare-pause-line',
        severity: 'info',
        line: item.line,
        path: `lines[${item.line}]`,
        message: `"${item.text}" (line ${item.line + 1}) is ordinary action. If it's meant as a scene pause, write it as PAUSE: (optionally with a length, e.g. PAUSE: 2s).`,
      });
    }
  }
  return issues;
}

/** Rebuild an entry with its keys in the documented sidecar order (fields set later during the walk would otherwise land at the end). Absent optional fields are omitted. */
function inFieldOrder(entry: ShotMapEntry): ShotMapEntry {
  const ordered: ShotMapEntry = {
    scene: entry.scene,
    shot: entry.shot,
    tag: entry.tag,
    sceneHeading: entry.sceneHeading,
    intExt: entry.intExt,
    timeOfDay: entry.timeOfDay,
    setting: entry.setting,
    locations: entry.locations,
    description: entry.description,
    pose: entry.pose,
    light: entry.light,
    durationText: entry.durationText,
    durationSeconds: entry.durationSeconds,
    lines: entry.lines,
    spoken: entry.spoken,
    action: entry.action,
    onScreen: entry.onScreen,
    transition: entry.transition,
    entities: entry.entities,
    cues: entry.cues,
  };
  for (const key of Object.keys(ordered) as (keyof ShotMapEntry)[]) {
    if (ordered[key] === undefined) delete ordered[key];
  }
  return ordered;
}

/** Lowercase and collapse whitespace, for exact list comparison. */
function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** The index of the script's last line, ignoring a single trailing newline. */
function lastLineIndex(text: string): number {
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.length > 1 && lines[lines.length - 1] === '') return lines.length - 2;
  return lines.length - 1;
}
