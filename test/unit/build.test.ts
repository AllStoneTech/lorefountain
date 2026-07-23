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
      scripts: path.join(tmpRoot, 'scripts'),
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
      scripts: path.join(tmpRoot, 'scripts'),
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
      scripts: path.join(tmpRoot, 'scripts'),
    });

    expect(summary.entityCount).toBe(1);
    expect(store.listEntities().map((e) => e.id)).toEqual(['sango']);
  });

  it('indexes glossary files separately', async () => {
    await writeFile(tmpRoot, 'world/glossary/ase.md', ['---', 'term: Ase', 'gloss: Life force', '---', ''].join('\n'));

    const summary = await buildIndexFromDisk(store, {
      world: path.join(tmpRoot, 'world'),
      glossary: path.join(tmpRoot, 'world', 'glossary'),
      scripts: path.join(tmpRoot, 'scripts'),
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
      scripts: path.join(tmpRoot, 'scripts'),
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
      scripts: path.join(tmpRoot, 'scripts'),
    });

    expect(summary.entityCount).toBe(1);
    expect(summary.warnings).toHaveLength(1);
    expect(summary.warnings[0].warnings[0]).toMatchObject({ code: 'misplaced-field', path: 'sound_motif' });
  });

  it('returns empty results for a workspace with no world/ folder yet', async () => {
    const summary = await buildIndexFromDisk(store, {
      world: path.join(tmpRoot, 'world'),
      glossary: path.join(tmpRoot, 'world', 'glossary'),
      scripts: path.join(tmpRoot, 'scripts'),
    });
    expect(summary).toEqual({
      entityCount: 0,
      glossaryCount: 0,
      scriptCount: 0,
      malformed: [],
      warnings: [],
      danglingRelations: [],
    });
  });

  it('populates mentions across files in one full build, resolvable via backlinks', async () => {
    await writeFile(
      tmpRoot,
      'world/sango.md',
      ['---', 'name: Sango', 'type: character', '---', '', 'God of thunder.'].join('\n'),
    );
    await writeFile(
      tmpRoot,
      'world/esu.md',
      ['---', 'name: Esu', 'type: character', '---', '', 'Esu once argued with Sango at the crossroads.'].join('\n'),
    );

    await buildIndexFromDisk(store, {
      world: path.join(tmpRoot, 'world'),
      glossary: path.join(tmpRoot, 'world', 'glossary'),
      scripts: path.join(tmpRoot, 'scripts'),
    });

    const backlinks = store.getBacklinks({ id: 'sango', kind: 'entity' });
    expect(backlinks).toEqual([{ id: 'esu', kind: 'entity', name: 'Esu', filePath: expect.stringContaining('esu.md') }]);
  });

  it('detects a dangling relation target and reports it in the summary', async () => {
    await writeFile(
      tmpRoot,
      'world/esu.md',
      [
        '---',
        'name: Esu',
        'type: character',
        'relations:',
        '  - target: nonexistent-entity',
        '    relation_type: enemy',
        '---',
        '',
        'Body.',
      ].join('\n'),
    );

    const summary = await buildIndexFromDisk(store, {
      world: path.join(tmpRoot, 'world'),
      glossary: path.join(tmpRoot, 'world', 'glossary'),
      scripts: path.join(tmpRoot, 'scripts'),
    });

    expect(summary.danglingRelations).toHaveLength(1);
    expect(summary.danglingRelations[0]).toMatchObject({
      target: 'nonexistent-entity',
      relationType: 'enemy',
    });
  });

  it('does not report a relation whose target resolves to a known entity', async () => {
    await writeFile(tmpRoot, 'world/sango.md', ['---', 'name: Sango', 'type: character', '---', ''].join('\n'));
    await writeFile(
      tmpRoot,
      'world/esu.md',
      [
        '---',
        'name: Esu',
        'type: character',
        'relations:',
        '  - target: sango',
        '    relation_type: ally',
        '---',
        '',
      ].join('\n'),
    );

    const summary = await buildIndexFromDisk(store, {
      world: path.join(tmpRoot, 'world'),
      glossary: path.join(tmpRoot, 'world', 'glossary'),
      scripts: path.join(tmpRoot, 'scripts'),
    });

    expect(summary.danglingRelations).toEqual([]);
  });

  it('indexes .fountain scripts as mention sources, resolvable via backlinks', async () => {
    await writeFile(tmpRoot, 'world/sango.md', characterMd('Sango'));
    await writeFile(
      tmpRoot,
      'scripts/1x01.fountain',
      ['INT. THE ARK - NIGHT', '', 'SANGO', 'I am here.'].join('\n'),
    );

    const summary = await buildIndexFromDisk(store, {
      world: path.join(tmpRoot, 'world'),
      glossary: path.join(tmpRoot, 'world', 'glossary'),
      scripts: path.join(tmpRoot, 'scripts'),
    });

    expect(summary.scriptCount).toBe(1);
    const backlinks = store.getBacklinks({ id: 'sango', kind: 'entity' });
    expect(backlinks).toEqual([
      { id: '1x01', kind: 'script', name: '1x01.fountain', filePath: expect.stringContaining('1x01.fountain') },
    ]);
  });

  it('does not index .fountain files as entities, and excludes notes/ scripts are unaffected by that exclusion', async () => {
    await writeFile(tmpRoot, 'scripts/1x01.fountain', 'INT. SOMEWHERE - DAY\n\nAction line.');
    const summary = await buildIndexFromDisk(store, {
      world: path.join(tmpRoot, 'world'),
      glossary: path.join(tmpRoot, 'world', 'glossary'),
      scripts: path.join(tmpRoot, 'scripts'),
    });
    expect(summary.entityCount).toBe(0);
    expect(summary.scriptCount).toBe(1);
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

  it('recomputes a single reindexed file\'s outgoing mentions against current candidates', async () => {
    await writeFile(tmpRoot, 'world/sango.md', characterMd('Sango'));
    await reindexFile(store, path.join(tmpRoot, 'world', 'sango.md'), 'entity');

    const esuPath = await writeFile(
      tmpRoot,
      'world/esu.md',
      ['---', 'name: Esu', 'type: character', '---', '', 'Esu argued with Sango.'].join('\n'),
    );
    const result = await reindexFile(store, esuPath, 'entity');
    expect(result.ok).toBe(true);

    expect(store.getBacklinks({ id: 'sango', kind: 'entity' })).toEqual([
      { id: 'esu', kind: 'entity', name: 'Esu', filePath: esuPath },
    ]);
  });

  it('reports a dangling relation found on a single reindexed file', async () => {
    const filePath = await writeFile(
      tmpRoot,
      'world/esu.md',
      [
        '---',
        'name: Esu',
        'type: character',
        'relations:',
        '  - target: ghost',
        '    relation_type: enemy',
        '---',
        '',
      ].join('\n'),
    );
    const result = await reindexFile(store, filePath, 'entity');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.danglingRelations).toEqual([{ filePath, target: 'ghost', relationType: 'enemy' }]);
  });

  it('skipping mention recomputation (recomputeMentions: false) leaves prior mentions untouched', async () => {
    await writeFile(tmpRoot, 'world/sango.md', characterMd('Sango'));
    await reindexFile(store, path.join(tmpRoot, 'world', 'sango.md'), 'entity');

    const esuPath = await writeFile(
      tmpRoot,
      'world/esu.md',
      ['---', 'name: Esu', 'type: character', '---', '', 'Esu argued with Sango.'].join('\n'),
    );
    const result = await reindexFile(store, esuPath, 'entity', { recomputeMentions: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.danglingRelations).toEqual([]);
    expect(store.getBacklinks({ id: 'sango', kind: 'entity' })).toEqual([]);
  });

  it('reindexes a single .fountain script as a mention source', async () => {
    await writeFile(tmpRoot, 'world/sango.md', characterMd('Sango'));
    await reindexFile(store, path.join(tmpRoot, 'world', 'sango.md'), 'entity');

    const scriptPath = await writeFile(tmpRoot, 'scripts/1x01.fountain', 'SANGO\nI am here.');
    const result = await reindexFile(store, scriptPath, 'script');
    expect(result.ok).toBe(true);

    expect(store.getBacklinks({ id: 'sango', kind: 'entity' })).toEqual([
      { id: '1x01', kind: 'script', name: '1x01.fountain', filePath: scriptPath },
    ]);
  });

  it('removeFileFromIndex removes a script\'s outgoing mentions', async () => {
    await writeFile(tmpRoot, 'world/sango.md', characterMd('Sango'));
    await reindexFile(store, path.join(tmpRoot, 'world', 'sango.md'), 'entity');

    const scriptPath = await writeFile(tmpRoot, 'scripts/1x01.fountain', 'SANGO\nI am here.');
    await reindexFile(store, scriptPath, 'script');
    expect(store.getBacklinks({ id: 'sango', kind: 'entity' })).toHaveLength(1);

    removeFileFromIndex(store, scriptPath, 'script');
    expect(store.getBacklinks({ id: 'sango', kind: 'entity' })).toEqual([]);
  });
});
