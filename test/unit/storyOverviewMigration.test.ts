/**
 * Unit tests for renaming a legacy `OVERVIEW.md` to `overview.lf.md`
 * (`migrateStoryOverviewName` in `src/config/storyOverview.ts`, ADR-0048).
 */

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrateStoryOverviewName } from '../../src/config/storyOverview';

describe('migrateStoryOverviewName', () => {
  let worldDir: string;
  beforeEach(() => {
    worldDir = join(mkdtempSync(join(tmpdir(), 'lorefountain-overview-migrate-')), 'world');
    mkdirSync(worldDir, { recursive: true });
  });
  afterEach(() => {
    rmSync(join(worldDir, '..'), { recursive: true, force: true });
  });

  it('renames a legacy OVERVIEW.md to overview.lf.md, keeping its content byte for byte', async () => {
    const content = ['# Orun', '', 'A story.', ''].join('\r\n');
    writeFileSync(join(worldDir, 'OVERVIEW.md'), content);

    const result = await migrateStoryOverviewName(worldDir);

    expect(result).toEqual({ status: 'renamed', from: join(worldDir, 'OVERVIEW.md'), to: join(worldDir, 'overview.lf.md') });
    expect(readFileSync(join(worldDir, 'overview.lf.md'), 'utf8')).toBe(content);
    expect(readdirSync(worldDir)).toEqual(['overview.lf.md']);
  });

  it('is a no-op when there is no overview, and the second time', async () => {
    expect(await migrateStoryOverviewName(worldDir)).toEqual({ status: 'none' });
    writeFileSync(join(worldDir, 'OVERVIEW.md'), 'x');
    await migrateStoryOverviewName(worldDir);
    expect(await migrateStoryOverviewName(worldDir)).toEqual({ status: 'none' });
  });

  it('also renames a differently-cased legacy name', async () => {
    writeFileSync(join(worldDir, 'Overview.md'), 'x');
    expect((await migrateStoryOverviewName(worldDir)).status).toBe('renamed');
    expect(readdirSync(worldDir)).toEqual(['overview.lf.md']);
  });

  it('never overwrites: with both files present it reports a conflict and changes nothing', async () => {
    writeFileSync(join(worldDir, 'OVERVIEW.md'), 'old');
    writeFileSync(join(worldDir, 'overview.lf.md'), 'new');

    const result = await migrateStoryOverviewName(worldDir);

    expect(result.status).toBe('conflict');
    expect(readFileSync(join(worldDir, 'OVERVIEW.md'), 'utf8')).toBe('old');
    expect(readFileSync(join(worldDir, 'overview.lf.md'), 'utf8')).toBe('new');
  });

  it('does not touch an entity whose name merely starts with overview', async () => {
    writeFileSync(join(worldDir, 'overview-notes.md'), 'x');
    expect(await migrateStoryOverviewName(worldDir)).toEqual({ status: 'none' });
    expect(existsSync(join(worldDir, 'overview-notes.md'))).toBe(true);
  });
});
