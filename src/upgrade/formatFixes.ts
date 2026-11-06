/**
 * Plans the standard Fountain corrections behind the quick fixes and "Fix
 * All Script Formatting Issues" (ADR-0039). Pure: text in, text edits out.
 * The `vscode` glue is `providers/scriptQuickFixes.ts` and
 * `commands/fixScriptFormatting.ts`.
 *
 * Every fix is exactly one standard Fountain correction, never a
 * reinterpretation (ADR-0038):
 * - `orphaned-parenthetical`, join: when the nearest content above is a
 *   dialogue block, delete the blank line(s) in between so the
 *   parenthetical and the speech after it rejoin that block.
 * - `orphaned-parenthetical`, re-cue: when other lines separate it from the
 *   speaker's last dialogue block in the same scene, insert
 *   `SPEAKER (CONT'D)` (keeping the speaker's cue-line extensions) right
 *   above the parenthetical.
 * - `bare-pause-line`: replace a standalone `Beat.`-style line with `PAUSE:`.
 *
 * Exports {@link planLineFix} (one issue, for a quick fix) and
 * {@link planAllFixes} (a whole script, for Fix All).
 *
 * Gotchas:
 * - Fix All only re-cues when nothing but LoreFountain prefix lines
 *   (`SHOT:`, `SFX:`, ...) separates the orphan from the speaker. If plain
 *   action intervenes, it might really be action, so Fix All skips it and
 *   counts it; the single quick fix still offers the re-cue, because a
 *   person is choosing it.
 * - Fix All handles chains (`(beat)` after a blank line, twice in one
 *   speech): once an orphan is fixed, its lines count as dialogue for the
 *   next orphan below it.
 * - A re-cue needs a speaker in the same scene; with none, no fix is offered.
 * - A parenthetical alone between blank lines (`(beat)` with a blank line on
 *   each side, then a paragraph) gets a join or re-cue that also absorbs the
 *   paragraph after it; otherwise the speech would end in a bare `(beat)` and
 *   that paragraph would stay action. Whether the paragraph is the speaker
 *   continuing or real action can't be known, so Fix All skips this shape
 *   and counts it as needing a manual fix.
 */

import { buildShotMap } from '../shots/shotMap';
import { scanScript, type CharacterItem, type ScriptItem } from '../shots/scanScript';

/** A 0-based line/character position. */
export interface TextPosition {
  line: number;
  character: number;
}

/** One text replacement (an empty `newText` deletes, an empty range inserts). */
export interface TextEditPlan {
  start: TextPosition;
  end: TextPosition;
  newText: string;
}

/** The kinds of fix this module plans. */
export type FormatFixKind = 'join' | 'recue' | 'pause';

/** One planned fix for one issue. */
export interface FormatFix {
  kind: FormatFixKind;
  /** The issue's 0-based line. */
  line: number;
  /** A short, user-facing title, e.g. `Re-cue MARA (CONT'D) above this line`. */
  title: string;
  edit: TextEditPlan;
  /** False for a re-cue across plain action: offered as a quick fix, skipped by Fix All. */
  safeForFixAll: boolean;
}

/** Result of {@link planAllFixes}. */
export interface FixAllPlan {
  fixes: FormatFix[];
  /** Fixable-code issues Fix All left alone (no speaker, or plain action in the way). */
  skipped: number;
}

/** Issue codes this module can fix. */
export const FIXABLE_CODES: ReadonlySet<string> = new Set(['orphaned-parenthetical', 'bare-pause-line']);

/** What occupies each physical line, as far as the planner cares. */
type LineKind = 'blank' | 'heading' | 'directive' | 'action' | 'dialogue' | 'other';

/** Per-script context shared by the planners. */
interface ScriptContext {
  lines: string[];
  eol: string;
  items: ScriptItem[];
  lineKinds: LineKind[];
}

/**
 * Plan the fix for one issue at `line`, for a quick fix.
 *
 * @param text - The script's current text.
 * @param code - The issue code (`orphaned-parenthetical` or `bare-pause-line`).
 * @param line - The issue's 0-based line.
 * @returns The fix, or `undefined` when no single standard fix applies.
 */
export function planLineFix(text: string, code: string, line: number): FormatFix | undefined {
  const context = analyze(text);
  if (code === 'bare-pause-line') return planPause(context, line);
  if (code === 'orphaned-parenthetical') return planOrphan(context, line, new Map());
  return undefined;
}

/**
 * Plan every safe fix in a script, for Fix All.
 *
 * @param text - The script's current text.
 * @returns Non-overlapping fixes in line order, and how many fixable issues were skipped.
 */
export function planAllFixes(text: string): FixAllPlan {
  const context = analyze(text);
  const issues = buildShotMap(text, [])
    .issues.filter((issue) => FIXABLE_CODES.has(issue.code))
    .sort((a, b) => a.line - b.line);

  /** Lines that will be dialogue once earlier fixes apply, with their speaker. */
  const becomingDialogue = new Map<number, CharacterItem | undefined>();
  const fixes: FormatFix[] = [];
  let skipped = 0;

  for (const issue of issues) {
    const fix =
      issue.code === 'bare-pause-line' ? planPause(context, issue.line) : planOrphan(context, issue.line, becomingDialogue);
    if (!fix || !fix.safeForFixAll) {
      skipped += 1;
      continue;
    }
    fixes.push(fix);
    if (fix.kind !== 'pause') {
      const speaker = fix.kind === 'recue' ? speakerAbove(context, issue.line, becomingDialogue) : undefined;
      for (const blockLine of actionBlockLines(context, issue.line)) becomingDialogue.set(blockLine, speaker);
    }
  }
  return { fixes, skipped };
}

/** Plan the `PAUSE:` replacement for a bare pause line. */
function planPause(context: ScriptContext, line: number): FormatFix | undefined {
  const text = context.lines[line];
  if (text === undefined || context.lineKinds[line] !== 'action') return undefined;
  const indent = text.length - text.trimStart().length;
  return {
    kind: 'pause',
    line,
    title: 'Replace with PAUSE:',
    edit: { start: { line, character: indent }, end: { line, character: text.trimEnd().length }, newText: 'PAUSE:' },
    safeForFixAll: true,
  };
}

/** Plan the join or re-cue for an orphaned parenthetical. */
function planOrphan(
  context: ScriptContext,
  line: number,
  becomingDialogue: ReadonlyMap<number, CharacterItem | undefined>,
): FormatFix | undefined {
  const previous = previousContentLine(context, line);
  if (previous === undefined) return undefined;
  // A parenthetical alone between blank lines: rejoining only its top would
  // leave the speech ending in a bare `(beat)` with the next paragraph still
  // action. Whether that paragraph is the same speaker continuing or real
  // action can't be known, so the fix that absorbs it is never used by Fix All.
  const following = isolatedFollowingText(context, line);
  const parenthetical = context.lines[line];
  const eol = context.eol;

  if (context.lineKinds[previous] === 'dialogue' || becomingDialogue.has(previous)) {
    if (following !== undefined) {
      return {
        kind: 'join',
        line,
        title: 'Join to the previous speech, with the line after it (remove the blank lines)',
        edit: {
          start: { line: previous, character: context.lines[previous].length },
          end: { line: following, character: 0 },
          newText: `${eol}${parenthetical}${eol}`,
        },
        safeForFixAll: false,
      };
    }
    return {
      kind: 'join',
      line,
      title: 'Join to the previous speech (remove the blank line)',
      edit: {
        start: { line: previous, character: context.lines[previous].length },
        end: { line: line - 1, character: context.lines[line - 1].length },
        newText: '',
      },
      safeForFixAll: true,
    };
  }

  const speaker = speakerAbove(context, line, becomingDialogue);
  if (!speaker) return undefined;
  const cue = [speaker.name, ...speaker.extensions.map((extension) => `(${extension})`), "(CONT'D)"].join(' ');
  if (following !== undefined) {
    return {
      kind: 'recue',
      line,
      title: `Re-cue ${cue} above this line, with the line after it`,
      edit: { start: { line, character: 0 }, end: { line: following, character: 0 }, newText: `${cue}${eol}${parenthetical}${eol}` },
      safeForFixAll: false,
    };
  }
  return {
    kind: 'recue',
    line,
    title: `Re-cue ${cue} above this line`,
    edit: { start: { line, character: 0 }, end: { line, character: 0 }, newText: `${cue}${eol}` },
    safeForFixAll: onlyDirectivesBetween(context, line, becomingDialogue),
  };
}

/**
 * When the orphaned parenthetical at `line` is alone in its action block and
 * the next content after blank lines is plain action text, return that next
 * block's first line (the text the parenthetical presumably introduces).
 * Otherwise `undefined`: the parenthetical already has text under it, or
 * what follows is a cue, heading, prefix line or the end of the script.
 */
function isolatedFollowingText(context: ScriptContext, line: number): number | undefined {
  if (context.lineKinds[line + 1] !== 'blank') return undefined;
  let next = line + 1;
  while (next < context.lines.length && context.lineKinds[next] === 'blank') next += 1;
  if (next >= context.lines.length || context.lineKinds[next] !== 'action') return undefined;
  // Another parenthetical-led block is its own orphan, fixed separately.
  return /^\(.*\)$/.test(context.lines[next].trim()) ? undefined : next;
}

/**
 * The speaker of the nearest dialogue block above `line` in the same scene,
 * or of an earlier orphan that a planned re-cue turns into that speaker's
 * dialogue.
 */
function speakerAbove(
  context: ScriptContext,
  line: number,
  becomingDialogue: ReadonlyMap<number, CharacterItem | undefined>,
): CharacterItem | undefined {
  for (let current = line - 1; current >= 0; current -= 1) {
    if (context.lineKinds[current] === 'heading') return undefined;
    if (becomingDialogue.has(current)) {
      const speaker = becomingDialogue.get(current);
      if (speaker) return speaker;
    }
    if (context.lineKinds[current] === 'dialogue') {
      const owner = dialogueOwner(context, current);
      if (owner) return owner;
    }
  }
  return undefined;
}

/** The character cue whose dialogue block contains `line`. */
function dialogueOwner(context: ScriptContext, line: number): CharacterItem | undefined {
  let owner: CharacterItem | undefined;
  for (const item of context.items) {
    if (item.line > line) break;
    if (item.kind === 'character') owner = item;
    else if (item.kind === 'heading') owner = undefined;
  }
  return owner;
}

/** True when every content line between the speaker's last dialogue and `line` is a prefix line. */
function onlyDirectivesBetween(
  context: ScriptContext,
  line: number,
  becomingDialogue: ReadonlyMap<number, CharacterItem | undefined>,
): boolean {
  for (let current = line - 1; current >= 0; current -= 1) {
    const kind = context.lineKinds[current];
    if (kind === 'dialogue' || becomingDialogue.has(current)) return true;
    if (kind === 'blank' || kind === 'directive') continue;
    return false;
  }
  return false;
}

/** The nearest non-blank line above `line`. */
function previousContentLine(context: ScriptContext, line: number): number | undefined {
  for (let current = line - 1; current >= 0; current -= 1) {
    if (context.lineKinds[current] !== 'blank') return current;
  }
  return undefined;
}

/** The lines of the action block starting at `line` (it and the action lines directly under it). */
function actionBlockLines(context: ScriptContext, line: number): number[] {
  const result: number[] = [];
  for (let current = line; context.lineKinds[current] === 'action'; current += 1) result.push(current);
  return result;
}

/** Split the text and classify every physical line. */
function analyze(text: string): ScriptContext {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r\n|\r|\n/);
  const items = scanScript(text);
  const lineKinds: LineKind[] = lines.map((lineText) => (lineText.trim() === '' ? 'blank' : 'other'));

  // Each item claims its own line; a dialogue run also claims the non-blank
  // lines that continue it, up to the next item.
  items.forEach((item, index) => {
    const kind = lineKindOf(item);
    lineKinds[item.line] = kind;
    if (item.kind !== 'dialogue') return;
    const nextItemLine = items[index + 1]?.line ?? lines.length;
    for (let current = item.line + 1; current < nextItemLine && lineKinds[current] !== 'blank'; current += 1) {
      lineKinds[current] = 'dialogue';
    }
  });
  return { lines, eol, items, lineKinds };
}

/** Map a scanned item to the line kind the planner uses. */
function lineKindOf(item: ScriptItem): LineKind {
  switch (item.kind) {
    case 'heading':
      return 'heading';
    case 'directive':
      return 'directive';
    case 'action':
      return 'action';
    case 'character':
    case 'parenthetical':
    case 'dialogue':
      return 'dialogue';
    default:
      return 'other';
  }
}
