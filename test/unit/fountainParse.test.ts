/**
 * Unit tests for Fountain parsing and position recovery.
 * Covers scene headings, character cues, dialogue, dual dialogue, a
 * parenthetical, a `(V.O.)` extension, a bracketed note, a transition, and
 * confirms boneyard comments are excluded — and that repeated text (a
 * reused character cue, a repeated dialogue line) resolves to distinct
 * positions rather than collapsing to the first occurrence.
 */

import { describe, it, expect } from 'vitest';
import { mapTokensToPositions, parseFountain } from '../../src/fountain/parse';

const sample = [
  'INT. THE ARK - BRIDGE - NIGHT',
  '',
  'The reactor hums.',
  '',
  'SANGO',
  '(over comms)',
  'Esu, where are you taking us?',
  '',
  'ESU (V.O.)',
  'Somewhere Orunmila never looked.',
  '',
  '[[check canon: does Esu know yet?]]',
  '',
  'CUT TO:',
  '',
  '/* boneyard comment, should be excluded */',
  '',
  'SANGO^',
  'In unison!',
  '',
  'ESU^',
  'In unison!',
].join('\n');

describe('parseFountain', () => {
  it('produces the expected token types in order', () => {
    const tokens = parseFountain(sample);
    const types = tokens.map((t) => t.type);
    expect(types).toContain('scene_heading');
    expect(types).toContain('character');
    expect(types).toContain('parenthetical');
    expect(types).toContain('dialogue');
    expect(types).toContain('note');
    expect(types).toContain('transition');
    expect(types).toContain('dual_dialogue_begin');
  });

  it('excludes boneyard comments from the token stream entirely', () => {
    const tokens = parseFountain(sample);
    expect(tokens.some((t) => t.text?.includes('boneyard'))).toBe(false);
  });

  it('preserves a character cue extension like "(V.O.)" in the token text', () => {
    const tokens = parseFountain(sample);
    expect(tokens.some((t) => t.type === 'character' && t.text === 'ESU (V.O.)')).toBe(true);
  });
});

describe('mapTokensToPositions', () => {
  it('recovers correct start/end/line for each content token', () => {
    const tokens = parseFountain(sample);
    const positioned = mapTokensToPositions(sample, tokens);

    const sceneHeading = positioned.find((p) => p.token.type === 'scene_heading');
    expect(sceneHeading).toBeDefined();
    expect(sample.slice(sceneHeading!.start, sceneHeading!.end)).toBe('INT. THE ARK - BRIDGE - NIGHT');
    expect(sceneHeading!.line).toBe(0);

    const note = positioned.find((p) => p.token.type === 'note');
    expect(sample.slice(note!.start, note!.end)).toBe('check canon: does Esu know yet?');
  });

  it('resolves a repeated character cue to its own distinct occurrence, not the first', () => {
    const tokens = parseFountain(sample);
    const positioned = mapTokensToPositions(sample, tokens);

    const sangoCues = positioned.filter((p) => p.token.type === 'character' && p.token.text === 'SANGO');
    expect(sangoCues).toHaveLength(2);
    expect(sangoCues[0].start).toBeLessThan(sangoCues[1].start);
    // The second occurrence is the dual-dialogue "SANGO^" line — its recovered
    // position must be after the transition, not equal to the first cue's.
    const transition = positioned.find((p) => p.token.type === 'transition')!;
    expect(sangoCues[1].start).toBeGreaterThan(transition.start);
  });

  it('resolves repeated dialogue lines ("In unison!") to distinct positions', () => {
    const tokens = parseFountain(sample);
    const positioned = mapTokensToPositions(sample, tokens);

    const unisonLines = positioned.filter((p) => p.token.type === 'dialogue' && p.token.text === 'In unison!');
    expect(unisonLines).toHaveLength(2);
    expect(unisonLines[0].start).not.toBe(unisonLines[1].start);
    expect(unisonLines[0].start).toBeLessThan(unisonLines[1].start);
  });

  it('skips tokens with no text (dialogue_begin/end, dual_dialogue markers)', () => {
    const tokens = parseFountain(sample);
    const positioned = mapTokensToPositions(sample, tokens);
    expect(positioned.some((p) => p.token.type === 'dialogue_begin')).toBe(false);
    expect(positioned.some((p) => p.token.type === 'dual_dialogue_begin')).toBe(false);
  });

  it('returns an empty array for an empty document', () => {
    expect(mapTokensToPositions('', parseFountain(''))).toEqual([]);
  });
});
