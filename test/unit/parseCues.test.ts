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

  it('extracts a MUSIC cue with a role only (STING), matching real demo content', () => {
    const cues = extractCues('MUSIC: STING - unresolved, cut hard');
    expect(cues).toEqual([{ type: 'music', role: 'STING', description: 'unresolved, cut hard', line: 0 }]);
  });

  it('extracts a MUSIC cue with a role and no trailing description', () => {
    const cues = extractCues('MUSIC: BED');
    expect(cues).toEqual([{ type: 'music', role: 'BED', description: '', line: 0 }]);
  });

  it('extracts a MUSIC cue with a BRIDGE role, and does not mistake the word "sting" later in the free-text description for a second role keyword', () => {
    const cues = extractCues('MUSIC: BRIDGE Transition sting.');
    expect(cues).toEqual([{ type: 'music', role: 'BRIDGE', description: 'Transition sting.', line: 0 }]);
  });

  it('extracts a MUSIC cue with a SOURCE BED role only', () => {
    const cues = extractCues('MUSIC: SOURCE BED - radio crackles');
    expect(cues).toEqual([{ type: 'music', role: 'SOURCE BED', description: 'radio crackles', line: 0 }]);
  });

  it('extracts a MUSIC cue with a SOURCE BED role combined with timing, without misparsing it as BED plus a stray "IN ..." tail', () => {
    const cues = extractCues('MUSIC: SOURCE BED IN Radio crackles to life.');
    expect(cues).toEqual([{ type: 'music', role: 'SOURCE BED', timing: 'IN', description: 'Radio crackles to life.', line: 0 }]);
  });

  it('extracts a MUSIC cue with a role and timing combined', () => {
    const cues = extractCues('MUSIC: BED IN Tense orchestral swell.');
    expect(cues).toEqual([{ type: 'music', role: 'BED', timing: 'IN', description: 'Tense orchestral swell.', line: 0 }]);
  });

  it('extracts a MUSIC cue with a timing only (OUT), matching real demo content', () => {
    const cues = extractCues('MUSIC: OUT');
    expect(cues).toEqual([{ type: 'music', timing: 'OUT', description: '', line: 0 }]);
  });

  it('extracts a MUSIC cue with a timing only (IN) and a description, matching real demo content', () => {
    const cues = extractCues('MUSIC: IN - low, patient, unresolved');
    expect(cues).toEqual([{ type: 'music', timing: 'IN', description: 'low, patient, unresolved', line: 0 }]);
  });

  it('extracts a MUSIC cue with no recognized role or timing as a plain description', () => {
    const cues = extractCues('MUSIC: tense strings building');
    expect(cues).toEqual([{ type: 'music', description: 'tense strings building', line: 0 }]);
  });

  it('extracts a MUSIC cue with no recognized role or timing as a plain description, matching real demo content', () => {
    const cues = extractCues('MUSIC: a single soprano voice, rising');
    expect(cues).toEqual([{ type: 'music', description: 'a single soprano voice, rising', line: 0 }]);
  });

  it('finds multiple cues across a script, in document order', () => {
    const text = ['SANGO', 'Esu, where are you taking us?', '', 'SFX: metal groaning', '', 'MUSIC: IN - low drone'].join(
      '\n',
    );
    const cues = extractCues(text);
    expect(cues).toEqual([
      { type: 'sfx', description: 'metal groaning', line: 3 },
      { type: 'music', timing: 'IN', description: 'low drone', line: 5 },
    ]);
  });

  it('does not match a lowercase or mid-line occurrence of the prefix', () => {
    expect(extractCues('sfx: this should not count')).toEqual([]);
    expect(extractCues('The SFX: crew argued about SFX: budgets.')).toEqual([]);
  });

  it('returns an empty array for a script with no cues', () => {
    expect(extractCues('INT. THE ARK - NIGHT\n\nSANGO\nWhere are you taking us?\n')).toEqual([]);
  });

  describe('tag', () => {
    it('extracts a leading [tag] from a SFX cue, separate from the description', () => {
      const cues = extractCues('SFX: [kola-nuts-clatter] kola nuts clatter in a bowl');
      expect(cues).toEqual([
        { type: 'sfx', tag: 'kola-nuts-clatter', description: 'kola nuts clatter in a bowl', line: 0 },
      ]);
    });

    it('does not mistake a [[Wikilink]] entity mention later in the description for a second tag, or for the tag itself', () => {
      const cues = extractCues('SFX: [kola-nuts-clatter] the [[Kola Nuts]] rattle against the desk');
      expect(cues).toEqual([
        {
          type: 'sfx',
          tag: 'kola-nuts-clatter',
          description: 'the [[Kola Nuts]] rattle against the desk',
          line: 0,
        },
      ]);
    });

    it('does not treat a [[Wikilink]] immediately after the prefix, with no space, as a tag', () => {
      const cues = extractCues('SFX:[[Kola Nuts]] rattle against the desk');
      expect(cues).toEqual([{ type: 'sfx', description: '[[Kola Nuts]] rattle against the desk', line: 0 }]);
    });

    it('extracts a tag on an AMB cue', () => {
      const cues = extractCues('AMB: [ark-engine-hum] distant engine hum');
      expect(cues).toEqual([{ type: 'amb', tag: 'ark-engine-hum', description: 'distant engine hum', line: 0 }]);
    });

    it('extracts a tag on a MUSIC cue, before its role/timing keywords', () => {
      const cues = extractCues('MUSIC: [tense-swell] BED IN low, patient');
      expect(cues).toEqual([
        { type: 'music', tag: 'tense-swell', role: 'BED', timing: 'IN', description: 'low, patient', line: 0 },
      ]);
    });

    it('leaves the cue untagged when no [tag] is present', () => {
      const cues = extractCues('SFX: metal groaning');
      expect(cues).toEqual([{ type: 'sfx', description: 'metal groaning', line: 0 }]);
      expect(cues[0].tag).toBeUndefined();
    });

    it('does not treat brackets appearing mid-description (not immediately after the prefix) as a tag', () => {
      const cues = extractCues('SFX: a door [creaks] open');
      expect(cues).toEqual([{ type: 'sfx', description: 'a door [creaks] open', line: 0 }]);
    });

    it('does not treat an uppercase or spaced bracket immediately after the prefix as a tag', () => {
      const cues = extractCues('SFX: [Kola Nuts] clatter');
      expect(cues).toEqual([{ type: 'sfx', description: '[Kola Nuts] clatter', line: 0 }]);
    });
  });
});
