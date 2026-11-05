/**
 * Unit tests for `fountain/conventions.ts`: the shared asset-tag shape, the
 * LoreFountain prefix-line matcher, and the lenient duration parser.
 */

import { describe, expect, it } from 'vitest';
import { extractCues } from '../../src/cues/parseCues';
import { matchLeadingTag, matchPrefixLine, parseDurationSeconds } from '../../src/fountain/conventions';
import { parseShotText } from '../../src/shots/parseShots';

describe('matchLeadingTag', () => {
  it('splits a slug-shaped tag off the front', () => {
    expect(matchLeadingTag('[archive-ident] WIDE, abstract')).toEqual({ tag: 'archive-ident', rest: 'WIDE, abstract' });
  });

  it('accepts digits and a production-code prefix', () => {
    expect(matchLeadingTag('[1x01-basement-wide] WIDE').tag).toBe('1x01-basement-wide');
  });

  it.each(['[Archive] x', '[-lead] x', '[trail-] x', '[double--hyphen] x', '[has space] x', '[under_score] x'])(
    'rejects a non-slug tag: %s',
    (text) => {
      expect(matchLeadingTag(text)).toEqual({ rest: text });
    },
  );

  it('never mistakes a [[Wikilink]] for a tag', () => {
    expect(matchLeadingTag('[[Sango]] enters')).toEqual({ rest: '[[Sango]] enters' });
  });

  it('allows a tag with nothing after it', () => {
    expect(matchLeadingTag('[archive-ident]')).toEqual({ tag: 'archive-ident', rest: '' });
  });

  it('is the same shape cue and shot parsing use, so they agree', () => {
    const cueTag = extractCues('SFX: [door-creak] a door creaks\n')[0].tag;
    const shotTag = parseShotText('[door-creak] CLOSE on the door').tag;
    expect(cueTag).toBe('door-creak');
    expect(shotTag).toBe(cueTag);
    expect(extractCues('SFX: [Door] a door\n')[0].tag).toBeUndefined();
    expect(parseShotText('[Door] CLOSE').tag).toBeUndefined();
  });
});

describe('matchPrefixLine', () => {
  it.each(['SHOT', 'POSE', 'LIGHT', 'DURATION', 'PAUSE', 'SFX', 'MUSIC', 'AMB'])('recognizes %s:', (keyword) => {
    expect(matchPrefixLine(`  ${keyword}: something`)).toEqual({ keyword, rest: 'something' });
  });

  it('recognizes a bare prefix with nothing after it', () => {
    expect(matchPrefixLine('PAUSE:')).toEqual({ keyword: 'PAUSE', rest: '' });
  });

  it('is case-sensitive and requires the colon', () => {
    expect(matchPrefixLine('Pause: 2s')).toBeUndefined();
    expect(matchPrefixLine('PAUSE 2s')).toBeUndefined();
    expect(matchPrefixLine('MARA')).toBeUndefined();
  });
});

describe('parseDurationSeconds', () => {
  it.each([
    ['4s', 4],
    ['~5 seconds', 5],
    ['about 2 sec', 2],
    ['1.5s', 1.5],
  ])('reads %s as %d', (text, seconds) => {
    expect(parseDurationSeconds(text)).toBe(seconds);
  });

  it('never guesses a number from words', () => {
    expect(parseDurationSeconds('long')).toBeUndefined();
    expect(parseDurationSeconds('quick')).toBeUndefined();
    expect(parseDurationSeconds('')).toBeUndefined();
  });
});
