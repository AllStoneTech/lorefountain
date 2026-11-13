/**
 * Unit tests for lorefountain.config.json reading/writing.
 * Covers a missing file (not an error), valid config, partial overrides,
 * malformed JSON, schema violations, and the default-writer's no-clobber
 * behavior.
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { comicSettingsFromConfig } from 'lorefountain-core/comics/limits';
import { projectTypeFromConfig } from 'lorefountain-core/config/projectType';
import {
  CONFIG_FILE_NAME,
  folderSettingsFromConfig,
  hiddenCategoriesFromConfig,
  readLoreFountainConfig,
  writeDefaultConfigIfAbsent,
  writeLoreFountainConfig,
} from '../../src/config/configFile';

describe('readLoreFountainConfig', () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lorefountain-config-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('reports a missing config file as found:false, not an error', async () => {
    const result = await readLoreFountainConfig(tmpRoot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.found).toBe(false);
    expect(result.config).toEqual({});
  });

  it('parses a valid config with custom folder names', async () => {
    await fs.writeFile(
      path.join(tmpRoot, CONFIG_FILE_NAME),
      JSON.stringify({ folders: { world: 'bible', scripts: 'screenplays' } }),
      'utf8',
    );
    const result = await readLoreFountainConfig(tmpRoot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.found).toBe(true);
    expect(result.config.folders).toEqual({ world: 'bible', scripts: 'screenplays' });
  });

  it('accepts a config with no folders section (all defaults apply downstream)', async () => {
    await fs.writeFile(path.join(tmpRoot, CONFIG_FILE_NAME), JSON.stringify({}), 'utf8');
    const result = await readLoreFountainConfig(tmpRoot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.folders).toBeUndefined();
  });

  it('preserves unknown top-level keys (forward compatibility)', async () => {
    await fs.writeFile(
      path.join(tmpRoot, CONFIG_FILE_NAME),
      JSON.stringify({ folders: { world: 'bible' }, futureFeature: { enabled: true } }),
      'utf8',
    );
    const result = await readLoreFountainConfig(tmpRoot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.config as Record<string, unknown>).futureFeature).toEqual({ enabled: true });
  });

  it('reports malformed JSON without throwing', async () => {
    await fs.writeFile(path.join(tmpRoot, CONFIG_FILE_NAME), '{ not valid json', 'utf8');
    const result = await readLoreFountainConfig(tmpRoot);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('malformed-json');
  });

  it('reports a schema violation (wrong type) without throwing', async () => {
    await fs.writeFile(
      path.join(tmpRoot, CONFIG_FILE_NAME),
      JSON.stringify({ folders: { world: 42 } }),
      'utf8',
    );
    const result = await readLoreFountainConfig(tmpRoot);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('invalid-schema');
  });

  it('parses world.hiddenCategories', async () => {
    await fs.writeFile(
      path.join(tmpRoot, CONFIG_FILE_NAME),
      JSON.stringify({ world: { hiddenCategories: ['faction', 'object'] } }),
      'utf8',
    );
    const result = await readLoreFountainConfig(tmpRoot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.world).toEqual({ hiddenCategories: ['faction', 'object'] });
  });
});

describe('folderSettingsFromConfig', () => {
  it('extracts folder overrides from a parsed config', () => {
    expect(folderSettingsFromConfig({ folders: { world: 'bible', imports: 'source-docs' } })).toEqual({
      world: 'bible',
      scripts: undefined,
      imports: 'source-docs',
    });
  });

  it('returns all-undefined when no folders section is present', () => {
    expect(folderSettingsFromConfig({})).toEqual({ world: undefined, scripts: undefined, imports: undefined });
  });
});

describe('hiddenCategoriesFromConfig', () => {
  it('extracts world.hiddenCategories from a parsed config', () => {
    expect(hiddenCategoriesFromConfig({ world: { hiddenCategories: ['faction', 'arc'] } })).toEqual([
      'faction',
      'arc',
    ]);
  });

  it('returns an empty array when no world section is present', () => {
    expect(hiddenCategoriesFromConfig({})).toEqual([]);
  });

  it('returns an empty array when world.hiddenCategories is unset', () => {
    expect(hiddenCategoriesFromConfig({ world: {} })).toEqual([]);
  });
});

describe('writeDefaultConfigIfAbsent', () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lorefountain-config-write-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('writes a default config file and reports true when none existed', async () => {
    const wrote = await writeDefaultConfigIfAbsent(tmpRoot);
    expect(wrote).toBe(true);

    const result = await readLoreFountainConfig(tmpRoot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.found).toBe(true);
    expect(result.config.folders).toEqual({ world: 'world', scripts: 'scripts', imports: 'imports', assets: 'assets' });
  });

  it('does not overwrite an existing config file, and reports false', async () => {
    await fs.writeFile(
      path.join(tmpRoot, CONFIG_FILE_NAME),
      JSON.stringify({ folders: { world: 'my-custom-bible' } }),
      'utf8',
    );
    const wrote = await writeDefaultConfigIfAbsent(tmpRoot);
    expect(wrote).toBe(false);

    const result = await readLoreFountainConfig(tmpRoot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.folders?.world).toBe('my-custom-bible');
  });
});

describe('writeLoreFountainConfig', () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lorefountain-config-write-merge-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('writes a new config file when none existed', async () => {
    await writeLoreFountainConfig(tmpRoot, { world: { hiddenCategories: ['faction'] } });

    const result = await readLoreFountainConfig(tmpRoot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.world).toEqual({ hiddenCategories: ['faction'] });
  });

  it('merges updates into an existing config, preserving unrelated fields', async () => {
    await fs.writeFile(
      path.join(tmpRoot, CONFIG_FILE_NAME),
      JSON.stringify({ $schema: './resources/lorefountain.config.schema.json', folders: { world: 'bible' } }),
      'utf8',
    );

    await writeLoreFountainConfig(tmpRoot, { world: { hiddenCategories: ['object', 'concept'] } });

    const result = await readLoreFountainConfig(tmpRoot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.$schema).toBe('./resources/lorefountain.config.schema.json');
    expect(result.config.folders).toEqual({ world: 'bible' });
    expect(result.config.world).toEqual({ hiddenCategories: ['object', 'concept'] });
  });

  it('overwrites a previous hiddenCategories value rather than accumulating it', async () => {
    await writeLoreFountainConfig(tmpRoot, { world: { hiddenCategories: ['faction'] } });
    await writeLoreFountainConfig(tmpRoot, { world: { hiddenCategories: ['object'] } });

    const result = await readLoreFountainConfig(tmpRoot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.world).toEqual({ hiddenCategories: ['object'] });
  });

  it('writes and reads back the comic block, merging comic.limits one limit at a time', async () => {
    await writeLoreFountainConfig(tmpRoot, { comic: { preset: 'manga', limits: { maxWordsPerBalloon: 30 } } });
    await writeLoreFountainConfig(tmpRoot, { comic: { sfxAsCue: true, limits: { maxPanelsPerPage: null } } });

    const result = await readLoreFountainConfig(tmpRoot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.comic).toEqual({
      preset: 'manga',
      sfxAsCue: true,
      limits: { maxWordsPerBalloon: 30, maxPanelsPerPage: null },
    });
    expect(comicSettingsFromConfig(result.config)).toEqual({
      settings: { preset: 'manga', sfxAsCue: true, limits: { maxWordsPerBalloon: 30, maxPanelsPerPage: null } },
      issues: [],
    });
  });

  it('leaves the comic block alone when an update does not mention it, and survives a malformed one', async () => {
    await fs.writeFile(path.join(tmpRoot, CONFIG_FILE_NAME), JSON.stringify({ comic: 'oops' }), 'utf8');
    await writeLoreFountainConfig(tmpRoot, { world: { hiddenCategories: ['notes'] } });

    const result = await readLoreFountainConfig(tmpRoot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.comic).toBe('oops');
    expect(comicSettingsFromConfig(result.config).issues).toHaveLength(1);
  });

  it('does not invalidate the rest of the config when the comic block has bad values', async () => {
    await fs.writeFile(
      path.join(tmpRoot, CONFIG_FILE_NAME),
      JSON.stringify({ folders: { scripts: 'issues' }, comic: { preset: 'nope', limits: { maxWordsPerPanel: -3 } } }),
      'utf8',
    );

    const result = await readLoreFountainConfig(tmpRoot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(folderSettingsFromConfig(result.config).scripts).toBe('issues');
    const read = comicSettingsFromConfig(result.config);
    expect(read.settings).toEqual({});
    expect(read.issues).toHaveLength(2);
  });

  it('preserves unknown top-level keys (forward compatibility)', async () => {
    await fs.writeFile(
      path.join(tmpRoot, CONFIG_FILE_NAME),
      JSON.stringify({ futureFeature: { enabled: true } }),
      'utf8',
    );

    await writeLoreFountainConfig(tmpRoot, { world: { hiddenCategories: ['notes'] } });

    const result = await readLoreFountainConfig(tmpRoot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.config as Record<string, unknown>).futureFeature).toEqual({ enabled: true });
  });

  it('adds only project_type to an existing config, leaving every other key as it was', async () => {
    // A config shaped like a real project's: custom folder names, no comic/export blocks.
    const original = { folders: { scripts: 'scripts', world: 'world', imports: 'docs' } };
    await fs.writeFile(path.join(tmpRoot, CONFIG_FILE_NAME), `${JSON.stringify(original, null, 2)}\n`, 'utf8');

    await writeLoreFountainConfig(tmpRoot, { project_type: 'serialized_universe' });

    const written = JSON.parse(await fs.readFile(path.join(tmpRoot, CONFIG_FILE_NAME), 'utf8')) as Record<string, unknown>;
    expect(written).toEqual({ ...original, project_type: 'serialized_universe' });
    expect(projectTypeFromConfig(written)).toEqual({ projectType: 'serialized_universe', issues: [] });
  });

  it('replaces a previous project_type and keeps the comic block', async () => {
    await writeLoreFountainConfig(tmpRoot, { project_type: 'comic', comic: { preset: 'manga' } });
    await writeLoreFountainConfig(tmpRoot, { project_type: 'prose' });

    const result = await readLoreFountainConfig(tmpRoot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.project_type).toBe('prose');
    expect(result.config.comic).toEqual({ preset: 'manga' });
  });
});
