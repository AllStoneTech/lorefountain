/**
 * Unit tests for slug derivation, including Unicode (Yoruba) preservation.
 */

import { describe, it, expect } from 'vitest';
import { slugify, titleizeSlug } from '../../src/model/slug';

describe('slugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugify('The Ark Bridge')).toBe('the-ark-bridge');
  });

  it('collapses runs of punctuation/whitespace into single hyphens', () => {
    expect(slugify('Wolf 359 -- Command Deck')).toBe('wolf-359-command-deck');
  });

  it('trims leading and trailing separators', () => {
    expect(slugify('  --Esu--  ')).toBe('esu');
  });

  it('preserves non-ASCII letters (Yoruba)', () => {
    expect(slugify('Ọ̀rúnmìlà')).toBe('ọ̀rúnmìlà');
  });

  it('returns an empty string when there are no letters or numbers', () => {
    expect(slugify('--- !!! ---')).toBe('');
  });
});

describe('titleizeSlug', () => {
  it('title-cases each hyphen-separated word', () => {
    expect(titleizeSlug('the-ark')).toBe('The Ark');
  });

  it('round-trips a slugify() output back to something readable', () => {
    expect(titleizeSlug(slugify('hidden fourth deck'))).toBe('Hidden Fourth Deck');
  });

  it('collapses doubled hyphens without producing an empty word', () => {
    expect(titleizeSlug('the--ark')).toBe('The Ark');
  });

  it('returns an empty string for an empty slug', () => {
    expect(titleizeSlug('')).toBe('');
  });
});
