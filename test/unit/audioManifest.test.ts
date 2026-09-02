/**
 * Unit tests for the audio manifest reader and the unmapped-cue-tag detector.
 * Uses a real temp directory for the reader so its ENOENT/malformed-JSON
 * branches are exercised against the actual filesystem, matching the style
 * of `configFile.test.ts`.
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { findUnmappedCueTags, readAudioManifest } from '../../src/assets/audioManifest';
import type { CueEntry } from '../../src/cues/parseCues';

describe('readAudioManifest', () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lorefountain-audio-manifest-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('reports found: false with an empty manifest when assets/manifests/audio.json does not exist', async () => {
    const result = await readAudioManifest(tmpRoot);
    expect(result).toEqual({ ok: true, found: false, manifest: {} });
  });

  it('reads and validates a well-formed manifest', async () => {
    await fs.mkdir(path.join(tmpRoot, 'manifests'), { recursive: true });
    await fs.writeFile(
      path.join(tmpRoot, 'manifests', 'audio.json'),
      JSON.stringify({
        'kola-nuts-clatter': { file: 'assets/sfx/kola-nuts-clatter.wav', source: 'freesound.org/s/12345', license: 'CC0' },
        'desk-chair-creak': { file: 'assets/sfx/desk-chair-creak.wav' },
      }),
      'utf8',
    );

    const result = await readAudioManifest(tmpRoot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.found).toBe(true);
    expect(result.manifest['kola-nuts-clatter']).toEqual({
      file: 'assets/sfx/kola-nuts-clatter.wav',
      source: 'freesound.org/s/12345',
      license: 'CC0',
    });
    expect(result.manifest['desk-chair-creak']).toEqual({ file: 'assets/sfx/desk-chair-creak.wav' });
  });

  it('reports malformed JSON without throwing', async () => {
    await fs.mkdir(path.join(tmpRoot, 'manifests'), { recursive: true });
    await fs.writeFile(path.join(tmpRoot, 'manifests', 'audio.json'), '{ not valid json', 'utf8');

    const result = await readAudioManifest(tmpRoot);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('malformed-json');
  });

  it('reports a schema violation (entry missing required file field) without throwing', async () => {
    await fs.mkdir(path.join(tmpRoot, 'manifests'), { recursive: true });
    await fs.writeFile(
      path.join(tmpRoot, 'manifests', 'audio.json'),
      JSON.stringify({ 'kola-nuts-clatter': { source: 'freesound.org/s/12345' } }),
      'utf8',
    );

    const result = await readAudioManifest(tmpRoot);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('invalid-schema');
  });
});

describe('findUnmappedCueTags', () => {
  const cue = (overrides: Partial<CueEntry> & Pick<CueEntry, 'type' | 'description' | 'line'>): CueEntry => overrides;

  it('returns no warnings when a tagged cue has a matching manifest entry', () => {
    const cues: CueEntry[] = [cue({ type: 'sfx', tag: 'kola-nuts-clatter', description: 'kola nuts clatter', line: 0 })];
    const warnings = findUnmappedCueTags(cues, { 'kola-nuts-clatter': { file: 'assets/sfx/kola-nuts-clatter.wav' } });
    expect(warnings).toEqual([]);
  });

  it('warns when a tagged cue has no matching manifest entry', () => {
    const cues: CueEntry[] = [cue({ type: 'sfx', tag: 'kola-nuts-clatter', description: 'kola nuts clatter', line: 3 })];
    const warnings = findUnmappedCueTags(cues, {});
    expect(warnings).toEqual([
      {
        code: 'unmapped-cue-tag',
        path: 'cues[3]',
        message: expect.stringContaining('[kola-nuts-clatter]'),
      },
    ]);
  });

  it('does not warn about an untagged cue', () => {
    const cues: CueEntry[] = [cue({ type: 'sfx', description: 'metal groaning', line: 0 })];
    expect(findUnmappedCueTags(cues, {})).toEqual([]);
  });

  it('reports one warning per unmapped tagged cue, in document order', () => {
    const cues: CueEntry[] = [
      cue({ type: 'sfx', tag: 'first-unmapped', description: 'a', line: 0 }),
      cue({ type: 'sfx', tag: 'mapped', description: 'b', line: 1 }),
      cue({ type: 'amb', tag: 'second-unmapped', description: 'c', line: 2 }),
    ];
    const warnings = findUnmappedCueTags(cues, { mapped: { file: 'assets/sfx/mapped.wav' } });
    expect(warnings.map((w) => w.path)).toEqual(['cues[0]', 'cues[2]']);
  });
});
