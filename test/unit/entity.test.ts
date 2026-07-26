/**
 * Unit tests for the entity schema and file parse/serialize.
 * Covers the minimal (name+type) case, defaults, optional structured fields
 * (tracked_fields, relations, custom_fields), unknown-key preservation,
 * failure paths (missing required, bad enum, malformed YAML), and round-trip.
 */

import { describe, it, expect } from 'vitest';
import {
  parseEntityFile,
  serializeEntity,
  entityFrontmatterSchema,
  CURRENT_SCHEMA_VERSION,
  type Entity,
} from '../../src/model/entity';

function file(frontmatterLines: string[], body = 'Body.'): string {
  return ['---', ...frontmatterLines, '---', '', body].join('\n');
}

describe('parseEntityFile — happy path', () => {
  it('accepts an entity with only name and type, applying the schema_version default', () => {
    const result = parseEntityFile(file(['name: Sango', 'type: character']), {
      id: 'sango',
      filePath: '/world/sango.md',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entity.id).toBe('sango');
    expect(result.entity.frontmatter.name).toBe('Sango');
    expect(result.entity.frontmatter.type).toBe('character');
    expect(result.entity.frontmatter.schema_version).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.warnings).toEqual([]);
  });

  it('parses tracked_fields, relations, and custom_fields', () => {
    const result = parseEntityFile(
      file([
        'name: The Ark',
        'type: location',
        'mobility: mobile-continuous',
        'tracked_fields:',
        '  position:',
        '    - order: 1',
        '      value: "Phoenix, AZ"',
        '      timing: "1x01"',
        '    - order: 2',
        '      value: Neo-Tokyo',
        '      timing: "1x02"',
        'relations:',
        '  - target: sango',
        '    relation_type: ally',
        '    attitude: wary',
        'custom_fields:',
        '  yoruba_gloss: "Ọ̀run"',
      ]),
      { id: 'the-ark', filePath: '/world/the-ark.md' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const fm = result.entity.frontmatter;
    expect(fm.tracked_fields?.position).toHaveLength(2);
    expect(fm.tracked_fields?.position?.[0]).toMatchObject({ order: 1, value: 'Phoenix, AZ', timing: '1x01' });
    expect(fm.relations?.[0]).toMatchObject({ target: 'sango', relation_type: 'ally', attitude: 'wary' });
    expect(fm.custom_fields?.yoruba_gloss).toBe('Ọ̀run');
    // Type-specific field only accessible after narrowing by `type` (compile-time check).
    if (fm.type === 'location') {
      expect(fm.mobility).toBe('mobile-continuous');
    }
  });

  it('preserves unknown top-level keys on round-trip (files-as-truth)', () => {
    const result = parseEntityFile(
      file(['name: Hera', 'type: character', 'experimental_field: keep-me']),
      { id: 'hera', filePath: '/world/hera.md' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.entity.frontmatter as Record<string, unknown>).experimental_field).toBe('keep-me');

    const serialized = serializeEntity(result.entity);
    expect(serialized).toMatch(/experimental_field: keep-me/);
  });
});

describe('parseEntityFile — failure paths', () => {
  it('rejects a missing required name', () => {
    const result = parseEntityFile(file(['type: character']), {
      id: 'x',
      filePath: '/world/x.md',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('invalid-schema');
    expect(result.issues?.some((i) => i.path === 'name')).toBe(true);
  });

  it('rejects an invalid entity type', () => {
    const result = parseEntityFile(file(['name: X', 'type: spaceship']), {
      id: 'x',
      filePath: '/world/x.md',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('invalid-schema');
    expect(result.issues?.some((i) => i.path === 'type')).toBe(true);
  });

  it('rejects an invalid canon_status enum', () => {
    const result = parseEntityFile(file(['name: X', 'type: concept', 'canon_status: maybe']), {
      id: 'x',
      filePath: '/world/x.md',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues?.some((i) => i.path === 'canon_status')).toBe(true);
  });

  it('reports malformed YAML distinctly from schema errors', () => {
    const text = ['---', 'name: "oops', 'type: character', '---', '', 'body'].join('\n');
    const result = parseEntityFile(text, { id: 'x', filePath: '/world/x.md' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('malformed-yaml');
  });
});

describe('parseEntityFile — misplaced type-specific fields (warnings, not errors)', () => {
  it('accepts a character-specific field on a location, preserving the value and warning', () => {
    const result = parseEntityFile(
      file(['name: The Ark', 'type: location', 'sound_motif: low mechanical thrum']),
      { id: 'the-ark', filePath: '/world/the-ark.md' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Not part of the LocationFrontmatter type, but preserved via catchall.
    expect((result.entity.frontmatter as Record<string, unknown>).sound_motif).toBe(
      'low mechanical thrum',
    );
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatchObject({ code: 'misplaced-field', path: 'sound_motif' });
    expect(result.warnings[0].message).toMatch(/character-specific/);
  });

  it('accepts a location-specific field on a character, preserving the value and warning', () => {
    const result = parseEntityFile(file(['name: Hera', 'type: character', 'mobility: fixed']), {
      id: 'hera',
      filePath: '/world/hera.md',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.entity.frontmatter as Record<string, unknown>).mobility).toBe('fixed');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatchObject({ code: 'misplaced-field', path: 'mobility' });
  });

  it('reports no warnings for a correctly-placed type-specific field', () => {
    const result = parseEntityFile(file(['name: Sango', 'type: character', 'sound_motif: thunder']), {
      id: 'sango',
      filePath: '/world/sango.md',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
  });

  it('accepts voice_actor on a character with no warnings', () => {
    const result = parseEntityFile(file(['name: Sango', 'type: character', 'voice_actor: Jane Doe']), {
      id: 'sango',
      filePath: '/world/sango.md',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.entity.frontmatter as Record<string, unknown>).voice_actor).toBe('Jane Doe');
    expect(result.warnings).toEqual([]);
  });

  it('flags voice_actor as misplaced on a non-character entity', () => {
    const result = parseEntityFile(file(['name: The Ark', 'type: location', 'voice_actor: Jane Doe']), {
      id: 'the-ark',
      filePath: '/world/the-ark.md',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatchObject({ code: 'misplaced-field', path: 'voice_actor' });
  });

  it('reports no warnings for faction/object/concept, which have no bespoke fields', () => {
    const result = parseEntityFile(file(['name: The Orisha Pantheon', 'type: faction']), {
      id: 'pantheon',
      filePath: '/world/pantheon.md',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
  });
});

describe('serializeEntity', () => {
  it('round-trips a fully-populated entity', () => {
    const entity: Entity = {
      id: 'esu',
      filePath: '/world/esu.md',
      body: 'The trickster at the crossroads.',
      frontmatter: entityFrontmatterSchema.parse({
        name: 'Esu',
        type: 'character',
        aliases: ['Eshu', 'Elegba'],
        pronunciation: 'EH-shoo',
        canon_status: 'established',
        tags: ['orisha', 'trickster'],
      }),
    };
    const serialized = serializeEntity(entity);
    const reparsed = parseEntityFile(serialized, { id: 'esu', filePath: '/world/esu.md' });
    expect(reparsed.ok).toBe(true);
    if (!reparsed.ok) return;
    expect(reparsed.entity.frontmatter).toEqual(entity.frontmatter);
    expect(reparsed.entity.body).toBe(entity.body);
  });
});
