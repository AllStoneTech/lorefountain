/**
 * Unit tests for `shots/scanScript.ts`: character-cue extension parsing,
 * line numbers, dual dialogue, title-page skipping, and the misread
 * prefix-line workaround.
 */

import { describe, expect, it } from 'vitest';
import { parseCharacterCue, scanScript } from '../../src/shots/scanScript';

describe('parseCharacterCue', () => {
  it('reads every cue-line extension in order', () => {
    expect(parseCharacterCue('THE ARCHIVE (V.O.) (FILTERED)')).toEqual({ name: 'THE ARCHIVE', extensions: ['V.O.', 'FILTERED'] });
  });

  it.each(["LUCIEN (V.O.) (CONT'D)", 'LUCIEN (V.O.) (CONT’D)', 'LUCIEN (V.O.) (CONT.)'])('drops CONT\'D: %s', (cue) => {
    expect(parseCharacterCue(cue)).toEqual({ name: 'LUCIEN', extensions: ['V.O.'] });
  });

  it('strips a dual-dialogue caret and a forcing @', () => {
    expect(parseCharacterCue('THEO ^')).toEqual({ name: 'THEO', extensions: [] });
    expect(parseCharacterCue('@McCLANE')).toEqual({ name: 'McCLANE', extensions: [] });
  });
});

describe('scanScript', () => {
  it('skips the title page and reports correct 0-based lines after multi-line blocks', () => {
    const script = 'Title: X\nAuthor: Y\n\nINT. A - DAY\n\nSHOT: WIDE\nPOSE: standing\n\nMARA\nHi.\n';
    const items = scanScript(script);
    expect(items.map((item) => [item.kind, item.line])).toEqual([
      ['heading', 3],
      ['directive', 5],
      ['directive', 6],
      ['character', 8],
      ['dialogue', 9],
    ]);
  });

  it('marks the second speaker of dual dialogue as simultaneous', () => {
    const items = scanScript('INT. A - DAY\n\nMARA\nDon\'t—\n\nTHEO ^\nWait—\n');
    const cues = items.filter((item) => item.kind === 'character');
    expect(cues.map((cue) => cue.kind === 'character' && [cue.name, cue.simultaneous])).toEqual([
      ['MARA', false],
      ['THEO', true],
    ]);
  });

  it('turns a SHOT: line Fountain misreads as a character cue back into directives and action', () => {
    // All caps, with lines stacked right under it: Fountain reads character + dialogue.
    const items = scanScript('INT. A - DAY\n\nSHOT: [cold-open] WIDE ESTABLISHING\nPOSE: SANGO STANDS\nSango waits.\n');
    expect(items.map((item) => item.kind)).toEqual(['heading', 'directive', 'directive', 'action']);
    expect(items[1]).toMatchObject({ kind: 'directive', keyword: 'SHOT', rest: '[cold-open] WIDE ESTABLISHING' });
  });

  it('flags only the first line of an action block as blockStart', () => {
    const items = scanScript('INT. A - DAY\n\n(beat)\nYou are ready.\n');
    expect(items.filter((item) => item.kind === 'action').map((item) => item.kind === 'action' && item.blockStart)).toEqual([
      true,
      false,
    ]);
  });
});
