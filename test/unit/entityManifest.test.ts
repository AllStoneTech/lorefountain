/**
 * Unit tests for the entity-keyed asset manifest readers
 * (characters/locations/objects/voice) and the dangling-manifest-entry
 * detector. Uses real temp directories for the readers, matching the style
 * of `audioManifest.test.ts`.
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  findDanglingManifestEntries,
  readCharacterAssetManifest,
  readLocationAssetManifest,
  readObjectAssetManifest,
  readVoiceAssetManifest,
} from '../../src/assets/entityManifest';

describe('readCharacterAssetManifest', () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lorefountain-character-manifest-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('reports found: false with an empty manifest when characters.json does not exist', async () => {
    const result = await readCharacterAssetManifest(tmpRoot);
    expect(result).toEqual({ ok: true, found: false, manifest: {} });
  });

  it('reads a character entry with versions and looks', async () => {
    await fs.mkdir(path.join(tmpRoot, 'manifests'), { recursive: true });
    await fs.writeFile(
      path.join(tmpRoot, 'manifests', 'characters.json'),
      JSON.stringify({
        lucien: {
          versions: [
            { version: 1, file: 'assets/characters/lucien-v1.safetensors' },
            { version: 2, file: 'assets/characters/lucien-v2.safetensors', source: 'in-house', license: 'owned' },
          ],
          looks: [{ label: 'disguise', file: 'assets/characters/lucien-disguise.png' }],
        },
      }),
      'utf8',
    );

    const result = await readCharacterAssetManifest(tmpRoot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.lucien.versions).toHaveLength(2);
    expect(result.manifest.lucien.looks).toEqual([{ label: 'disguise', file: 'assets/characters/lucien-disguise.png' }]);
  });

  it('rejects an entry with no versions at all', async () => {
    await fs.mkdir(path.join(tmpRoot, 'manifests'), { recursive: true });
    await fs.writeFile(
      path.join(tmpRoot, 'manifests', 'characters.json'),
      JSON.stringify({ lucien: { versions: [] } }),
      'utf8',
    );

    const result = await readCharacterAssetManifest(tmpRoot);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('invalid-schema');
  });

  it('reports malformed JSON without throwing', async () => {
    await fs.mkdir(path.join(tmpRoot, 'manifests'), { recursive: true });
    await fs.writeFile(path.join(tmpRoot, 'manifests', 'characters.json'), '{ not valid', 'utf8');

    const result = await readCharacterAssetManifest(tmpRoot);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('malformed-json');
  });
});

describe('readLocationAssetManifest / readObjectAssetManifest', () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lorefountain-dressed-manifest-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('reads a location entry with versions and dressing', async () => {
    await fs.mkdir(path.join(tmpRoot, 'manifests'), { recursive: true });
    await fs.writeFile(
      path.join(tmpRoot, 'manifests', 'locations.json'),
      JSON.stringify({
        office: {
          versions: [{ version: 1, file: 'assets/locations/office-v1.png' }],
          dressing: [
            { label: 'night', file: 'assets/locations/office-night.png' },
            { label: 'broken-desk', file: 'assets/locations/office-broken-desk.png' },
          ],
        },
      }),
      'utf8',
    );

    const result = await readLocationAssetManifest(tmpRoot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.office.dressing).toHaveLength(2);
  });

  it('reads an object manifest with the same shape as locations', async () => {
    await fs.mkdir(path.join(tmpRoot, 'manifests'), { recursive: true });
    await fs.writeFile(
      path.join(tmpRoot, 'manifests', 'objects.json'),
      JSON.stringify({ 'the-letter': { versions: [{ version: 1, file: 'assets/objects/letter-v1.png' }] } }),
      'utf8',
    );

    const result = await readObjectAssetManifest(tmpRoot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest['the-letter'].versions[0].file).toBe('assets/objects/letter-v1.png');
  });
});

describe('readVoiceAssetManifest', () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lorefountain-voice-manifest-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('reads a voice entry with versions only, no variant field', async () => {
    await fs.mkdir(path.join(tmpRoot, 'manifests'), { recursive: true });
    await fs.writeFile(
      path.join(tmpRoot, 'manifests', 'voice.json'),
      JSON.stringify({ lucien: { versions: [{ version: 1, file: 'assets/voice/lucien-v1.wav' }] } }),
      'utf8',
    );

    const result = await readVoiceAssetManifest(tmpRoot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.lucien).toEqual({ versions: [{ version: 1, file: 'assets/voice/lucien-v1.wav' }] });
  });

  it('rejects a voice entry that tries to carry a looks/dressing field', async () => {
    await fs.mkdir(path.join(tmpRoot, 'manifests'), { recursive: true });
    await fs.writeFile(
      path.join(tmpRoot, 'manifests', 'voice.json'),
      JSON.stringify({ lucien: { versions: [{ version: 1, file: 'v1.wav' }], looks: [{ label: 'x', file: 'x.wav' }] } }),
      'utf8',
    );

    const result = await readVoiceAssetManifest(tmpRoot);
    expect(result.ok).toBe(false);
  });
});

describe('findDanglingManifestEntries', () => {
  it('returns no entries when every manifest key resolves to a known id', () => {
    const dangling = findDanglingManifestEntries(
      { lucien: {}, sango: {} },
      new Set(['lucien', 'sango']),
      'assets/manifests/characters.json',
    );
    expect(dangling).toEqual([]);
  });

  it('flags a manifest key with no matching known id', () => {
    const dangling = findDanglingManifestEntries(
      { lucien: {}, 'old-name': {} },
      new Set(['lucien']),
      'assets/manifests/characters.json',
    );
    expect(dangling).toEqual([{ manifestFile: 'assets/manifests/characters.json', key: 'old-name' }]);
  });

  it('returns no entries for an empty manifest', () => {
    expect(findDanglingManifestEntries({}, new Set(['lucien']), 'assets/manifests/characters.json')).toEqual([]);
  });
});
