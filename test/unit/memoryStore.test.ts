import { describe, it, expect } from 'vitest';
import { createMemoryIndexStore } from '../../src/index/memoryStore';
import type { Entity } from '../../src/model/entity';
import type { GlossaryTerm } from '../../src/model/glossary';

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: 'sango',
    filePath: '/world/sango.md',
    body: 'God of thunder.',
    frontmatter: { name: 'Sango', type: 'character', schema_version: 1 },
    ...overrides,
  };
}

function makeGlossaryTerm(overrides: Partial<GlossaryTerm> = {}): GlossaryTerm {
  return {
    id: 'ase',
    filePath: '/world/glossary/ase.md',
    body: 'The life force.',
    frontmatter: { term: 'Ase', schema_version: 1 },
    ...overrides,
  };
}

describe('createMemoryIndexStore', () => {
  it('upserts and retrieves an entity by id and by path', () => {
    const store = createMemoryIndexStore();
    store.upsertEntity(makeEntity());

    expect(store.getEntityById('sango')?.name).toBe('Sango');
    expect(store.getEntityByPath('/world/sango.md')?.id).toBe('sango');
    expect(store.listEntities()).toHaveLength(1);
  });

  it('filters listEntities by type', () => {
    const store = createMemoryIndexStore();
    store.upsertEntity(makeEntity());
    store.upsertEntity(
      makeEntity({ id: 'the-ark', filePath: '/world/the-ark.md', frontmatter: { name: 'The Ark', type: 'location', schema_version: 1 } }),
    );

    expect(store.listEntities({ type: 'character' }).map((e) => e.id)).toEqual(['sango']);
    expect(store.listEntities({ type: 'location' }).map((e) => e.id)).toEqual(['the-ark']);
  });

  it('re-upserting the same file path replaces the old row, matched by path even if the id changed', () => {
    const store = createMemoryIndexStore();
    store.upsertEntity(makeEntity());
    store.upsertEntity(makeEntity({ id: 'shango', frontmatter: { name: 'Shango', type: 'character', schema_version: 1 } }));

    expect(store.listEntities()).toHaveLength(1);
    expect(store.getEntityById('sango')).toBeUndefined();
    expect(store.getEntityById('shango')?.name).toBe('Shango');
  });

  it('removeEntityByPath removes the matching row and leaves others intact', () => {
    const store = createMemoryIndexStore();
    store.upsertEntity(makeEntity());
    store.upsertEntity(makeEntity({ id: 'esu', filePath: '/world/esu.md', frontmatter: { name: 'Esu', type: 'character', schema_version: 1 } }));

    store.removeEntityByPath('/world/sango.md');

    expect(store.listEntities().map((e) => e.id)).toEqual(['esu']);
  });

  it('upserts and retrieves a glossary term', () => {
    const store = createMemoryIndexStore();
    store.upsertGlossaryTerm(makeGlossaryTerm());

    expect(store.getGlossaryTermById('ase')?.term).toBe('Ase');
    expect(store.listGlossaryTerms()).toHaveLength(1);
  });

  it('removeGlossaryTermByPath removes the matching row', () => {
    const store = createMemoryIndexStore();
    store.upsertGlossaryTerm(makeGlossaryTerm());
    store.removeGlossaryTermByPath('/world/glossary/ase.md');

    expect(store.listGlossaryTerms()).toHaveLength(0);
  });

  it('stats reflects current entity and glossary counts', () => {
    const store = createMemoryIndexStore();
    store.upsertEntity(makeEntity());
    store.upsertGlossaryTerm(makeGlossaryTerm());

    expect(store.stats()).toEqual({ entityCount: 1, glossaryCount: 1 });
  });

  it('clear empties everything', () => {
    const store = createMemoryIndexStore();
    store.upsertEntity(makeEntity());
    store.upsertGlossaryTerm(makeGlossaryTerm());
    store.clear();

    expect(store.listEntities()).toEqual([]);
    expect(store.listGlossaryTerms()).toEqual([]);
    expect(store.stats()).toEqual({ entityCount: 0, glossaryCount: 0 });
  });

  it('search and backlink methods return empty results (not needed for validation)', () => {
    const store = createMemoryIndexStore();
    expect(store.searchEntities('sango')).toEqual([]);
    expect(store.searchGlossary('ase')).toEqual([]);
    expect(store.getBacklinks({ id: 'sango', kind: 'entity' })).toEqual([]);
  });
});
