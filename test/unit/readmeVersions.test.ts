import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkReadmeVersions } from '../../src/config/readmeVersions';

describe('checkReadmeVersions', () => {
  let workspaceDir: string;
  const folders = { world: 'world', scripts: 'scripts', imports: 'imports' };

  beforeEach(() => {
    workspaceDir = mkdtempSync(join(tmpdir(), 'lorefountain-readme-versions-workspace-'));
    mkdirSync(join(workspaceDir, 'world', 'glossary'), { recursive: true });
  });

  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true });
  });

  it('reports a README with no marker as untracked', async () => {
    writeFileSync(join(workspaceDir, 'README.md'), '# My Project\n');

    const results = await checkReadmeVersions(workspaceDir, folders);
    const root = results.find((r) => r.relativePath === 'README.md');
    expect(root).toMatchObject({ templateName: 'root.md', status: 'untracked', currentVersion: 1 });
  });

  it('reports a README behind the current version as stale', async () => {
    writeFileSync(join(workspaceDir, 'world', 'README.md'), '<!-- lorefountain-docs-version: 0 -->\nWorld folder.\n');

    const results = await checkReadmeVersions(workspaceDir, folders);
    const worldReadme = results.find((r) => r.relativePath === join('world', 'README.md'));
    expect(worldReadme).toMatchObject({ templateName: 'world.md', status: 'stale', workspaceVersion: 0, currentVersion: 1 });
  });

  it('reports a README matching the current version as current', async () => {
    writeFileSync(
      join(workspaceDir, 'world', 'glossary', 'README.md'),
      '<!-- lorefountain-docs-version: 1 -->\nGlossary folder.\n',
    );

    const results = await checkReadmeVersions(workspaceDir, folders);
    const glossaryReadme = results.find((r) => r.relativePath === join('world', 'glossary', 'README.md'));
    expect(glossaryReadme).toMatchObject({ status: 'current', version: 1 });
  });

  it('resolves target paths under a custom-configured folder name', async () => {
    mkdirSync(join(workspaceDir, 'lore'), { recursive: true });
    writeFileSync(join(workspaceDir, 'lore', 'README.md'), '<!-- lorefountain-docs-version: 1 -->\nLore folder.\n');

    const results = await checkReadmeVersions(workspaceDir, { world: 'lore', scripts: 'scripts', imports: 'imports' });
    const worldReadme = results.find((r) => r.templateName === 'world.md');
    expect(worldReadme).toMatchObject({ relativePath: join('lore', 'README.md'), status: 'current', version: 1 });
  });

  it('skips a tracked README that was never scaffolded into this workspace', async () => {
    const results = await checkReadmeVersions(workspaceDir, folders);
    expect(results).toEqual([]);
  });
});
