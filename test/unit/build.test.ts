/**
 * Unit tests for buildIndexFromDisk / reindexFile / removeFileFromIndex.
 * Uses real temp directories so the recursive walk, exclusion rules, and
 * malformed-file handling are exercised against the actual filesystem.
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildIndexFromDisk, reindexFile, removeFileFromIndex } from '../../src/index/build';
import { createSqlJsIndexStore } from '../../src/index/sqlJsStore';
import type { IndexStore } from '../../src/index/store';

async function writeFile(root: string, relativePath: string, content: string): Promise<string> {
  const full = path.join(root, relativePath);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, 'utf8');
  return full;
}

const characterMd = (name: string, extra = '') =>
  ['---', `name: ${name}`, 'type: character', extra, '---', '', 'Body.'].filter(Boolean).join('\n');

describe('buildIndexFromDisk', () => {
  let tmpRoot: string;
  let store: IndexStore;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lorefountain-build-test-'));
    store = await createSqlJsIndexStore();
  });

  afterEach(async () => {
    store.dispose();
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('indexes entity files found directly under world/', async () => {
    await writeFile(tmpRoot, 'world/sango.md', characterMd('Sango'));
    await writeFile(tmpRoot, 'world/esu.md', characterMd('Esu'));

    const summary = await buildIndexFromDisk(store, {
      world: path.join(tmpRoot, 'world'),
      glossary: path.join(tmpRoot, 'world', 'glossary'),
    });

    expect(summary.entityCount).toBe(2);
    expect(summary.malformed).toEqual([]);
    expect(store.listEntities().map((e) => e.id).sort()).toEqual(['esu', 'sango']);
  });

  it('indexes entity files nested in user-created subfolders under world/', async () => {
    await writeFile(tmpRoot, 'world/characters/sango.md', characterMd('Sango'));

    const summary = await buildIndexFromDisk(store, {
      world: path.join(tmpRoot, 'world'),
      glossary: path.join(tmpRoot, 'world', 'glossary'),
    });

    expect(summary.entityCount).toBe(1);
    expect(store.getEntityById('sango')).toBeDefined();
  });

  it('excludes glossary/, timeline/, and notes/ from the entity walk', async () => {
    await writeFile(tmpRoot, 'world/sango.md', characterMd('Sango'));
    await writeFile(tmpRoot, 'world/glossary/ase.md', ['---', 'term: Ase', '---', ''].join('\n'));
    await writeFile(tmpRoot, 'world/timeline/ep1.md', '# not yet modeled');
    await writeFile(tmpRoot, 'world/notes/idea.md', 'a stray idea, no frontmatter');

    const summary = await buildIndexFromDisk(store, {
      world: path.join(tmpRoot, 'world'),
      glossary: path.join(tmpRoot, 'world', 'glossary'),
    });

    expect(summary.entityCount).toBe(1);
    expect(store.listEntities().map((e) => e.id)).toEqual(['sango']);
  });

  it('indexes glossary files separately', async () => {
    await writeFile(tmpRoot, 'world/glossary/ase.md', ['---', 'term: Ase', 'gloss: Life force', '---', ''].join('\n'));

    const summary = await buildIndexFromDisk(store, {
      world: path.join(tmpRoot, 'world'),
      glossary: path.join(tmpRoot, 'world', 'glossary'),
    });

    expect(summary.glossaryCount).toBe(1);
    expect(store.getGlossaryTermById('ase')?.term).toBe('Ase');
  });

  it('collects malformed files instead of throwing (Spec §23)', async () => {
    await writeFile(tmpRoot, 'world/good.md', characterMd('Good'));
    await writeFile(tmpRoot, 'world/bad-yaml.md', ['---', 'name: "unterminated', 'type: character', '---', ''].join('\n'));
    await writeFile(tmpRoot, 'world/bad-schema.md', ['---', 'type: character', '---', ''].join('\n')); // missing name

    const summary = await buildIndexFromDisk(store, {
      world: path.join(tmpRoot, 'world'),
      glossary: path.join(tmpRoot, 'world', 'glossary'),
    });

    expect(summary.entityCount).toBe(1);
    expect(summary.malformed).toHaveLength(2);
    expect(summary.malformed.map((m) => m.reason).sort()).toEqual(['invalid-schema', 'malformed-yaml']);
  });

  it('collects misplaced-field warnings without failing the build', async () => {
    await writeFile(
      tmpRoot,
      'world/the-ark.md',
      ['---', 'name: The Ark', 'type: location', 'sound_motif: low thrum', '---', ''].join('\n'),
    );

    const summary = await buildIndexFromDisk(store, {
      world: path.join(tmpRoot, 'world'),
      glossary: path.join(tmpRoot, 'world', 'glossary'),
    });

    expect(summary.entityCount).toBe(1);
    expect(summary.warnings).toHaveLength(1);
    expect(summary.warnings[0].warnings[0]).toMatchObject({ code: 'misplaced-field', path: 'sound_motif' });
  });

  it('returns empty results for a workspace with no world/ folder yet', async () => {
    const summary = await buildIndexFromDisk(store, {
      world: path.join(tmpRoot, 'world'),
      glossary: path.join(tmpRoot, 'world', 'glossary'),
    });
    expect(summary).toEqual({ entityCount: 0, glossaryCount: 0, malformed: [], warnings: [] });
  });
});

describe('reindexFile and removeFileFromIndex', () => {
  let tmpRoot: string;
  let store: IndexStore;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lorefountain-reindex-test-'));
    store = await createSqlJsIndexStore();
  });

  afterEach(async () => {
    store.dispose();
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('re-parses and upserts a single changed entity file', async () => {
    const filePath = await writeFile(tmpRoot, 'world/sango.md', characterMd('Sango'));
    const first = await reindexFile(store, filePath, 'entity');
    expect(first.ok).toBe(true);
    expect(store.getEntityById('sango')?.name).toBe('Sango');

    await fs.writeFile(filePath, characterMd('Sango', 'pronunciation: SHAHN-go'), 'utf8');
    const second = await reindexFile(store, filePath, 'entity');
    expect(second.ok).toBe(true);
    expect(store.getEntityById('sango')?.data.pronunciation).toBe('SHAHN-go');
    expect(store.listEntities()).toHaveLength(1);
  });

  it('reports a read error without throwing when the file no longer exists', async () => {
    const result = await reindexFile(store, path.join(tmpRoot, 'world', 'missing.md'), 'entity');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('read-error');
  });

  it('removeFileFromIndex removes a previously-indexed entity', async () => {
    const filePath = await writeFile(tmpRoot, 'world/sango.md', characterMd('Sango'));
    await reindexFile(store, filePath, 'entity');
    expect(store.getEntityByPath(filePath)).toBeDefined();

    removeFileFromIndex(store, filePath, 'entity');
    expect(store.getEntityByPath(filePath)).toBeUndefined();
  });

  it('removeFileFromIndex is a safe no-op for a file that was never indexed', () => {
    expect(() => removeFileFromIndex(store, '/never/indexed.md', 'entity')).not.toThrow();
  });
});
