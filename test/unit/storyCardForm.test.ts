/**
 * Unit tests for Story Card form state conversion.
 */

import { describe, it, expect } from 'vitest';
import { entityFrontmatterSchema, type Entity } from '../../src/model/entity';
import { applyFormStateToEntity, entityToFormState, type EntityFormState } from '../../src/providers/storyCardForm';

function entity(overrides: Record<string, unknown> = {}, body = 'Body text.'): Entity {
  return {
    id: 'sango',
    filePath: '/world/sango.md',
    body,
    frontmatter: entityFrontmatterSchema.parse({ name: 'Sango', type: 'character', ...overrides }),
  };
}

function blankCharacterForm(overrides: Partial<EntityFormState> = {}): EntityFormState {
  return {
    id: 'sango',
    name: 'Sango',
    type: 'character',
    aliases: '',
    pronunciation: '',
    tags: '',
    canonStatus: '',
    body: 'Body text.',
    relations: [],
    soundMotif: '',
    castingNotes: '',
    parentLocation: '',
    mobility: '',
    episodes: [],
    ...overrides,
  };
}

describe('entityToFormState', () => {
  it('flattens the base fields', () => {
    const form = entityToFormState(
      entity({ aliases: ['Shango', 'Xango'], pronunciation: 'SHAHN-go', tags: ['orisha', 'pantheon'], canon_status: 'established' }),
    );
    expect(form.name).toBe('Sango');
    expect(form.type).toBe('character');
    expect(form.aliases).toBe('Shango, Xango');
    expect(form.pronunciation).toBe('SHAHN-go');
    expect(form.tags).toBe('orisha, pantheon');
    expect(form.canonStatus).toBe('established');
    expect(form.body).toBe('Body text.');
  });

  it('defaults optional fields to empty strings/arrays when absent', () => {
    const form = entityToFormState(entity());
    expect(form.aliases).toBe('');
    expect(form.pronunciation).toBe('');
    expect(form.tags).toBe('');
    expect(form.canonStatus).toBe('');
    expect(form.relations).toEqual([]);
  });

  it('flattens relations into relation form rows', () => {
    const form = entityToFormState(
      entity({ relations: [{ target: 'esu', relation_type: 'ally', attitude: 'wary' }] }),
    );
    expect(form.relations).toEqual([{ target: 'esu', relationType: 'ally', attitude: 'wary' }]);
  });

  it('omits attitude as empty string when absent from a relation', () => {
    const form = entityToFormState(entity({ relations: [{ target: 'esu', relation_type: 'ally' }] }));
    expect(form.relations).toEqual([{ target: 'esu', relationType: 'ally', attitude: '' }]);
  });

  it('surfaces character-specific fields only for a character', () => {
    const form = entityToFormState(entity({ sound_motif: 'thunder', casting_notes: 'booming voice' }));
    expect(form.soundMotif).toBe('thunder');
    expect(form.castingNotes).toBe('booming voice');
    expect(form.parentLocation).toBe('');
    expect(form.mobility).toBe('');
  });

  it('surfaces location-specific fields only for a location', () => {
    const form = entityToFormState(
      entity({ name: 'The Ark', type: 'location', parent_location: 'orun', mobility: 'mobile-continuous' }),
    );
    expect(form.parentLocation).toBe('orun');
    expect(form.mobility).toBe('mobile-continuous');
    expect(form.soundMotif).toBe('');
    expect(form.castingNotes).toBe('');
  });

  it('surfaces the episodes list only for an arc', () => {
    const form = entityToFormState(
      entity({ name: 'Imperium in Imperio', type: 'arc', episodes: ['1x03', '1x04', '1x07'] }),
    );
    expect(form.episodes).toEqual(['1x03', '1x04', '1x07']);
  });

  it('defaults episodes to an empty array for a non-arc entity', () => {
    const form = entityToFormState(entity());
    expect(form.episodes).toEqual([]);
  });
});

describe('applyFormStateToEntity', () => {
  it('applies edited base fields', () => {
    const updated = applyFormStateToEntity(
      entity(),
      blankCharacterForm({ pronunciation: 'SHAHN-go', aliases: 'Shango, Xango', tags: 'orisha, pantheon', canonStatus: 'established' }),
    );
    expect(updated.frontmatter.pronunciation).toBe('SHAHN-go');
    expect(updated.frontmatter.aliases).toEqual(['Shango', 'Xango']);
    expect(updated.frontmatter.tags).toEqual(['orisha', 'pantheon']);
    expect(updated.frontmatter.canon_status).toBe('established');
  });

  it('clears a field when the form value is blank', () => {
    const updated = applyFormStateToEntity(
      entity({ pronunciation: 'SHAHN-go' }),
      blankCharacterForm({ pronunciation: '' }),
    );
    expect(updated.frontmatter.pronunciation).toBeUndefined();
  });

  it('trims whitespace from the name', () => {
    const updated = applyFormStateToEntity(entity(), blankCharacterForm({ name: '  Sango  ' }));
    expect(updated.frontmatter.name).toBe('Sango');
  });

  it('updates the body', () => {
    const updated = applyFormStateToEntity(entity(), blankCharacterForm({ body: 'A new description.' }));
    expect(updated.body).toBe('A new description.');
  });

  it('applies character-specific fields', () => {
    const updated = applyFormStateToEntity(
      entity(),
      blankCharacterForm({ soundMotif: 'thunder', castingNotes: 'booming voice' }),
    );
    expect(updated.frontmatter.type).toBe('character');
    if (updated.frontmatter.type !== 'character') return;
    expect(updated.frontmatter.sound_motif).toBe('thunder');
    expect(updated.frontmatter.casting_notes).toBe('booming voice');
  });

  it('applies location-specific fields when the type is location', () => {
    const updated = applyFormStateToEntity(
      entity({ name: 'The Ark', type: 'location' }, ''),
      blankCharacterForm({ type: 'location', parentLocation: 'orun', mobility: 'mobile-continuous' }),
    );
    expect(updated.frontmatter.type).toBe('location');
    if (updated.frontmatter.type !== 'location') return;
    expect(updated.frontmatter.parent_location).toBe('orun');
    expect(updated.frontmatter.mobility).toBe('mobile-continuous');
  });

  it('applies arc-specific episodes, dropping blank rows and trimming whitespace', () => {
    const updated = applyFormStateToEntity(
      entity({ name: 'Imperium in Imperio', type: 'arc' }, ''),
      blankCharacterForm({ type: 'arc', episodes: [' 1x03 ', '', '1x04'] }),
    );
    expect(updated.frontmatter.type).toBe('arc');
    if (updated.frontmatter.type !== 'arc') return;
    expect(updated.frontmatter.episodes).toEqual(['1x03', '1x04']);
  });

  it('clears episodes entirely when the form has none', () => {
    const updated = applyFormStateToEntity(
      entity({ name: 'Imperium in Imperio', type: 'arc', episodes: ['1x03'] }, ''),
      blankCharacterForm({ type: 'arc', episodes: [] }),
    );
    expect(updated.frontmatter.type).toBe('arc');
    if (updated.frontmatter.type !== 'arc') return;
    expect(updated.frontmatter.episodes).toBeUndefined();
  });

  it('applies edited relations, dropping rows with no target or relation type', () => {
    const updated = applyFormStateToEntity(
      entity(),
      blankCharacterForm({
        relations: [
          { target: 'esu', relationType: 'ally', attitude: 'wary' },
          { target: '', relationType: 'enemy', attitude: '' },
          { target: 'oya', relationType: '', attitude: '' },
        ],
      }),
    );
    expect(updated.frontmatter.relations).toEqual([{ target: 'esu', relation_type: 'ally', attitude: 'wary' }]);
  });

  it('clears relations entirely when the form has none', () => {
    const updated = applyFormStateToEntity(
      entity({ relations: [{ target: 'esu', relation_type: 'ally' }] }),
      blankCharacterForm({ relations: [] }),
    );
    expect(updated.frontmatter.relations).toBeUndefined();
  });

  it('preserves fields the form does not cover (custom_fields, tracked_fields)', () => {
    const original = entity({
      custom_fields: { yoruba_gloss: 'Ọ̀run' },
      tracked_fields: { status: [{ order: 1, value: 'core', timing: '1x01' }] },
    });
    const updated = applyFormStateToEntity(original, blankCharacterForm());
    expect(updated.frontmatter.custom_fields).toEqual({ yoruba_gloss: 'Ọ̀run' });
    expect(updated.frontmatter.tracked_fields).toEqual({ status: [{ order: 1, value: 'core', timing: '1x01' }] });
  });

  it('carries over old type-specific fields as extra data when the type changes (not a bug, per ADR-0004)', () => {
    const original = entity({ sound_motif: 'thunder' });
    const updated = applyFormStateToEntity(
      original,
      blankCharacterForm({ type: 'location', parentLocation: 'orun' }),
    );
    expect(updated.frontmatter.type).toBe('location');
    expect((updated.frontmatter as unknown as Record<string, unknown>).sound_motif).toBe('thunder');
  });

  it('round-trips through entityToFormState and back unchanged', () => {
    const original = entity({
      aliases: ['Shango'],
      pronunciation: 'SHAHN-go',
      tags: ['orisha'],
      canon_status: 'established',
      relations: [{ target: 'esu', relation_type: 'ally', attitude: 'wary' }],
      sound_motif: 'thunder',
    });
    const form = entityToFormState(original);
    const roundTripped = applyFormStateToEntity(original, form);
    expect(roundTripped.frontmatter).toEqual(original.frontmatter);
    expect(roundTripped.body).toBe(original.body);
  });

  it('round-trips an arc through entityToFormState and back unchanged', () => {
    const original = entity(
      { name: 'Imperium in Imperio', type: 'arc', episodes: ['1x03', '1x04', '1x07'] },
      'A conspiracy arc.',
    );
    const form = entityToFormState(original);
    const roundTripped = applyFormStateToEntity(original, form);
    expect(roundTripped.frontmatter).toEqual(original.frontmatter);
    expect(roundTripped.body).toBe(original.body);
  });
});
