/**
 * Unit tests for the manifest editor's pure form-state conversion:
 * text -> form state -> back to the on-disk manifest shape.
 */

import { describe, it, expect } from 'vitest';
import {
  applyFormStateToManifest,
  manifestKindFromFileName,
  parseManifestText,
  serializeManifestFormState,
  variantFieldNameFor,
  type ManifestFormState,
} from '../../src/providers/manifestForm';

describe('manifestKindFromFileName', () => {
  it('recognizes all five manifest filenames', () => {
    expect(manifestKindFromFileName('audio.json')).toBe('audio');
    expect(manifestKindFromFileName('characters.json')).toBe('characters');
    expect(manifestKindFromFileName('locations.json')).toBe('locations');
    expect(manifestKindFromFileName('objects.json')).toBe('objects');
    expect(manifestKindFromFileName('voice.json')).toBe('voice');
  });

  it('returns undefined for an unrecognized filename', () => {
    expect(manifestKindFromFileName('something-else.json')).toBeUndefined();
  });
});

describe('variantFieldNameFor', () => {
  it('maps characters to looks, locations/objects to dressing, voice to none', () => {
    expect(variantFieldNameFor('characters')).toBe('looks');
    expect(variantFieldNameFor('locations')).toBe('dressing');
    expect(variantFieldNameFor('objects')).toBe('dressing');
    expect(variantFieldNameFor('voice')).toBeUndefined();
  });
});

describe('parseManifestText', () => {
  it('parses a well-formed audio manifest into flat rows', () => {
    const formState = parseManifestText(
      'audio',
      JSON.stringify({ 'kola-nuts-clatter': { file: 'assets/sfx/kola.wav', source: 'freesound', license: 'CC0' } }),
    );
    expect(formState).toEqual({
      kind: 'audio',
      rows: [{ key: 'kola-nuts-clatter', file: 'assets/sfx/kola.wav', source: 'freesound', license: 'CC0' }],
    });
  });

  it('parses a well-formed character manifest into versioned rows with looks', () => {
    const formState = parseManifestText(
      'characters',
      JSON.stringify({
        lucien: {
          versions: [{ version: 1, file: 'lucien-v1.png' }],
          looks: [{ label: 'disguise', file: 'lucien-disguise.png' }],
        },
      }),
    );
    expect(formState).toEqual({
      kind: 'characters',
      rows: [
        {
          key: 'lucien',
          versions: [{ version: '1', file: 'lucien-v1.png', source: '', license: '' }],
          variants: [{ label: 'disguise', file: 'lucien-disguise.png', source: '', license: '' }],
        },
      ],
    });
  });

  it('parses a location manifest\'s dressing into the same variants shape', () => {
    const formState = parseManifestText(
      'locations',
      JSON.stringify({ office: { versions: [{ version: 1, file: 'office-v1.png' }], dressing: [{ label: 'night', file: 'office-night.png' }] } }),
    );
    expect(formState?.rows[0]).toMatchObject({
      key: 'office',
      variants: [{ label: 'night', file: 'office-night.png', source: '', license: '' }],
    });
  });

  it('parses a voice manifest with no variants field into rows with an empty variants array', () => {
    const formState = parseManifestText('voice', JSON.stringify({ lucien: { versions: [{ version: 1, file: 'v1.wav' }] } }));
    expect(formState).toEqual({
      kind: 'voice',
      rows: [{ key: 'lucien', versions: [{ version: '1', file: 'v1.wav', source: '', license: '' }], variants: [] }],
    });
  });

  it('returns undefined for malformed JSON', () => {
    expect(parseManifestText('audio', '{ not valid')).toBeUndefined();
  });

  it('returns undefined for JSON that fails the schema for that kind', () => {
    expect(parseManifestText('characters', JSON.stringify({ lucien: { versions: [] } }))).toBeUndefined();
  });

  it('returns an empty-rows form state for an empty manifest object', () => {
    expect(parseManifestText('audio', '{}')).toEqual({ kind: 'audio', rows: [] });
  });
});

describe('applyFormStateToManifest / serializeManifestFormState', () => {
  it('round-trips a well-formed audio form state', () => {
    const formState: ManifestFormState = {
      kind: 'audio',
      rows: [{ key: 'kola-nuts-clatter', file: 'assets/sfx/kola.wav', source: 'freesound', license: 'CC0' }],
    };
    expect(applyFormStateToManifest(formState)).toEqual({
      'kola-nuts-clatter': { file: 'assets/sfx/kola.wav', source: 'freesound', license: 'CC0' },
    });
  });

  it('drops an audio row with a blank key', () => {
    const formState: ManifestFormState = { kind: 'audio', rows: [{ key: '  ', file: 'x.wav', source: '', license: '' }] };
    expect(applyFormStateToManifest(formState)).toEqual({});
  });

  it('drops an audio row with a blank file', () => {
    const formState: ManifestFormState = { kind: 'audio', rows: [{ key: 'tag', file: '  ', source: '', license: '' }] };
    expect(applyFormStateToManifest(formState)).toEqual({});
  });

  it('omits source/license from the written entry when left blank', () => {
    const formState: ManifestFormState = { kind: 'audio', rows: [{ key: 'tag', file: 'x.wav', source: '', license: '' }] };
    expect(applyFormStateToManifest(formState)).toEqual({ tag: { file: 'x.wav' } });
  });

  it('round-trips a character entry with versions and looks', () => {
    const formState: ManifestFormState = {
      kind: 'characters',
      rows: [
        {
          key: 'lucien',
          versions: [{ version: '1', file: 'lucien-v1.png', source: '', license: '' }],
          variants: [{ label: 'disguise', file: 'lucien-disguise.png', source: '', license: '' }],
        },
      ],
    };
    expect(applyFormStateToManifest(formState)).toEqual({
      lucien: { versions: [{ version: 1, file: 'lucien-v1.png' }], looks: [{ label: 'disguise', file: 'lucien-disguise.png' }] },
    });
  });

  it('writes dressing (not looks) for a location entry', () => {
    const formState: ManifestFormState = {
      kind: 'locations',
      rows: [
        {
          key: 'office',
          versions: [{ version: '1', file: 'office-v1.png', source: '', license: '' }],
          variants: [{ label: 'night', file: 'office-night.png', source: '', license: '' }],
        },
      ],
    };
    expect(applyFormStateToManifest(formState)).toEqual({
      office: { versions: [{ version: 1, file: 'office-v1.png' }], dressing: [{ label: 'night', file: 'office-night.png' }] },
    });
  });

  it('never writes a variant field for a voice entry, even if variants is somehow non-empty', () => {
    const formState: ManifestFormState = {
      kind: 'voice',
      rows: [
        {
          key: 'lucien',
          versions: [{ version: '1', file: 'v1.wav', source: '', license: '' }],
          variants: [{ label: 'accent', file: 'accent.wav', source: '', license: '' }],
        },
      ],
    };
    expect(applyFormStateToManifest(formState)).toEqual({ lucien: { versions: [{ version: 1, file: 'v1.wav' }] } });
  });

  it('drops an entity-keyed row with a blank key', () => {
    const formState: ManifestFormState = {
      kind: 'characters',
      rows: [{ key: '  ', versions: [{ version: '1', file: 'x.png', source: '', license: '' }], variants: [] }],
    };
    expect(applyFormStateToManifest(formState)).toEqual({});
  });

  it('drops an entity-keyed row whose versions are all entirely blank (a fresh, still-empty row)', () => {
    const formState: ManifestFormState = {
      kind: 'characters',
      rows: [{ key: 'lucien', versions: [{ version: '', file: '', source: '', license: '' }], variants: [] }],
    };
    expect(applyFormStateToManifest(formState)).toEqual({});
  });

  it('keeps a version sub-row that has only a file set (still being typed), and omits the doomed variant field entirely', () => {
    const formState: ManifestFormState = {
      kind: 'characters',
      rows: [{ key: 'lucien', versions: [{ version: '', file: 'lucien-v1.png', source: '', license: '' }], variants: [] }],
    };
    expect(applyFormStateToManifest(formState)).toEqual({ lucien: { versions: [{ version: '', file: 'lucien-v1.png' }] } });
  });

  it('drops a blank variant sub-row but keeps a filled one alongside it', () => {
    const formState: ManifestFormState = {
      kind: 'characters',
      rows: [
        {
          key: 'lucien',
          versions: [{ version: '1', file: 'v1.png', source: '', license: '' }],
          variants: [
            { label: '', file: '', source: '', license: '' },
            { label: 'disguise', file: 'disguise.png', source: '', license: '' },
          ],
        },
      ],
    };
    expect(applyFormStateToManifest(formState)).toEqual({
      lucien: { versions: [{ version: 1, file: 'v1.png' }], looks: [{ label: 'disguise', file: 'disguise.png' }] },
    });
  });

  it('parses a non-integer or non-positive version as the raw string, letting schema validation catch it later', () => {
    const formState: ManifestFormState = {
      kind: 'characters',
      rows: [{ key: 'lucien', versions: [{ version: 'not-a-number', file: 'v1.png', source: '', license: '' }], variants: [] }],
    };
    expect(applyFormStateToManifest(formState)).toEqual({
      lucien: { versions: [{ version: 'not-a-number', file: 'v1.png' }] },
    });
  });

  it('serializes to pretty-printed JSON with a trailing newline', () => {
    const formState: ManifestFormState = { kind: 'audio', rows: [{ key: 'tag', file: 'x.wav', source: '', license: '' }] };
    const text = serializeManifestFormState(formState);
    expect(text).toBe('{\n  "tag": {\n    "file": "x.wav"\n  }\n}\n');
  });

  it('round-trips text -> form state -> text back to the same manifest object', () => {
    const original = { lucien: { versions: [{ version: 1, file: 'v1.png', source: 'in-house', license: 'owned' }], looks: [{ label: 'disguise', file: 'd.png' }] } };
    const formState = parseManifestText('characters', JSON.stringify(original));
    expect(formState).toBeDefined();
    if (!formState) return;
    expect(applyFormStateToManifest(formState)).toEqual(original);
  });
});
