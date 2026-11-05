/**
 * Unit tests for the shot manifest reader and its three checks:
 * `unmapped-shot-tag`, `shot-kind-mismatch` and `unused-shot-tag`. Uses a
 * real temp directory for the reader, matching `audioManifest.test.ts`.
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  findShotManifestIssues,
  findUnmappedShotTags,
  readShotManifest,
  type ShotManifest,
} from '../../src/assets/shotManifest';
import { buildShotMap } from '../../src/shots/shotMap';

describe('readShotManifest', () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lorefountain-shot-manifest-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  async function writeManifest(content: string): Promise<void> {
    await fs.mkdir(path.join(tmpRoot, 'manifests'), { recursive: true });
    await fs.writeFile(path.join(tmpRoot, 'manifests', 'shots.json'), content, 'utf8');
  }

  it('reports found: false with an empty manifest when shots.json does not exist', async () => {
    expect(await readShotManifest(tmpRoot)).toEqual({ ok: true, found: false, manifest: {} });
  });

  it('reads and validates a well-formed manifest', async () => {
    const manifest = {
      'archive-ident': { file: 'shots/archive-ident.mp4', kind: 'clip', source: 'Veo' },
      '1x01-basement-wide': {
        file: 'shots/1x01/basement-wide.png',
        kind: 'still',
        motion: 'ken-burns-in',
        license: 'owned',
        prompt: 'A basement office at night',
      },
    };
    await writeManifest(JSON.stringify(manifest));
    expect(await readShotManifest(tmpRoot)).toEqual({ ok: true, found: true, manifest });
  });

  it('reports malformed JSON without throwing', async () => {
    await writeManifest('{ not json');
    const result = await readShotManifest(tmpRoot);
    expect(result).toMatchObject({ ok: false, reason: 'malformed-json' });
  });

  it('reports a schema violation (missing kind, unknown kind) without throwing', async () => {
    await writeManifest(JSON.stringify({ a: { file: 'a.png' }, b: { file: 'b.png', kind: 'gif' } }));
    const result = await readShotManifest(tmpRoot);
    expect(result).toMatchObject({ ok: false, reason: 'invalid-schema' });
    if (!result.ok) {
      expect(result.message).toContain('a.kind');
      expect(result.message).toContain('b.kind');
    }
  });

  it('drops fields the schema does not know', async () => {
    await writeManifest(JSON.stringify({ a: { file: 'a.png', kind: 'still', internal: true } }));
    const result = await readShotManifest(tmpRoot);
    expect(result.ok && result.manifest).toEqual({ a: { file: 'a.png', kind: 'still' } });
  });
});

describe('findUnmappedShotTags', () => {
  const manifest: ShotManifest = { 'mapped-shot': { file: 'a.png', kind: 'still' } };

  it('warns once per tagged shot with no entry, and never for untagged or mapped shots', () => {
    const { shots } = buildShotMap(
      'INT. A - DAY\n\nSHOT: [mapped-shot] WIDE\n\nSHOT: CLOSE\n\nSHOT: [missing-shot] INSERT\n\nSHOT: [missing-shot] INSERT again\n',
      [],
    );
    const warnings = findUnmappedShotTags(shots, manifest);
    expect(warnings.map((warning) => warning.code)).toEqual(['unmapped-shot-tag', 'unmapped-shot-tag']);
    expect(warnings[0].message).toContain('[missing-shot]');
    expect(warnings[0].message).toContain('line 7');
  });

  it('matches exactly, ignoring inherited object keys', () => {
    const { shots } = buildShotMap('INT. A - DAY\n\nSHOT: [constructor] WIDE\n', []);
    expect(findUnmappedShotTags(shots, {})).toHaveLength(1);
  });
});

describe('findShotManifestIssues', () => {
  it('warns when kind contradicts a recognized extension', () => {
    const manifest: ShotManifest = {
      'still-as-clip': { file: 'shots/a.MP4', kind: 'still' },
      'clip-as-still': { file: 'shots/b.jpeg', kind: 'clip' },
      fine: { file: 'shots/c.webp', kind: 'still' },
    };
    const issues = findShotManifestIssues(manifest, new Set(Object.keys(manifest)));
    expect(issues.map((issue) => [issue.code, issue.severity, issue.key])).toEqual([
      ['shot-kind-mismatch', 'warning', 'still-as-clip'],
      ['shot-kind-mismatch', 'warning', 'clip-as-still'],
    ]);
  });

  it('never flags an unrecognized extension such as .gif', () => {
    const manifest: ShotManifest = { a: { file: 'a.gif', kind: 'still' }, b: { file: 'b.gif', kind: 'clip' } };
    expect(findShotManifestIssues(manifest, new Set(['a', 'b']))).toEqual([]);
  });

  it('notes an entry no script uses', () => {
    const manifest: ShotManifest = { used: { file: 'a.png', kind: 'still' }, cut: { file: 'b.png', kind: 'still' } };
    const issues = findShotManifestIssues(manifest, new Set(['used']));
    expect(issues).toEqual([expect.objectContaining({ code: 'unused-shot-tag', severity: 'info', key: 'cut' })]);
  });
});
