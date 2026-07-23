/**
 * Unit tests for wikilink completion context detection.
 */

import { describe, it, expect } from 'vitest';
import { computeWikilinkContext } from '../../src/providers/wikilink';

describe('computeWikilinkContext', () => {
  it('returns undefined when there is no [[ on the line', () => {
    expect(computeWikilinkContext('Sango spoke of the future.')).toBeUndefined();
  });

  it('detects an open [[ with nothing typed yet', () => {
    const ctx = computeWikilinkContext('He mentioned [[');
    expect(ctx).toEqual({ typed: '', typedStartColumn: 15 });
  });

  it('detects an open [[ with partial text typed', () => {
    const ctx = computeWikilinkContext('He mentioned [[San');
    expect(ctx).toEqual({ typed: 'San', typedStartColumn: 15 });
  });

  it('supports a multi-word partial name', () => {
    const ctx = computeWikilinkContext('[[The Ar');
    expect(ctx).toEqual({ typed: 'The Ar', typedStartColumn: 2 });
  });

  it('returns undefined once the link has been closed with ]]', () => {
    expect(computeWikilinkContext('[[Sango]] and then more text')).toBeUndefined();
  });

  it('uses the most recent [[ when the line contains an earlier closed link', () => {
    const ctx = computeWikilinkContext('[[Sango]] argued with [[Es');
    expect(ctx).toEqual({ typed: 'Es', typedStartColumn: 24 });
  });

  it('uses the most recent [[ even when an earlier one on the same line was never closed', () => {
    // A degenerate case (an abandoned "[[Sango " followed by a fresh "[[Esu"),
    // but the most recent [[ is still the right one to offer completion from.
    const ctx = computeWikilinkContext('[[Sango [[Esu');
    expect(ctx).toEqual({ typed: 'Esu', typedStartColumn: 10 });
  });

  it('returns undefined for an empty line', () => {
    expect(computeWikilinkContext('')).toBeUndefined();
  });
});
