/**
 * Unit tests for `upgrade/formatFixes.ts`: the quick-fix and Fix All
 * planners. Fixes are applied to the text here so each test checks the
 * resulting script, not just the edit coordinates.
 */

import { describe, expect, it } from 'vitest';
import { buildShotMap } from '../../src/shots/shotMap';
import { planAllFixes, planLineFix, type FormatFix } from '../../src/upgrade/formatFixes';

/** Apply planned fixes to `text`, last first so earlier offsets stay valid. */
function apply(text: string, fixes: readonly FormatFix[]): string {
  const lines = text.split(/\r?\n/);
  const eolLength = text.includes('\r\n') ? 2 : 1;
  const offset = (line: number, character: number): number =>
    lines.slice(0, line).reduce((total, current) => total + current.length + eolLength, 0) + character;
  let result = text;
  const ordered = [...fixes].sort(
    (a, b) => offset(b.edit.start.line, b.edit.start.character) - offset(a.edit.start.line, a.edit.start.character),
  );
  for (const fix of ordered) {
    const start = offset(fix.edit.start.line, fix.edit.start.character);
    const end = offset(fix.edit.end.line, fix.edit.end.character);
    result = result.slice(0, start) + fix.edit.newText + result.slice(end);
  }
  return result;
}

/** Fixable issues still present in `text`. */
function remainingCodes(text: string): string[] {
  return buildShotMap(text, [])
    .issues.filter((issue) => issue.code === 'orphaned-parenthetical' || issue.code === 'bare-pause-line')
    .map((issue) => issue.code);
}

describe('planLineFix', () => {
  it('joins an orphaned parenthetical to the speech right above it', () => {
    const text = 'INT. A - DAY\n\nMARA\nYou found us.\n\n(beat)\nYou are ready.\n';
    const fix = planLineFix(text, 'orphaned-parenthetical', 5);
    expect(fix).toMatchObject({ kind: 'join', safeForFixAll: true });
    expect(apply(text, [fix!])).toBe('INT. A - DAY\n\nMARA\nYou found us.\n(beat)\nYou are ready.\n');
  });

  it('removes several blank lines when joining', () => {
    const text = 'INT. A - DAY\n\nMARA\nHi.\n\n\n(beat)\nBye.\n';
    expect(apply(text, [planLineFix(text, 'orphaned-parenthetical', 6)!])).toBe('INT. A - DAY\n\nMARA\nHi.\n(beat)\nBye.\n');
  });

  it('re-cues the speaker, keeping extensions, when a SHOT: interrupts the speech', () => {
    const text = 'INT. A - DAY\n\nTHE ARCHIVE (V.O.) (FILTERED)\nYou found us.\n\nSHOT: CLOSE, abstract\nDURATION: ~5s\n\n(beat)\nWelcome.\n';
    const fix = planLineFix(text, 'orphaned-parenthetical', 8);
    expect(fix).toMatchObject({ kind: 'recue', safeForFixAll: true, title: "Re-cue THE ARCHIVE (V.O.) (FILTERED) (CONT'D) above this line" });
    const fixed = apply(text, [fix!]);
    expect(fixed).toContain("SHOT: CLOSE, abstract\nDURATION: ~5s\n\nTHE ARCHIVE (V.O.) (FILTERED) (CONT'D)\n(beat)\nWelcome.\n");
    expect(remainingCodes(fixed)).toEqual([]);
  });

  it('offers a re-cue across plain action, but marks it unsafe for Fix All', () => {
    const text = 'INT. A - DAY\n\nMARA\nHi.\n\nShe turns away.\n\n(beat)\nBye.\n';
    expect(planLineFix(text, 'orphaned-parenthetical', 7)).toMatchObject({ kind: 'recue', safeForFixAll: false });
  });

  it('offers no fix when there is no speaker earlier in the scene', () => {
    const text = 'INT. A - DAY\n\nMARA\nHi.\n\nINT. B - DAY\n\nThe room is empty.\n\n(beat)\nHmm.\n';
    expect(planLineFix(text, 'orphaned-parenthetical', 9)).toBeUndefined();
  });

  it('replaces a standalone pause line with PAUSE:, keeping indentation', () => {
    const text = 'INT. A - DAY\n\n   A long beat.\n';
    const fix = planLineFix(text, 'bare-pause-line', 2);
    expect(apply(text, [fix!])).toBe('INT. A - DAY\n\n   PAUSE:\n');
  });

  it('keeps CRLF line endings when inserting a cue', () => {
    const text = 'INT. A - DAY\r\n\r\nMARA\r\nHi.\r\n\r\nSHOT: WIDE\r\n\r\n(beat)\r\nBye.\r\n';
    const fixed = apply(text, [planLineFix(text, 'orphaned-parenthetical', 7)!]);
    expect(fixed).toBe("INT. A - DAY\r\n\r\nMARA\r\nHi.\r\n\r\nSHOT: WIDE\r\n\r\nMARA (CONT'D)\r\n(beat)\r\nBye.\r\n");
  });

  it('returns undefined for a code it does not fix', () => {
    expect(planLineFix('INT. A - DAY\n', 'ambiguous-location', 0)).toBeUndefined();
  });
});

describe('planAllFixes', () => {
  it('fixes a whole ORUN-style opening in one pass, chains included', () => {
    const text = [
      '               THE ARCHIVE',
      '     (V.O., FILTERED — not Lucien)',
      'You found us.',
      '',
      '     (beat)',
      'You are ready.',
      '',
      '     (beat)',
      'Truly ready.',
      '',
      'SHOT: CLOSE, abstract',
      '',
      '     (beat)',
      'Welcome to the Orun Archive.',
      '',
      'Beat.',
      '',
    ].join('\n');

    const plan = planAllFixes(text);
    expect(plan.fixes.map((fix) => fix.kind)).toEqual(['join', 'join', 'recue', 'pause']);
    expect(plan.skipped).toBe(0);
    const fixed = apply(text, plan.fixes);
    expect(remainingCodes(fixed)).toEqual([]);
    expect(fixed).toContain("SHOT: CLOSE, abstract\n\nTHE ARCHIVE (CONT'D)\n     (beat)\nWelcome to the Orun Archive.");
  });

  it('skips and counts a re-cue across plain action and an orphan with no speaker', () => {
    const text = 'INT. A - DAY\n\nMARA\nHi.\n\nShe turns.\n\n(beat)\nBye.\n\nINT. B - DAY\n\n(beat)\nAlone.\n';
    const plan = planAllFixes(text);
    expect(plan.fixes).toEqual([]);
    expect(plan.skipped).toBe(2);
  });

  it('plans nothing for a clean script', () => {
    expect(planAllFixes('INT. A - DAY\n\nMARA\nHi.\n(beat)\nBye.\n\nPAUSE: 2s\n')).toEqual({ fixes: [], skipped: 0 });
  });
});
