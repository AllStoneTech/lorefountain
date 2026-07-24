import { describe, it, expect } from 'vitest';
import { addAliasIfMissing, renameInText, renameRelationTargets } from '../../src/refactor/renameEntity';
import type { Relation } from '../../src/model/entity';

describe('renameInText', () => {
  it('rewrites a wikilinked occurrence and reports no stale mentions', () => {
    const result = renameInText('Esu spoke with [[Sango]] on the bridge.', 'Sango', 'Shango');
    expect(result.text).toBe('Esu spoke with [[Shango]] on the bridge.');
    expect(result.wikilinksRewritten).toBe(1);
    expect(result.staleMentionLines).toEqual([]);
  });

  it('leaves a bare plain-text mention untouched and reports its line', () => {
    const result = renameInText('SANGO\nEsu, where are you taking us?\n\nSango nodded.', 'Sango', 'Shango');
    expect(result.text).toBe('SANGO\nEsu, where are you taking us?\n\nSango nodded.');
    expect(result.wikilinksRewritten).toBe(0);
    expect(result.staleMentionLines).toEqual([0, 3]);
  });

  it('rewrites wikilinked occurrences while leaving plain-text ones on other lines', () => {
    const text = 'Sango walked in.\n[[Sango]] greeted Esu.';
    const result = renameInText(text, 'Sango', 'Shango');
    expect(result.text).toBe('Sango walked in.\n[[Shango]] greeted Esu.');
    expect(result.wikilinksRewritten).toBe(1);
    expect(result.staleMentionLines).toEqual([0]);
  });

  it('is a no-op (identical text) when the name never appears', () => {
    const result = renameInText('Esu walked alone.', 'Sango', 'Shango');
    expect(result.text).toBe('Esu walked alone.');
    expect(result.wikilinksRewritten).toBe(0);
    expect(result.staleMentionLines).toEqual([]);
  });

  it('does not treat a substring match as wikilinked just because brackets appear elsewhere', () => {
    const result = renameInText('[[The Ark]] carries Sango and Esu.', 'Sango', 'Shango');
    expect(result.text).toBe('[[The Ark]] carries Sango and Esu.');
    expect(result.wikilinksRewritten).toBe(0);
    expect(result.staleMentionLines).toEqual([0]);
  });
});

describe('renameRelationTargets', () => {
  const relations: Relation[] = [
    { target: 'sango', relation_type: 'sibling' },
    { target: 'esu', relation_type: 'ally' },
  ];

  it('rewrites only the matching target', () => {
    const result = renameRelationTargets(relations, 'sango', 'shango');
    expect(result).toEqual([
      { target: 'shango', relation_type: 'sibling' },
      { target: 'esu', relation_type: 'ally' },
    ]);
  });

  it('returns the same reference when nothing matches (cheap no-op detection)', () => {
    const result = renameRelationTargets(relations, 'orunmila', 'ifa');
    expect(result).toBe(relations);
  });

  it('returns undefined unchanged when relations is absent', () => {
    expect(renameRelationTargets(undefined, 'sango', 'shango')).toBeUndefined();
  });
});

describe('addAliasIfMissing', () => {
  it('appends the old name when absent', () => {
    expect(addAliasIfMissing(undefined, 'Sango')).toEqual(['Sango']);
    expect(addAliasIfMissing(['Shango the Thunderer'], 'Sango')).toEqual(['Shango the Thunderer', 'Sango']);
  });

  it('does not duplicate an alias that already exists, case-insensitively', () => {
    expect(addAliasIfMissing(['sango'], 'Sango')).toEqual(['sango']);
  });
});
