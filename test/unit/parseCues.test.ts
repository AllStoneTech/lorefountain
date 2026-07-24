import { describe, it, expect } from 'vitest';
import { extractCues } from '../../src/cues/parseCues';

describe('extractCues', () => {
  it('extracts a SFX cue with its line number', () => {
    const cues = extractCues('INT. THE ARK - NIGHT\n\nSFX: metal groaning\n');
    expect(cues).toEqual([{ type: 'sfx', description: 'metal groaning', line: 2 }]);
  });

  it('extracts an AMB cue', () => {
    const cues = extractCues('AMB: distant engine hum');
    expect(cues).toEqual([{ type: 'amb', description: 'distant engine hum', line: 0 }]);
  });

  it('extracts a MUSIC cue with a recognized modifier', () => {
    const cues = extractCues('MUSIC: STING - the reveal');
    expect(cues).toEqual([{ type: 'music', modifier: 'STING', description: 'the reveal', line: 0 }]);
  });

  it('extracts a MUSIC cue with a modifier and no trailing description', () => {
    const cues = extractCues('MUSIC: UNDER');
    expect(cues).toEqual([{ type: 'music', modifier: 'UNDER', description: '', line: 0 }]);
  });

  it('extracts a MUSIC cue with no recognized modifier as a plain description', () => {
    const cues = extractCues('MUSIC: tense strings building');
    expect(cues).toEqual([{ type: 'music', description: 'tense strings building', line: 0 }]);
  });

  it('finds multiple cues across a script, in document order', () => {
    const text = ['SANGO', 'Esu, where are you taking us?', '', 'SFX: metal groaning', '', 'MUSIC: IN - low drone'].join(
      '\n',
    );
    const cues = extractCues(text);
    expect(cues).toEqual([
      { type: 'sfx', description: 'metal groaning', line: 3 },
      { type: 'music', modifier: 'IN', description: 'low drone', line: 5 },
    ]);
  });

  it('does not match a lowercase or mid-line occurrence of the prefix', () => {
    expect(extractCues('sfx: this should not count')).toEqual([]);
    expect(extractCues('The SFX: crew argued about SFX: budgets.')).toEqual([]);
  });

  it('returns an empty array for a script with no cues', () => {
    expect(extractCues('INT. THE ARK - NIGHT\n\nSANGO\nWhere are you taking us?\n')).toEqual([]);
  });
});
