import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkAgentFileVersions, parseVersionMarker } from '../../src/config/agentFileVersions';

describe('parseVersionMarker', () => {
  it('parses a well-formed Markdown marker', () => {
    expect(parseVersionMarker('<!-- lorefountain-docs-version: 3 -->\n# Title\n')).toBe(3);
  });

  it('parses a well-formed JS marker', () => {
    expect(parseVersionMarker('// lorefountain-docs-version: 2\nconsole.log("hi");\n')).toBe(2);
  });

  it('returns undefined when no marker is present', () => {
    expect(parseVersionMarker('# Just a title\nNo marker here.\n')).toBeUndefined();
  });

  it('returns undefined for a marker not on the first line', () => {
    expect(parseVersionMarker('# Title\n<!-- lorefountain-docs-version: 3 -->\n')).toBeUndefined();
  });

  it('returns undefined for an empty file', () => {
    expect(parseVersionMarker('')).toBeUndefined();
  });
});

describe('checkAgentFileVersions', () => {
  let workspaceDir: string;

  beforeEach(() => {
    workspaceDir = mkdtempSync(join(tmpdir(), 'lorefountain-agent-versions-workspace-'));
    mkdirSync(join(workspaceDir, 'agents'), { recursive: true });
  });

  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true });
  });

  it('reports a file with no marker as untracked', async () => {
    writeFileSync(join(workspaceDir, 'AGENTS.md'), 'See world/, scripts/, imports/.\n');

    const results = await checkAgentFileVersions(workspaceDir);
    const agentsMd = results.find((r) => r.relativePath === 'AGENTS.md');
    expect(agentsMd).toMatchObject({ status: 'untracked', currentVersion: 2 });
  });

  it('reports a file behind the current version as stale', async () => {
    // AGENT_FILE_VERSIONS currently pins world-builder.md at 3; a marker of
    // 0 is an artificial-but-valid way to exercise the "behind current"
    // branch without depending on the real constant's exact value.
    writeFileSync(
      join(workspaceDir, 'agents', 'world-builder.md'),
      '<!-- lorefountain-docs-version: 0 -->\nEntities live in world/.\n',
    );

    const results = await checkAgentFileVersions(workspaceDir);
    const worldBuilder = results.find((r) => r.relativePath === join('agents', 'world-builder.md'));
    expect(worldBuilder).toMatchObject({ status: 'stale', workspaceVersion: 0, currentVersion: 3 });
  });

  it('reports a file matching the current version as current', async () => {
    writeFileSync(
      join(workspaceDir, 'agents', 'world-builder.md'),
      '<!-- lorefountain-docs-version: 3 -->\nEntities live in world/.\n',
    );

    const results = await checkAgentFileVersions(workspaceDir);
    const worldBuilder = results.find((r) => r.relativePath === join('agents', 'world-builder.md'));
    expect(worldBuilder).toMatchObject({ status: 'current', version: 3 });
  });

  it('skips a tracked file that was never scaffolded into this workspace', async () => {
    const results = await checkAgentFileVersions(workspaceDir);
    expect(results).toEqual([]);
  });

  it('reports validate.js current when its JS-style marker matches', async () => {
    writeFileSync(
      join(workspaceDir, 'agents', 'validate.js'),
      '// lorefountain-docs-version: 1\nconsole.log("validating");\n',
    );

    const results = await checkAgentFileVersions(workspaceDir);
    expect(results).toEqual([{ relativePath: join('agents', 'validate.js'), status: 'current', version: 1 }]);
  });
});
