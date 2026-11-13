import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scaffoldStoryOverviewIfAbsent } from '../../src/config/storyOverview';

describe('scaffoldStoryOverviewIfAbsent', () => {
  let resourcesDir: string;
  let worldDir: string;

  beforeEach(() => {
    resourcesDir = mkdtempSync(join(tmpdir(), 'lorefountain-overview-resources-'));
    worldDir = join(mkdtempSync(join(tmpdir(), 'lorefountain-overview-workspace-')), 'world');

    writeFileSync(
      join(resourcesDir, 'story-overview.md'),
      '# {{PROJECT_NAME}} — Story Overview\n\n## Premise\n\n<!-- fill in -->\n',
    );
  });

  afterEach(() => {
    rmSync(resourcesDir, { recursive: true, force: true });
    rmSync(worldDir, { recursive: true, force: true });
  });

  it('writes world/overview.lf.md with the project name substituted', async () => {
    const wrote = await scaffoldStoryOverviewIfAbsent(resourcesDir, worldDir, 'My Project');

    expect(wrote).toBe(true);
    expect(readFileSync(join(worldDir, 'overview.lf.md'), 'utf8')).toBe(
      '# My Project — Story Overview\n\n## Premise\n\n<!-- fill in -->\n',
    );
  });

  it('creates the world folder if it does not exist yet', async () => {
    const wrote = await scaffoldStoryOverviewIfAbsent(resourcesDir, worldDir, 'My Project');
    expect(wrote).toBe(true);
    expect(existsSync(worldDir)).toBe(true);
  });

  it('never overwrites an existing overview.lf.md', async () => {
    await scaffoldStoryOverviewIfAbsent(resourcesDir, worldDir, 'My Project');
    writeFileSync(join(worldDir, 'overview.lf.md'), 'A writer already wrote real content here.\n');

    const wrote = await scaffoldStoryOverviewIfAbsent(resourcesDir, worldDir, 'My Project');

    expect(wrote).toBe(false);
    expect(readFileSync(join(worldDir, 'overview.lf.md'), 'utf8')).toBe('A writer already wrote real content here.\n');
  });

  it('does not scaffold a second overview when a legacy OVERVIEW.md exists', async () => {
    mkdirSync(worldDir, { recursive: true });
    writeFileSync(join(worldDir, 'OVERVIEW.md'), 'Old name, real content.\n');

    expect(await scaffoldStoryOverviewIfAbsent(resourcesDir, worldDir, 'My Project')).toBe(false);
    expect(existsSync(join(worldDir, 'overview.lf.md'))).toBe(false);
  });
});

