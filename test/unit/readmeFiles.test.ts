import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scaffoldReadmesIfAbsent } from '../../src/config/readmeFiles';

describe('scaffoldReadmesIfAbsent', () => {
  let resourcesDir: string;
  let workspaceDir: string;
  const folders = { world: 'world', scripts: 'scripts', imports: 'imports', assets: 'assets' };

  beforeEach(() => {
    resourcesDir = mkdtempSync(join(tmpdir(), 'lorefountain-readme-resources-'));
    workspaceDir = mkdtempSync(join(tmpdir(), 'lorefountain-readme-workspace-'));

    const readmesDir = join(resourcesDir, 'readmes');
    mkdirSync(readmesDir, { recursive: true });
    writeFileSync(join(readmesDir, 'root.md'), '# {{PROJECT_NAME}}\n{{WORLD_FOLDER}} {{SCRIPTS_FOLDER}} {{IMPORTS_FOLDER}} {{ASSETS_FOLDER}}\n');
    writeFileSync(join(readmesDir, 'world.md'), 'World folder: {{WORLD_FOLDER}}\n');
    writeFileSync(join(readmesDir, 'glossary.md'), 'Glossary in {{WORLD_FOLDER}}/glossary\n');
    writeFileSync(join(readmesDir, 'notes.md'), 'Notes in {{WORLD_FOLDER}}/notes\n');
    writeFileSync(join(readmesDir, 'timeline.md'), 'Timeline in {{WORLD_FOLDER}}/timeline\n');
    writeFileSync(join(readmesDir, 'scripts.md'), 'Scripts folder: {{SCRIPTS_FOLDER}}\n');
    writeFileSync(join(readmesDir, 'imports.md'), 'Imports folder: {{IMPORTS_FOLDER}}\n');
    writeFileSync(join(readmesDir, 'assets.md'), 'Assets folder: {{ASSETS_FOLDER}}\n');
  });

  afterEach(() => {
    rmSync(resourcesDir, { recursive: true, force: true });
    rmSync(workspaceDir, { recursive: true, force: true });
  });

  it('writes all eight READMEs to their folder-specific target paths, with placeholders substituted', async () => {
    const written = await scaffoldReadmesIfAbsent(resourcesDir, workspaceDir, folders, 'My Project');

    expect(written.sort()).toEqual(
      [
        'README.md',
        join('world', 'README.md'),
        join('world', 'glossary', 'README.md'),
        join('world', 'notes', 'README.md'),
        join('world', 'timeline', 'README.md'),
        join('scripts', 'README.md'),
        join('imports', 'README.md'),
        join('assets', 'README.md'),
      ].sort(),
    );
    expect(readFileSync(join(workspaceDir, 'README.md'), 'utf8')).toBe('# My Project\nworld scripts imports assets\n');
    expect(readFileSync(join(workspaceDir, 'world', 'README.md'), 'utf8')).toBe('World folder: world\n');
    expect(readFileSync(join(workspaceDir, 'world', 'glossary', 'README.md'), 'utf8')).toBe('Glossary in world/glossary\n');
    expect(readFileSync(join(workspaceDir, 'scripts', 'README.md'), 'utf8')).toBe('Scripts folder: scripts\n');
    expect(readFileSync(join(workspaceDir, 'imports', 'README.md'), 'utf8')).toBe('Imports folder: imports\n');
    expect(readFileSync(join(workspaceDir, 'assets', 'README.md'), 'utf8')).toBe('Assets folder: assets\n');
  });

  it('places folder READMEs under a custom-configured folder name', async () => {
    await scaffoldReadmesIfAbsent(
      resourcesDir,
      workspaceDir,
      { world: 'lore', scripts: 'screenplay', imports: 'source-docs', assets: 'production-assets' },
      'Custom',
    );

    expect(existsSync(join(workspaceDir, 'lore', 'README.md'))).toBe(true);
    expect(existsSync(join(workspaceDir, 'lore', 'glossary', 'README.md'))).toBe(true);
    expect(existsSync(join(workspaceDir, 'screenplay', 'README.md'))).toBe(true);
    expect(existsSync(join(workspaceDir, 'source-docs', 'README.md'))).toBe(true);
    expect(existsSync(join(workspaceDir, 'production-assets', 'README.md'))).toBe(true);
    expect(readFileSync(join(workspaceDir, 'screenplay', 'README.md'), 'utf8')).toBe('Scripts folder: screenplay\n');
  });

  it('never overwrites a file that already exists', async () => {
    writeFileSync(join(workspaceDir, 'README.md'), 'A writer already customized this.\n');

    const written = await scaffoldReadmesIfAbsent(resourcesDir, workspaceDir, folders, 'My Project');

    expect(written).not.toContain('README.md');
    expect(readFileSync(join(workspaceDir, 'README.md'), 'utf8')).toBe('A writer already customized this.\n');
    expect(existsSync(join(workspaceDir, 'world', 'README.md'))).toBe(true);
  });

  it('returns an empty array when every file already exists', async () => {
    await scaffoldReadmesIfAbsent(resourcesDir, workspaceDir, folders, 'My Project');
    const secondRun = await scaffoldReadmesIfAbsent(resourcesDir, workspaceDir, folders, 'My Project');
    expect(secondRun).toEqual([]);
  });
});
