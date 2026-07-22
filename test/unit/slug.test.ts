/**
 * Unit tests for slug derivation, including Unicode (Yoruba) preservation.
 */

import { describe, it, expect } from 'vitest';
import { slugify } from '../../src/model/slug';

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
