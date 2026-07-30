/**
 * Unit tests for dangling-relation and dangling-episode-code detection.
 */

import { describe, it, expect } from 'vitest';
import { findDanglingEpisodeCodes, findDanglingRelations } from '../../src/index/relations';

describe('findDanglingRelations', () => {
  const known = new Set(['sango', 'esu']);

  it('returns an empty array when relations is undefined', () => {
    expect(findDanglingRelations(undefined, known)).toEqual([]);
  });

  it('returns an empty array when every relation target is known', () => {
    const relations = [{ target: 'sango', relation_type: 'ally' }];
    expect(findDanglingRelations(relations, known)).toEqual([]);
  });

  it('flags a relation whose target is not a known entity id', () => {
    const relations = [{ target: 'ghost-entity', relation_type: 'enemy' }];
    expect(findDanglingRelations(relations, known)).toEqual([{ target: 'ghost-entity', relationType: 'enemy' }]);
  });

  it('flags only the dangling relations, preserving order, among a mix', () => {
    const relations = [
      { target: 'sango', relation_type: 'ally' },
      { target: 'ghost-entity', relation_type: 'enemy' },
      { target: 'esu', relation_type: 'kin' },
      { target: 'another-ghost', relation_type: 'patron-client' },
    ];
    expect(findDanglingRelations(relations, known)).toEqual([
      { target: 'ghost-entity', relationType: 'enemy' },
      { target: 'another-ghost', relationType: 'patron-client' },
    ]);
  });
});

describe('findDanglingEpisodeCodes', () => {
  const known = new Set(['1x03', '1x04', '1x07']);

  it('returns an empty array when episodes is undefined', () => {
    expect(findDanglingEpisodeCodes(undefined, known)).toEqual([]);
  });

  it('returns an empty array when every code is a known Production Code', () => {
    expect(findDanglingEpisodeCodes(['1x03', '1x04'], known)).toEqual([]);
  });

  it('flags a code that is not a known Production Code', () => {
    expect(findDanglingEpisodeCodes(['1x99'], known)).toEqual(['1x99']);
  });

  it('flags only the dangling codes, preserving order, among a mix', () => {
    expect(findDanglingEpisodeCodes(['1x03', '1x99', '1x04', '2x50'], known)).toEqual(['1x99', '2x50']);
  });
});
