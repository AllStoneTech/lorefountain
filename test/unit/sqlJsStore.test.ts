/**
 * Unit tests for the sql.js-backed IndexStore.
 * Covers entity/glossary upsert-get-list-search-remove, rename-safety
 * (upsert matches by id OR file path), stats, and clear.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createSqlJsIndexStore } from '../../src/index/sqlJsStore';
import type { IndexStore } from '../../src/index/store';
import { entityFrontmatterSchema, type Entity } from '../../src/model/entity';
import { glossaryTermSchema, type GlossaryTerm } from '../../src/model/glossary';

function entity(opts: {
  id: string;
  filePath: string;
  body?: string;
  frontmatter?: Record<string, unknown>;
}): Entity {
  return {
    id: opts.id,
    filePath: opts.filePath,
    body: opts.body ?? 'Body.',
    frontmatter: entityFrontmatterSchema.parse({
      name: 'Sango',
      type: 'character',
      ...opts.frontmatter,
    }),
  };
}

function glossaryTerm(opts: {
  id: string;
  filePath: string;
  body?: string;
  frontmatter?: Record<string, unknown>;
}): GlossaryTerm {
  return {
    id: opts.id,
    filePath: opts.filePath,
    body: opts.body ?? '',
    frontmatter: glossaryTermSchema.parse({ term: 'Ase', ...opts.frontmatter }),
  };
}

describe('SqlJsIndexStore', () => {
  let store: IndexStore;

  beforeEach(async () => {
    store = await createSqlJsIndexStore();
  });

  afterEach(() => {
    store.dispose();
  });

  describe('entities', () => {
    it('upserts and retrieves by id and by path', () => {
      store.upsertEntity(
        entity({ id: 'sango', filePath: '/world/sango.md', frontmatter: { name: 'Sango', type: 'character' } }),
      );
      const byId = store.getEntityById('sango');
      const byPath = store.getEntityByPath('/world/sango.md');
      expect(byId).toBeDefined();
      expect(byId).toEqual(byPath);
      expect(byId?.name).toBe('Sango');
      expect(byId?.type).toBe('character');
      expect(byId?.data.name).toBe('Sango');
    });

    it('returns undefined for an unknown id or path', () => {
      expect(store.getEntityById('nope')).toBeUndefined();
      expect(store.getEntityByPath('/world/nope.md')).toBeUndefined();
    });

    it('re-upserting the same file path replaces the row rather than duplicating it', () => {
      store.upsertEntity(entity({ id: 'sango', filePath: '/world/sango.md' }));
      store.upsertEntity(
        entity({ id: 'sango', filePath: '/world/sango.md', body: 'Updated body.' }),
      );
      expect(store.listEntities()).toHaveLength(1);
      expect(store.getEntityById('sango')?.body).toBe('Updated body.');
    });

    it('treats a changed id at the same file path as a rename, not a duplicate', () => {
      store.upsertEntity(entity({ id: 'sango', filePath: '/world/sango.md' }));
      store.upsertEntity(entity({ id: 'shango', filePath: '/world/sango.md' }));
      expect(store.listEntities()).toHaveLength(1);
      expect(store.getEntityById('sango')).toBeUndefined();
      expect(store.getEntityById('shango')).toBeDefined();
    });

    it('lists entities filtered by type', () => {
      store.upsertEntity(entity({ id: 'sango', filePath: '/world/sango.md', frontmatter: { name: 'Sango', type: 'character' } }));
      store.upsertEntity(entity({ id: 'the-ark', filePath: '/world/the-ark.md', frontmatter: { name: 'The Ark', type: 'location' } }));
      expect(store.listEntities({ type: 'character' }).map((e) => e.id)).toEqual(['sango']);
      expect(store.listEntities().map((e) => e.id).sort()).toEqual(['sango', 'the-ark']);
    });

    it('finds entities via full-text search over name and body', () => {
      store.upsertEntity(
        entity({ id: 'sango', filePath: '/world/sango.md', body: 'God of thunder and justice.' }),
      );
      store.upsertEntity(
        entity({ id: 'esu', filePath: '/world/esu.md', frontmatter: { name: 'Esu', type: 'character' }, body: 'The trickster at the crossroads.' }),
      );
      expect(store.searchEntities('thunder').map((h) => h.id)).toEqual(['sango']);
      expect(store.searchEntities('crossroads').map((h) => h.id)).toEqual(['esu']);
      expect(store.searchEntities('nonexistentterm')).toEqual([]);
    });

    it('removes an entity by file path, safely no-oping when absent', () => {
      store.upsertEntity(entity({ id: 'sango', filePath: '/world/sango.md' }));
      store.removeEntityByPath('/world/sango.md');
      expect(store.getEntityById('sango')).toBeUndefined();
      expect(store.listEntities()).toEqual([]);
      expect(() => store.removeEntityByPath('/world/never-existed.md')).not.toThrow();
    });

    it('removing an entity also removes it from full-text search results', () => {
      store.upsertEntity(entity({ id: 'sango', filePath: '/world/sango.md', body: 'thunder god' }));
      store.removeEntityByPath('/world/sango.md');
      expect(store.searchEntities('thunder')).toEqual([]);
    });
  });

  describe('glossary', () => {
    it('upserts and retrieves a glossary term by id', () => {
      store.upsertGlossaryTerm(glossaryTerm({ id: 'ase', filePath: '/world/glossary/ase.md', frontmatter: { term: 'Ase', gloss: 'Life force' } }));
      const record = store.getGlossaryTermById('ase');
      expect(record?.term).toBe('Ase');
      expect(record?.data.gloss).toBe('Life force');
    });

    it('lists glossary terms', () => {
      store.upsertGlossaryTerm(glossaryTerm({ id: 'ase', filePath: '/world/glossary/ase.md' }));
      store.upsertGlossaryTerm(glossaryTerm({ id: 'orun', filePath: '/world/glossary/orun.md', frontmatter: { term: 'Orun' } }));
      expect(store.listGlossaryTerms().map((t) => t.id).sort()).toEqual(['ase', 'orun']);
    });

    it('finds glossary terms via full-text search over the body', () => {
      store.upsertGlossaryTerm(
        glossaryTerm({ id: 'orun', filePath: '/world/glossary/orun.md', frontmatter: { term: 'Orun' }, body: 'The heavens, realm of the orisha.' }),
      );
      expect(store.searchGlossary('heavens').map((h) => h.id)).toEqual(['orun']);
    });

    it('removes a glossary term by file path', () => {
      store.upsertGlossaryTerm(glossaryTerm({ id: 'ase', filePath: '/world/glossary/ase.md' }));
      store.removeGlossaryTermByPath('/world/glossary/ase.md');
      expect(store.getGlossaryTermById('ase')).toBeUndefined();
    });
  });

  describe('stats and clear', () => {
    it('reports accurate counts', () => {
      store.upsertEntity(entity({ id: 'sango', filePath: '/world/sango.md' }));
      store.upsertGlossaryTerm(glossaryTerm({ id: 'ase', filePath: '/world/glossary/ase.md' }));
      expect(store.stats()).toEqual({ entityCount: 1, glossaryCount: 1 });
    });

    it('clear empties all tables (safe to rebuild afterward)', () => {
      store.upsertEntity(entity({ id: 'sango', filePath: '/world/sango.md' }));
      store.upsertGlossaryTerm(glossaryTerm({ id: 'ase', filePath: '/world/glossary/ase.md' }));
      store.clear();
      expect(store.stats()).toEqual({ entityCount: 0, glossaryCount: 0 });
      expect(store.searchEntities('sango')).toEqual([]);

      store.upsertEntity(entity({ id: 'sango', filePath: '/world/sango.md' }));
      expect(store.stats().entityCount).toBe(1);
    });
  });
});
