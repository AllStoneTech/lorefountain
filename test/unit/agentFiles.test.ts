import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scaffoldAgentFilesIfAbsent } from '../../src/config/agentFiles';

describe('scaffoldAgentFilesIfAbsent', () => {
  let resourcesDir: string;
  let workspaceDir: string;
  const folders = { world: 'world', scripts: 'scripts', imports: 'imports' };

  beforeEach(() => {
    resourcesDir = mkdtempSync(join(tmpdir(), 'lorefountain-agent-resources-'));
    workspaceDir = mkdtempSync(join(tmpdir(), 'lorefountain-agent-workspace-'));

    writeFileSync(join(resourcesDir, 'AGENTS.md'), 'See {{WORLD_FOLDER}}, {{SCRIPTS_FOLDER}}, {{IMPORTS_FOLDER}}.\n');
    mkdirSync(join(resourcesDir, 'agents'), { recursive: true });
    writeFileSync(join(resourcesDir, 'agents', 'world-builder.md'), 'Entities live in {{WORLD_FOLDER}}.\n');
    writeFileSync(join(resourcesDir, 'agents', 'script-writer.md'), 'Scripts live in {{SCRIPTS_FOLDER}}.\n');
    writeFileSync(join(resourcesDir, 'agents', 'initiator.md'), 'Read {{IMPORTS_FOLDER}} first.\n');
  });

  afterEach(() => {
    rmSync(resourcesDir, { recursive: true, force: true });
    rmSync(workspaceDir, { recursive: true, force: true });
  });

  it('writes all four files with placeholders substituted', async () => {
    const written = await scaffoldAgentFilesIfAbsent(resourcesDir, workspaceDir, folders);

    expect(written.sort()).toEqual(
      ['AGENTS.md', join('agents', 'initiator.md'), join('agents', 'script-writer.md'), join('agents', 'world-builder.md')].sort(),
    );
    expect(readFileSync(join(workspaceDir, 'AGENTS.md'), 'utf8')).toBe('See world, scripts, imports.\n');
    expect(readFileSync(join(workspaceDir, 'agents', 'world-builder.md'), 'utf8')).toBe('Entities live in world.\n');
    expect(readFileSync(join(workspaceDir, 'agents', 'script-writer.md'), 'utf8')).toBe('Scripts live in scripts.\n');
    expect(readFileSync(join(workspaceDir, 'agents', 'initiator.md'), 'utf8')).toBe('Read imports first.\n');
  });

  it('substitutes custom folder names, not just the defaults', async () => {
    await scaffoldAgentFilesIfAbsent(resourcesDir, workspaceDir, { world: 'lore', scripts: 'screenplay', imports: 'source-docs' });

    expect(readFileSync(join(workspaceDir, 'agents', 'world-builder.md'), 'utf8')).toBe('Entities live in lore.\n');
    expect(readFileSync(join(workspaceDir, 'agents', 'script-writer.md'), 'utf8')).toBe('Scripts live in screenplay.\n');
    expect(readFileSync(join(workspaceDir, 'agents', 'initiator.md'), 'utf8')).toBe('Read source-docs first.\n');
  });

  it('never overwrites a file that already exists', async () => {
    writeFileSync(join(workspaceDir, 'AGENTS.md'), 'A writer already customized this.\n');

    const written = await scaffoldAgentFilesIfAbsent(resourcesDir, workspaceDir, folders);

    expect(written).not.toContain('AGENTS.md');
    expect(readFileSync(join(workspaceDir, 'AGENTS.md'), 'utf8')).toBe('A writer already customized this.\n');
    // The other three still get written since only AGENTS.md pre-existed.
    expect(existsSync(join(workspaceDir, 'agents', 'world-builder.md'))).toBe(true);
  });

  it('returns an empty array when every file already exists', async () => {
    await scaffoldAgentFilesIfAbsent(resourcesDir, workspaceDir, folders);
    const secondRun = await scaffoldAgentFilesIfAbsent(resourcesDir, workspaceDir, folders);
    expect(secondRun).toEqual([]);
  });
});
