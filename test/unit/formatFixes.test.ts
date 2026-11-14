/**
 * Unit tests for `upgrade/formatFixes.ts`: the quick-fix and Fix All
 * planners. Fixes are applied to the text here so each test checks the
 * resulting script, not just the edit coordinates.
 */

import { describe, expect, it } from 'vitest';
import { buildShotMap } from '../../src/shots/shotMap';
import { buildPageMap } from 'lorefountain-core/comics/pageMap';
import { FIXABLE_CODES, findFixableIssues, planAllFixes, planLineFix, planLineFixes, type FormatFix } from '../../src/upgrade/formatFixes';

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

describe('unforced-transition fixes', () => {
  it('forces a transition with > and keeps its indentation and words', () => {
    const text = 'INT. A - DAY\n\nMara leaves.\n\n  CUT TO BLACK.\n';
    const fix = planLineFix(text, 'unforced-transition', 4);
    expect(fix).toMatchObject({ kind: 'force', safeForFixAll: true, title: 'Force as a transition (add >)' });
    expect(apply(text, [fix as FormatFix])).toBe('INT. A - DAY\n\nMara leaves.\n\n  > CUT TO BLACK.\n');
  });

  it('offers nothing on a line already forced', () => {
    expect(planLineFix('INT. A - DAY\n\n> FADE OUT.\n', 'unforced-transition', 2)).toBeUndefined();
  });

  it('Fix All forces every unforced transition, after which none are noted and Fountain detects them', () => {
    const text = 'FADE IN:\n\nINT. A - DAY\n\nMara leaves.\n\nFADE TO BLACK.\n';
    const plan = planAllFixes(text);
    expect(plan.fixes.map((fix) => [fix.kind, fix.line])).toEqual([
      ['force', 0],
      ['force', 6],
    ]);
    const fixed = apply(text, plan.fixes);
    expect(fixed).toBe('> FADE IN:\n\nINT. A - DAY\n\nMara leaves.\n\n> FADE TO BLACK.\n');
    const { issues } = buildShotMap(fixed, []);
    expect(issues.filter((issue) => issue.code === 'unforced-transition')).toEqual([]);
  });
});

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

  it('joins a beat alone between blank lines together with the paragraph after it', () => {
    // The Of_One_Blood 1x07 shape.
    const text = "INT. A - DAY\n\nAUBREY LIVINGSTON\nI'm ashamed of my own section for it.\n\n(beat)\n\nThere's an English expedition sailing for Meroe.\n\nREUEL BRIGGS\nGo on.\n";
    const fix = planLineFix(text, 'orphaned-parenthetical', 5);
    expect(fix).toMatchObject({ kind: 'join', safeForFixAll: false });
    expect(fix?.title).toContain('with the line after it');
    const fixed = apply(text, [fix!]);
    expect(fixed).toBe(
      "INT. A - DAY\n\nAUBREY LIVINGSTON\nI'm ashamed of my own section for it.\n(beat)\nThere's an English expedition sailing for Meroe.\n\nREUEL BRIGGS\nGo on.\n",
    );
    expect(remainingCodes(fixed)).toEqual([]);
    expect(buildShotMap(fixed, []).shots[0].spoken.map((entry) => ('text' in entry ? entry.text : 'pause'))).toEqual([
      "I'm ashamed of my own section for it.",
      'pause',
      "There's an English expedition sailing for Meroe.",
      'Go on.',
    ]);
  });

  it('re-cues a beat alone between blank lines together with the paragraph after it', () => {
    const text = 'INT. A - DAY\n\nMARA\nHi.\n\nSHOT: WIDE\n\n(beat)\n\nStill here.\n';
    const fix = planLineFix(text, 'orphaned-parenthetical', 7);
    expect(fix).toMatchObject({ kind: 'recue', safeForFixAll: false });
    expect(apply(text, [fix!])).toBe("INT. A - DAY\n\nMARA\nHi.\n\nSHOT: WIDE\n\nMARA (CONT'D)\n(beat)\nStill here.\n");
  });

  it('keeps the plain join when an isolated beat is followed by a character cue', () => {
    const text = 'INT. A - DAY\n\nMARA\nHi.\n\n(beat)\n\nTHEO\nYes?\n';
    expect(planLineFix(text, 'orphaned-parenthetical', 5)).toMatchObject({ kind: 'join', safeForFixAll: true });
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
    expect(plan.fixes.map((fix) => fix.kind)).toEqual(['cue-extension', 'join', 'join', 'recue', 'pause']);
    expect(plan.skipped).toBe(0);
    const fixed = apply(text, plan.fixes);
    expect(remainingCodes(fixed)).toEqual([]);
    // The V.O. line moved onto the cue, and the re-cued (CONT'D) cue carries the same extensions.
    expect(fixed).toContain('               THE ARCHIVE (V.O.) (FILTERED)\n     (not Lucien)\nYou found us.');
    expect(fixed).toContain("SHOT: CLOSE, abstract\n\nTHE ARCHIVE (V.O.) (FILTERED) (CONT'D)\n     (beat)\nWelcome to the Orun Archive.");
  });

  it('skips and counts a re-cue across plain action and an orphan with no speaker', () => {
    const text = 'INT. A - DAY\n\nMARA\nHi.\n\nShe turns.\n\n(beat)\nBye.\n\nINT. B - DAY\n\n(beat)\nAlone.\n';
    const plan = planAllFixes(text);
    expect(plan.fixes).toEqual([]);
    expect(plan.skipped).toBe(2);
  });

  it('skips a beat alone between blank lines rather than guess about the paragraph after it', () => {
    const text = "INT. A - DAY\n\nAUBREY LIVINGSTON\nI'm ashamed.\n\n(beat)\n\nThere's an expedition.\n";
    expect(planAllFixes(text)).toEqual({ fixes: [], skipped: 1 });
  });

  it('plans nothing for a clean script', () => {
    expect(planAllFixes('INT. A - DAY\n\nMARA\nHi.\n(beat)\nBye.\n\nPAUSE: 2s\n')).toEqual({ fixes: [], skipped: 0 });
  });
});

describe('misread-as-character fixes (ADR-0049)', () => {
  const stacked = 'INT. A - DAY\n\nPAGE: 7\nPANEL: WIDE of the harbor.\n';
  const shotStack = 'INT. A - DAY\n\nSHOT: CLOSE-UP\nPOSE: MARA KNEELS\n\nShe waits.\n';

  it('is a fixable code, found in a comic script and in any script with a stacked prefix line', () => {
    expect(FIXABLE_CODES.has('misread-as-character')).toBe(true);
    expect(findFixableIssues(stacked)).toEqual([{ code: 'misread-as-character', line: 2 }]);
    expect(findFixableIssues(shotStack)).toEqual([{ code: 'misread-as-character', line: 2 }]);
  });

  it('offers "add !" first and "add a blank line" second, changing no words', () => {
    const fixes = planLineFixes(shotStack, 'misread-as-character', 2);
    expect(fixes.map((fix) => [fix.kind, fix.safeForFixAll])).toEqual([
      ['force-action', true],
      ['blank', true],
    ]);
    expect(apply(shotStack, [fixes[0]])).toBe('INT. A - DAY\n\n!SHOT: CLOSE-UP\nPOSE: MARA KNEELS\n\nShe waits.\n');
    expect(apply(shotStack, [fixes[1]])).toBe('INT. A - DAY\n\nSHOT: CLOSE-UP\n\nPOSE: MARA KNEELS\n\nShe waits.\n');
    expect(planLineFix(shotStack, 'misread-as-character', 2)).toEqual(fixes[0]);
  });

  it('puts the ! after any indentation', () => {
    const text = 'INT. A - DAY\n\n  SFX: BOOM\n  MARA\n';
    expect(apply(text, [planLineFix(text, 'misread-as-character', 2)!])).toBe('INT. A - DAY\n\n  !SFX: BOOM\n  MARA\n');
  });

  it('either fix leaves nothing to report, and the shot reads the same', () => {
    for (const fix of planLineFixes(shotStack, 'misread-as-character', 2)) {
      const fixed = apply(shotStack, [fix]);
      expect(findFixableIssues(fixed)).toEqual([]);
      expect(buildShotMap(fixed, []).shots.find((shot) => shot.shot === 1)).toMatchObject({ description: 'CLOSE-UP', pose: 'MARA KNEELS' });
    }
  });

  it('keeps CRLF line endings', () => {
    const text = stacked.replaceAll('\n', '\r\n');
    const [force, blank] = planLineFixes(text, 'misread-as-character', 2);
    expect(apply(text, [force])).toBe('INT. A - DAY\r\n\r\n!PAGE: 7\r\nPANEL: WIDE of the harbor.\r\n');
    expect(apply(text, [blank])).toBe('INT. A - DAY\r\n\r\nPAGE: 7\r\n\r\nPANEL: WIDE of the harbor.\r\n');
  });

  it('offers no "add !" on a line already forced, no blank line where one follows, and nothing for a missing line', () => {
    expect(planLineFixes('!PAGE: 7\nPANEL: x\n', 'misread-as-character', 0).map((fix) => fix.kind)).toEqual(['blank']);
    expect(planLineFixes('PAGE: 7\n\nPANEL: x\n', 'misread-as-character', 0).map((fix) => fix.kind)).toEqual(['force-action']);
    expect(planLineFixes('PAGE: 7\nx\n', 'misread-as-character', 9)).toEqual([]);
  });

  it('Fix All adds the !, after which neither map reports it', () => {
    const plan = planAllFixes(stacked);
    expect(plan.skipped).toBe(0);
    expect(plan.fixes.map((fix) => fix.kind)).toEqual(['force-action']);
    const fixed = apply(stacked, plan.fixes);
    expect(fixed).toBe('INT. A - DAY\n\n!PAGE: 7\nPANEL: WIDE of the harbor.\n');
    expect(buildPageMap(fixed, []).issues.map((issue) => issue.code)).not.toContain('misread-as-character');
    expect(planAllFixes(fixed)).toEqual({ fixes: [], skipped: 0 });
  });

  it('does not touch a script with no stacked all-caps convention line', () => {
    expect(findFixableIssues('INT. A - DAY\n\nMara waits.\n')).toEqual([]);
    expect(findFixableIssues('INT. A - DAY\n\nSHOT: WIDE on the dock\nPOSE: MARA KNEELS\n')).toEqual([]);
  });
});

describe('cue-extension-parenthetical fixes', () => {
  const fixOnly = (text: string): string => {
    const issue = findFixableIssues(text).find((candidate) => candidate.code === 'cue-extension-parenthetical');
    expect(issue).toBeDefined();
    const fix = planLineFix(text, 'cue-extension-parenthetical', (issue as { line: number }).line);
    expect(fix).toMatchObject({ kind: 'cue-extension', safeForFixAll: true });
    return apply(text, [fix as FormatFix]);
  };
  const script = (...lines: string[]): string => ['INT. A - DAY', '', ...lines, ''].join('\n');
  const codes = (text: string): string[] => buildShotMap(text, []).issues.map((issue) => issue.code).filter((code) => code === 'cue-extension-parenthetical');

  it('moves V.O. onto the cue and keeps the performance note as a parenthetical', () => {
    expect(fixOnly(script('THE ARCHIVE', '(V.O., reading)', 'Hello.'))).toBe(script('THE ARCHIVE (V.O.)', '(reading)', 'Hello.'));
  });

  it('moves both tokens and keeps only the wording after the dash', () => {
    expect(fixOnly(script('THE ARCHIVE', '(V.O., FILTERED — not Lucien)', 'Hello.'))).toBe(
      script('THE ARCHIVE (V.O.) (FILTERED)', '(not Lucien)', 'Hello.'),
    );
  });

  it('keeps commas inside the remaining wording', () => {
    expect(fixOnly(script('THE ARCHIVE', '(V.O., precise, an academic register)', 'Hello.'))).toBe(
      script('THE ARCHIVE (V.O.)', '(precise, an academic register)', 'Hello.'),
    );
  });

  it('removes the parenthetical when it was only extensions', () => {
    expect(fixOnly(script('THE ARCHIVE', '(V.O., FILTERED)', 'Hello.'))).toBe(script('THE ARCHIVE (V.O.) (FILTERED)', 'Hello.'));
  });

  it("puts the extensions before (CONT'D), after existing extensions, and keeps ^", () => {
    expect(fixOnly(script("THE ARCHIVE (O.S.) (CONT'D)", '(V.O., low)', 'Hello.'))).toBe(script("THE ARCHIVE (O.S.) (V.O.) (CONT'D)", '(low)', 'Hello.'));
    expect(fixOnly(script('MARA ^', '(O.S., low)', 'Hello.'))).toBe(script('MARA (O.S.) ^', '(low)', 'Hello.'));
  });

  it('does not repeat an extension already on the cue', () => {
    expect(fixOnly(script('THE ARCHIVE (V.O.)', '(V.O., reading)', 'Hello.'))).toBe(script('THE ARCHIVE (V.O.)', '(reading)', 'Hello.'));
  });

  it('is idempotent: after the fix there is nothing left to flag or fix', () => {
    const once = fixOnly(script('THE ARCHIVE', '(V.O., FILTERED — not Lucien)', 'Hello.'));
    expect(codes(once)).toEqual([]);
    expect(planAllFixes(once).fixes).toEqual([]);
  });

  it('preserves CRLF line endings', () => {
    const text = 'INT. A - DAY\r\n\r\nTHE ARCHIVE\r\n(V.O., reading)\r\nHello.\r\n';
    expect(fixOnly(text)).toBe('INT. A - DAY\r\n\r\nTHE ARCHIVE (V.O.)\r\n(reading)\r\nHello.\r\n');
  });

  it('skips an ambiguous one: the warning stays, there is no fix, and Fix All counts it as skipped', () => {
    const text = script('THE ARCHIVE', '(V.O. reading aloud)', 'Hello.');
    expect(codes(text)).toHaveLength(1);
    expect(planLineFix(text, 'cue-extension-parenthetical', 3)).toBeUndefined();
    expect(planAllFixes(text)).toEqual({ fixes: [], skipped: 1 });
  });

  it('is in Fix All, alongside the other safe fixes', () => {
    expect(FIXABLE_CODES.has('cue-extension-parenthetical')).toBe(true);
    const text = script('THE ARCHIVE', '(V.O., reading)', 'Hello.');
    expect(apply(text, planAllFixes(text).fixes)).toBe(script('THE ARCHIVE (V.O.)', '(reading)', 'Hello.'));
  });

  it('changes no dialogue, action or other wording', () => {
    const text = script('THE ARCHIVE', '(V.O., FILTERED — not Lucien)', 'Hello there.', '', 'Mara watches.');
    const fixed = apply(text, planAllFixes(text).fixes);
    const words = (value: string): string[] => value.replace(/[()—,]/g, ' ').split(/\s+/).filter(Boolean).sort();
    expect(words(fixed)).toEqual(words(text));
  });
});
