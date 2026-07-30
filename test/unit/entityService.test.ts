/**
 * Unit tests for the entity/glossary CRUD service.
 * Uses real temp directories so file creation, collision detection, and
 * read/write round-trips are exercised against the actual filesystem.
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createEntity,
  createGlossaryTerm,
  createTimelineEvent,
  readEntity,
  readGlossaryTerm,
  readTimelineEvent,
  writeEntity,
  writeGlossaryTerm,
  writeTimelineEvent,
} from '../../src/entities/service';

describe('createEntity', () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lorefountain-entity-service-'));
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('creates a minimal entity file with only name and type set', async () => {
    const result = await createEntity(tmpRoot, 'character', 'Sango');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entity.id).toBe('sango');
    expect(result.entity.frontmatter.name).toBe('Sango');
    expect(result.entity.frontmatter.type).toBe('character');

    const written = await fs.readFile(result.filePath, 'utf8');
    expect(written).toContain('name: Sango');
    expect(written).toContain('type: character');
  });

  it('creates the world folder if it does not exist yet', async () => {
    const worldFolder = path.join(tmpRoot, 'world');
    const result = await createEntity(worldFolder, 'character', 'Sango');
    expect(result.ok).toBe(true);
  });

  it('derives the id by slugifying the name, preserving Unicode', async () => {
    const result = await createEntity(tmpRoot, 'character', 'Ọ̀rúnmìlà');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entity.id).toBe('ọ̀rúnmìlà');
  });

  it('rejects a blank name without touching the filesystem', async () => {
    const result = await createEntity(tmpRoot, 'character', '   ');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('invalid-name');
    expect(await fs.readdir(tmpRoot).catch(() => [])).toEqual([]);
  });

  it('reports already-exists rather than overwriting a same-named entity', async () => {
    const first = await createEntity(tmpRoot, 'character', 'Sango');
    expect(first.ok).toBe(true);

    const second = await createEntity(tmpRoot, 'character', 'Sango');
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.reason).toBe('already-exists');

    if (first.ok) {
      const stillOriginal = await fs.readFile(first.filePath, 'utf8');
      expect(stillOriginal).toContain('name: Sango');
    }
  });
});

describe('createGlossaryTerm', () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lorefountain-glossary-service-'));
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('creates a minimal glossary term file with only term set', async () => {
    const glossaryFolder = path.join(tmpRoot, 'world', 'glossary');
    const result = await createGlossaryTerm(glossaryFolder, 'Ase');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.term.id).toBe('ase');
    expect(result.term.frontmatter.term).toBe('Ase');
  });

  it('rejects a blank term', async () => {
    const result = await createGlossaryTerm(tmpRoot, '');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('invalid-name');
  });

  it('reports already-exists for a duplicate term', async () => {
    await createGlossaryTerm(tmpRoot, 'Ase');
    const second = await createGlossaryTerm(tmpRoot, 'Ase');
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.reason).toBe('already-exists');
  });
});

describe('createTimelineEvent', () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lorefountain-timeline-service-'));
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('creates a minimal event file with only name set', async () => {
    const timelineFolder = path.join(tmpRoot, 'world', 'timeline');
    const result = await createTimelineEvent(timelineFolder, 'The Founding of the Pantheon');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.id).toBe('the-founding-of-the-pantheon');
    expect(result.event.frontmatter.name).toBe('The Founding of the Pantheon');
  });

  it('rejects a blank name', async () => {
    const result = await createTimelineEvent(tmpRoot, '');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('invalid-name');
  });

  it('reports already-exists for a duplicate event name', async () => {
    await createTimelineEvent(tmpRoot, 'The Long Silence');
    const second = await createTimelineEvent(tmpRoot, 'The Long Silence');
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.reason).toBe('already-exists');
  });
});

describe('readTimelineEvent / writeTimelineEvent', () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lorefountain-timeline-rw-'));
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('reads back a created event identically', async () => {
    const created = await createTimelineEvent(tmpRoot, 'The Long Silence');
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const read = await readTimelineEvent(created.filePath);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.event.frontmatter).toEqual(created.event.frontmatter);
  });

  it('writeTimelineEvent persists an edited event, readable back with the change', async () => {
    const created = await createTimelineEvent(tmpRoot, 'The Long Silence');
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = {
      ...created.event,
      frontmatter: { ...created.event.frontmatter, chronological_order: 5 },
    };
    await writeTimelineEvent(updated);

    const read = await readTimelineEvent(created.filePath);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.event.frontmatter.chronological_order).toBe(5);
  });
});

describe('readEntity / writeEntity', () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lorefountain-entity-rw-'));
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('reads back a created entity identically', async () => {
    const created = await createEntity(tmpRoot, 'character', 'Sango');
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const read = await readEntity(created.filePath);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.entity.frontmatter).toEqual(created.entity.frontmatter);
  });

  it('reports a read-error for a nonexistent file without throwing', async () => {
    const result = await readEntity(path.join(tmpRoot, 'missing.md'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('read-error');
  });

  it('writeEntity persists an edited entity, readable back with the change', async () => {
    const created = await createEntity(tmpRoot, 'character', 'Sango');
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = {
      ...created.entity,
      frontmatter: { ...created.entity.frontmatter, pronunciation: 'SHAHN-go' },
    };
    await writeEntity(updated);

    const read = await readEntity(created.filePath);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.entity.frontmatter.pronunciation).toBe('SHAHN-go');
  });
});

describe('readGlossaryTerm / writeGlossaryTerm', () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lorefountain-glossary-rw-'));
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('reads back a created glossary term identically', async () => {
    const created = await createGlossaryTerm(tmpRoot, 'Ase');
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const read = await readGlossaryTerm(created.filePath);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.term.frontmatter).toEqual(created.term.frontmatter);
  });

  it('writeGlossaryTerm persists an edited term, readable back with the change', async () => {
    const created = await createGlossaryTerm(tmpRoot, 'Ase');
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = {
      ...created.term,
      frontmatter: { ...created.term.frontmatter, gloss: 'The life force.' },
    };
    await writeGlossaryTerm(updated);

    const read = await readGlossaryTerm(created.filePath);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.term.frontmatter.gloss).toBe('The life force.');
  });
});
