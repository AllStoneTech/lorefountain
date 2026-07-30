import { describe, it, expect } from 'vitest';
import { createMemoryIndexStore } from '../../src/index/memoryStore';
import type { Entity } from '../../src/model/entity';
import type { GlossaryTerm } from '../../src/model/glossary';
import type { Script } from '../../src/model/script';
import type { TimelineEvent } from '../../src/model/timeline';

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

function makeScript(overrides: Partial<Script> = {}): Script {
  return {
    id: '1x01-pilot',
    filePath: '/scripts/1x01-pilot.fountain',
    frontmatter: { title: 'Pilot', order: 1, productionCode: '1x01' },
    ...overrides,
  };
}

function makeEvent(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: 'founding',
    filePath: '/world/timeline/founding.md',
    body: 'The pantheon is founded.',
    frontmatter: { name: 'The Founding', schema_version: 1 },
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

  it('upserts and retrieves a script by id and by path', () => {
    const store = createMemoryIndexStore();
    store.upsertScript(makeScript());

    expect(store.getScriptById('1x01-pilot')).toEqual({
      id: '1x01-pilot',
      filePath: '/scripts/1x01-pilot.fountain',
      title: 'Pilot',
      order: 1,
      productionCode: '1x01',
    });
    expect(store.getScriptByPath('/scripts/1x01-pilot.fountain')?.id).toBe('1x01-pilot');
    expect(store.listScripts()).toHaveLength(1);
  });

  it('re-upserting a script at the same file path replaces the old row, matched by path even if the id changed', () => {
    const store = createMemoryIndexStore();
    store.upsertScript(makeScript());
    store.upsertScript(makeScript({ id: '1x01-renamed' }));

    expect(store.listScripts()).toHaveLength(1);
    expect(store.getScriptById('1x01-pilot')).toBeUndefined();
    expect(store.getScriptById('1x01-renamed')).toBeDefined();
  });

  it('removeScriptByPath removes the matching row and leaves others intact', () => {
    const store = createMemoryIndexStore();
    store.upsertScript(makeScript());
    store.upsertScript(makeScript({ id: '1x02', filePath: '/scripts/1x02.fountain', frontmatter: { order: 2 } }));

    store.removeScriptByPath('/scripts/1x01-pilot.fountain');

    expect(store.listScripts().map((s) => s.id)).toEqual(['1x02']);
  });

  it('upserts and retrieves a Timeline event', () => {
    const store = createMemoryIndexStore();
    store.upsertEvent(makeEvent());

    expect(store.getEventById('founding')?.name).toBe('The Founding');
    expect(store.listEvents()).toHaveLength(1);
  });

  it('removeEventByPath removes the matching row', () => {
    const store = createMemoryIndexStore();
    store.upsertEvent(makeEvent());
    store.removeEventByPath('/world/timeline/founding.md');

    expect(store.listEvents()).toHaveLength(0);
  });

  it('stats reflects current entity, glossary, and event counts', () => {
    const store = createMemoryIndexStore();
    store.upsertEntity(makeEntity());
    store.upsertGlossaryTerm(makeGlossaryTerm());
    store.upsertEvent(makeEvent());

    expect(store.stats()).toEqual({ entityCount: 1, glossaryCount: 1, eventCount: 1 });
  });

  it('clear empties everything, including scripts and events', () => {
    const store = createMemoryIndexStore();
    store.upsertEntity(makeEntity());
    store.upsertGlossaryTerm(makeGlossaryTerm());
    store.upsertScript(makeScript());
    store.upsertEvent(makeEvent());
    store.clear();

    expect(store.listEntities()).toEqual([]);
    expect(store.listGlossaryTerms()).toEqual([]);
    expect(store.listScripts()).toEqual([]);
    expect(store.listEvents()).toEqual([]);
    expect(store.stats()).toEqual({ entityCount: 0, glossaryCount: 0, eventCount: 0 });
  });

  it('search and backlink methods return empty results (not needed for validation)', () => {
    const store = createMemoryIndexStore();
    expect(store.searchEntities('sango')).toEqual([]);
    expect(store.searchGlossary('ase')).toEqual([]);
    expect(store.getBacklinks({ id: 'sango', kind: 'entity' })).toEqual([]);
  });
});
