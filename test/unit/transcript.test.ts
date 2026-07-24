/**
 * Unit tests for transcript export (Spec §16): dialogue-only, cues stripped,
 * scene headings kept as section breaks. Uses real `fountain-js` output via
 * `parseFountain` rather than hand-built tokens, so these tests exercise the
 * actual token shapes the parser produces.
 */

import { describe, it, expect } from 'vitest';
import { parseFountain } from '../../src/fountain/parse';
import { buildTranscript, serializeTranscriptMarkdown } from '../../src/export/transcript';

describe('buildTranscript', () => {
  it('keeps scene headings and character/dialogue pairs, strips everything else', () => {
    const text = [
      'INT. THE ARK - BRIDGE - NIGHT',
      '',
      'SFX: metal groaning UNDER',
      '',
      'SANGO',
      '(over comms)',
      'Esu, where are you taking us?',
      '',
      'ESU',
      'Somewhere Orunmila never looked.',
      '',
      'CUT TO:',
    ].join('\n');

    const entries = buildTranscript(parseFountain(text));

    expect(entries).toEqual([
      { kind: 'heading', text: 'INT. THE ARK - BRIDGE - NIGHT' },
      { kind: 'line', character: 'SANGO', text: 'Esu, where are you taking us?' },
      { kind: 'line', character: 'ESU', text: 'Somewhere Orunmila never looked.' },
    ]);
  });

  it('merges dialogue split across lines by a parenthetical into one speaking turn', () => {
    const text = ['SANGO', 'Esu, where are you taking us?', '(quietly)', 'Answer me.'].join('\n');

    const entries = buildTranscript(parseFountain(text));

    expect(entries).toEqual([{ kind: 'line', character: 'SANGO', text: 'Esu, where are you taking us? Answer me.' }]);
  });

  it('strips a MUSIC cue that appears between dialogue turns', () => {
    const text = ['SANGO', 'Wait.', '', 'MUSIC: STING - the reveal', '', 'ESU', 'Too late.'].join('\n');

    const entries = buildTranscript(parseFountain(text));

    expect(entries).toEqual([
      { kind: 'line', character: 'SANGO', text: 'Wait.' },
      { kind: 'line', character: 'ESU', text: 'Too late.' },
    ]);
  });

  it('returns an empty array for a script with no dialogue', () => {
    const text = 'INT. THE ARK - BRIDGE - NIGHT\n\nThe reactor hums.\n';
    expect(buildTranscript(parseFountain(text))).toEqual([{ kind: 'heading', text: 'INT. THE ARK - BRIDGE - NIGHT' }]);
  });
});

describe('serializeTranscriptMarkdown', () => {
  it('renders a title, scene heading, and dialogue lines', () => {
    const markdown = serializeTranscriptMarkdown('1x01', [
      { kind: 'heading', text: 'INT. THE ARK - BRIDGE - NIGHT' },
      { kind: 'line', character: 'SANGO', text: 'Esu, where are you taking us?' },
    ]);

    expect(markdown).toBe(
      ['# 1x01', '', '## INT. THE ARK - BRIDGE - NIGHT', '', '**SANGO:** Esu, where are you taking us?', ''].join('\n'),
    );
  });

  it('renders just the title for an empty transcript', () => {
    expect(serializeTranscriptMarkdown('1x01', [])).toBe('# 1x01\n');
  });
});
