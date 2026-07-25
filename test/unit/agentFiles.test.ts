import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scaffoldAgentFilesIfAbsent } from '../../src/config/agentFiles';

describe('scaffoldAgentFilesIfAbsent', () => {
  let resourcesDir: string;
  let workspaceDir: string;

  beforeEach(() => {
    resourcesDir = mkdtempSync(join(tmpdir(), 'lorefountain-agent-resources-'));
    workspaceDir = mkdtempSync(join(tmpdir(), 'lorefountain-agent-workspace-'));

    writeFileSync(join(resourcesDir, 'AGENTS.md'), 'See world/, scripts/, imports/.\n');
    mkdirSync(join(resourcesDir, 'agents'), { recursive: true });
    writeFileSync(join(resourcesDir, 'agents', 'world-builder.md'), 'Entities live in world/.\n');
    writeFileSync(join(resourcesDir, 'agents', 'script-writer.md'), 'Scripts live in scripts/.\n');
    writeFileSync(join(resourcesDir, 'agents', 'initiator.md'), 'Read imports/ first.\n');
    writeFileSync(join(resourcesDir, 'agents', 'validate.js'), 'console.log("validating");\n');
  });

  afterEach(() => {
    rmSync(resourcesDir, { recursive: true, force: true });
    rmSync(workspaceDir, { recursive: true, force: true });
  });

  it('copies all five files verbatim, with no folder-name substitution', async () => {
    const written = await scaffoldAgentFilesIfAbsent(resourcesDir, workspaceDir);

    expect(written.sort()).toEqual(
      [
        'AGENTS.md',
        join('agents', 'initiator.md'),
        join('agents', 'script-writer.md'),
        join('agents', 'world-builder.md'),
        join('agents', 'validate.js'),
      ].sort(),
    );
    expect(readFileSync(join(workspaceDir, 'AGENTS.md'), 'utf8')).toBe('See world/, scripts/, imports/.\n');
    expect(readFileSync(join(workspaceDir, 'agents', 'world-builder.md'), 'utf8')).toBe('Entities live in world/.\n');
    expect(readFileSync(join(workspaceDir, 'agents', 'script-writer.md'), 'utf8')).toBe('Scripts live in scripts/.\n');
    expect(readFileSync(join(workspaceDir, 'agents', 'initiator.md'), 'utf8')).toBe('Read imports/ first.\n');
    expect(readFileSync(join(workspaceDir, 'agents', 'validate.js'), 'utf8')).toBe('console.log("validating");\n');
  });

  it('never overwrites a file that already exists', async () => {
    writeFileSync(join(workspaceDir, 'AGENTS.md'), 'A writer already customized this.\n');

    const written = await scaffoldAgentFilesIfAbsent(resourcesDir, workspaceDir);

    expect(written).not.toContain('AGENTS.md');
    expect(readFileSync(join(workspaceDir, 'AGENTS.md'), 'utf8')).toBe('A writer already customized this.\n');
    // The other four still get written since only AGENTS.md pre-existed.
    expect(existsSync(join(workspaceDir, 'agents', 'world-builder.md'))).toBe(true);
  });

  it('returns an empty array when every file already exists', async () => {
    await scaffoldAgentFilesIfAbsent(resourcesDir, workspaceDir);
    const secondRun = await scaffoldAgentFilesIfAbsent(resourcesDir, workspaceDir);
    expect(secondRun).toEqual([]);
  });
});
