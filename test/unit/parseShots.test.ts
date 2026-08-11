import { describe, expect, it } from 'vitest';
import { extractShots } from '../../src/shots/parseShots';

describe('extractShots', () => {
  it('numbers shots sequentially within a scene, and resets in the next scene', () => {
    const script = `
INT. KITCHEN - NIGHT

SHOT: WIDE - establishing

SHOT: CLOSE-UP on SANGO

SHOT: OTS - ESU

EXT. STREET - DAY

SHOT: WIDE - the street
`;
    const shots = extractShots(script);
    expect(shots.filter((s) => s.sceneNumber === 1).map((s) => s.shotNumber)).toEqual([1, 2, 3]);
    expect(shots.filter((s) => s.sceneNumber === 2).map((s) => s.shotNumber)).toEqual([1]);
  });

  it('captures all four fields on one shot', () => {
    const script = `
INT. KITCHEN - NIGHT

SHOT: CLOSE-UP on SANGO
POSE: SANGO, defiant stance
LIGHT: cool blue moonlight, high contrast
DURATION: 4s
`;
    const shots = extractShots(script);
    expect(shots).toEqual([
      {
        sceneNumber: 1,
        sceneHeadingText: 'INT. KITCHEN - NIGHT',
        shotNumber: 1,
        description: 'CLOSE-UP on SANGO',
        pose: 'SANGO, defiant stance',
        light: 'cool blue moonlight, high contrast',
        durationText: '4s',
        durationSeconds: 4,
      },
    ]);
  });

  it('leaves pose, light, and duration unset when only SHOT: is given', () => {
    const script = 'SHOT: WIDE - establishing';
    const shots = extractShots(script);
    expect(shots).toEqual([{ sceneNumber: 0, sceneHeadingText: '', shotNumber: 1, description: 'WIDE - establishing' }]);
  });

  it('ignores an orphan POSE:/LIGHT:/DURATION: line with no open SHOT:, before any scene heading at all', () => {
    const script = `
POSE: SANGO, standing
LIGHT: dim
DURATION: 3s
`;
    expect(extractShots(script)).toEqual([]);
  });

  it('lets a later value win when a field prefix repeats within one shot', () => {
    const script = `
INT. KITCHEN - NIGHT

SHOT: WIDE
LIGHT: dim
LIGHT: bright, overexposed
`;
    const shots = extractShots(script);
    expect(shots[0].light).toBe('bright, overexposed');
  });

  it('parses a SHOT: line immediately followed by a POSE: line with no blank line between them', () => {
    const script = `
INT. KITCHEN - NIGHT

SHOT: CLOSE-UP on SANGO
POSE: SANGO grips the railing.
`;
    const shots = extractShots(script);
    expect(shots).toEqual([
      {
        sceneNumber: 1,
        sceneHeadingText: 'INT. KITCHEN - NIGHT',
        shotNumber: 1,
        description: 'CLOSE-UP on SANGO',
        pose: 'SANGO grips the railing.',
      },
    ]);
  });

  it('parses stacked fields even when fountain-js misclassifies an all-caps SHOT: line as a character cue', () => {
    // A fully uppercase shot description (real shot-type vocabulary — WIDE,
    // CLOSE-UP, ESTABLISHING — is conventionally capitalized) immediately
    // followed by another field with no blank line between them triggers
    // Fountain's own "ALL-CAPS line + non-blank next line = character +
    // dialogue" heuristic. Confirmed via a direct fountain-js token dump:
    // this becomes `character: "SHOT: WIDE"` + `dialogue: "LIGHT: dim"`,
    // not two `action` tokens. extractShots must still find both fields.
    const script = `
INT. KITCHEN - NIGHT

SHOT: WIDE
LIGHT: dim
DURATION: 4s
`;
    const shots = extractShots(script);
    expect(shots).toEqual([
      { sceneNumber: 1, sceneHeadingText: 'INT. KITCHEN - NIGHT', shotNumber: 1, description: 'WIDE', light: 'dim', durationText: '4s', durationSeconds: 4 },
    ]);
  });

  it.each([
    ['4s', 4],
    ['~5 seconds', 5],
    ['12 sec', 12],
    ['about 3s', 3],
    ['quick', undefined],
  ])('parses DURATION: %s as %s seconds', (input, expected) => {
    const shots = extractShots(`INT. KITCHEN - NIGHT\n\nSHOT: WIDE\nDURATION: ${input}`);
    expect(shots[0].durationText).toBe(input);
    expect(shots[0].durationSeconds).toBe(expected);
  });

  it('returns an empty array for a script with no shots', () => {
    expect(extractShots('INT. KITCHEN - NIGHT\n\nSANGO\nWhere are you taking us?\n')).toEqual([]);
  });
});
