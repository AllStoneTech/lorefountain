/**
 * Unit tests for dangling-relation detection.
 */

import { describe, it, expect } from 'vitest';
import { findDanglingRelations } from '../../src/index/relations';

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
