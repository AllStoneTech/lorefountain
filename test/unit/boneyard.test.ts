/**
 * Unit tests for `fountain/boneyard.ts` and the rule it enforces: nothing
 * inside a Fountain boneyard (`/* ... *\/`) is read as data — not cues,
 * shots, entity mentions or scene presence — and boneyard text never throws
 * off the line numbers of what comes after it.
 */

import { describe, expect, it } from 'vitest';
import { extractCues } from '../../src/cues/parseCues';
import { blankBoneyard } from '../../src/fountain/boneyard';
import { mapTokensToPositions, parseFountain } from '../../src/fountain/parse';
import type { MentionCandidate } from '../../src/index/mentions';
import { extractScenePresence, findMentionLines } from '../../src/search/structuredSearch';
import { extractShots } from '../../src/shots/parseShots';

const candidates: MentionCandidate[] = [
  { id: 'sango', kind: 'entity', names: ['Sango'] },
  { id: 'esu', kind: 'entity', names: ['Esu'] },
];

describe('blankBoneyard', () => {
  it('blanks a multi-line boneyard, keeping length and line breaks', () => {
    const text = 'Before.\n/*\nSFX: thunder\n\nEsu waits.\n*/\nAfter.';
    const blanked = blankBoneyard(text);
    expect(blanked).toHaveLength(text.length);
    expect(blanked.split('\n')).toHaveLength(text.split('\n').length);
    expect(blanked).not.toMatch(/thunder|Esu|\/\*|\*\//);
    expect(blanked.startsWith('Before.\n')).toBe(true);
    expect(blanked.endsWith('\nAfter.')).toBe(true);
  });

  it('keeps CRLF line breaks', () => {
    expect(blankBoneyard('a\r\n/*x\r\ny*/\r\nb')).toBe('a\r\n   \r\n   \r\nb');
  });

  it('blanks an inline boneyard and leaves the rest of the line', () => {
    expect(blankBoneyard('He runs /* fast */ away.')).toBe('He runs            away.');
  });

  it('blanks each of several boneyards, but not the text between them', () => {
    expect(blankBoneyard('/*a*/ keep /*b*/')).toBe('      keep      ');
  });

  it('hides nothing for an unclosed /*, matching fountain-js', () => {
    const text = 'INT. ARCHIVE - NIGHT\n\n/* never closed\nSFX: thunder\n';
    expect(blankBoneyard(text)).toBe(text);
  });

  it('returns text with no boneyard unchanged', () => {
    expect(blankBoneyard('INT. ARCHIVE - NIGHT\n\nRain.')).toBe('INT. ARCHIVE - NIGHT\n\nRain.');
  });
});

describe('boneyard content is never data', () => {
  const script = [
    'INT. ARCHIVE - NIGHT', // 0
    '', // 1
    '/*', // 2
    'SFX: [door-slam] the door slams', // 3
    'MUSIC: STING - cut', // 4
    'SHOT: WIDE on the stacks', // 5
    '', // 6
    'Esu watches from the shelves.', // 7
    '*/', // 8
    '', // 9
    'SHOT: WIDE on the stacks', // 10
    '', // 11
    'Sango climbs down.', // 12
    '', // 13
    'SFX: a ladder creaks /* louder? */', // 14
  ].join('\n');

  it('ignores cue lines inside a boneyard, keeping the line numbers of the rest', () => {
    expect(extractCues(script)).toEqual([{ type: 'sfx', description: 'a ladder creaks', line: 14 }]);
  });

  it('ignores shot lines inside a boneyard, and places the real one on its own line', () => {
    expect(extractShots(script).map((shot) => shot.description)).toEqual(['WIDE on the stacks']);
    const shotToken = mapTokensToPositions(script, parseFountain(script)).find((p) => p.token.text === 'SHOT: WIDE on the stacks');
    expect(shotToken?.line).toBe(10);
  });

  it('never counts a name inside a boneyard toward scene presence', () => {
    const [scene] = extractScenePresence('/scripts/1x01.fountain', script, candidates);
    expect([...scene.entityIds]).toEqual(['sango']);
  });

  it('never reports a boneyard line as a mention line', () => {
    expect(findMentionLines('/scripts/1x01.fountain', script, candidates, 'esu')).toEqual([]);
    expect(findMentionLines('/scripts/1x01.fountain', script, candidates, 'sango')).toEqual([
      { scriptPath: '/scripts/1x01.fountain', line: 12, text: 'Sango climbs down.' },
    ]);
  });
});
