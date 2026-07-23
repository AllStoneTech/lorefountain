/**
 * Unit tests for Story Card Markdown rendering.
 */

import { describe, it, expect } from 'vitest';
import { renderEntityStoryCard, renderGlossaryStoryCard } from '../../src/providers/storyCard';
import { entityFrontmatterSchema } from '../../src/model/entity';
import { glossaryTermSchema } from '../../src/model/glossary';
import type { EntityRecord, GlossaryRecord, MentionBacklink } from '../../src/index/store';

function entityRecord(overrides: Record<string, unknown> = {}, body = 'God of thunder.'): EntityRecord {
  const frontmatter = entityFrontmatterSchema.parse({ name: 'Sango', type: 'character', ...overrides });
  return {
    id: 'sango',
    type: frontmatter.type,
    name: frontmatter.name,
    filePath: '/world/sango.md',
    tags: frontmatter.tags ?? [],
    schemaVersion: frontmatter.schema_version,
    data: frontmatter,
    body,
  };
}

function glossaryRecord(overrides: Record<string, unknown> = {}, body = ''): GlossaryRecord {
  const frontmatter = glossaryTermSchema.parse({ term: 'Ase', ...overrides });
  return {
    id: 'ase',
    term: frontmatter.term,
    filePath: '/world/glossary/ase.md',
    schemaVersion: frontmatter.schema_version,
    data: frontmatter,
    body,
  };
}

describe('renderEntityStoryCard', () => {
  it('renders the name and type', () => {
    const card = renderEntityStoryCard(entityRecord());
    expect(card).toContain('**Sango**');
    expect(card).toContain('_(character)_');
  });

  it('includes pronunciation when present', () => {
    const card = renderEntityStoryCard(entityRecord({ pronunciation: 'SHAHN-go' }));
    expect(card).toContain('Pronounced: SHAHN-go');
  });

  it('omits pronunciation when absent', () => {
    expect(renderEntityStoryCard(entityRecord())).not.toContain('Pronounced');
  });

  it('includes aliases when present', () => {
    const card = renderEntityStoryCard(entityRecord({ aliases: ['Shango', 'Xango'] }));
    expect(card).toContain('Aliases: Shango, Xango');
  });

  it('includes tags, backtick-quoted', () => {
    const card = renderEntityStoryCard(entityRecord({ tags: ['orisha', 'pantheon'] }));
    expect(card).toContain('`orisha`');
    expect(card).toContain('`pantheon`');
  });

  it('includes the first non-empty line of the body as a snippet', () => {
    const card = renderEntityStoryCard(entityRecord({}, '\n\nGod of thunder and justice.\nMore text.'));
    expect(card).toContain('God of thunder and justice.');
  });

  it('omits the body snippet section when the body is empty', () => {
    const card = renderEntityStoryCard(entityRecord({}, '   \n  '));
    expect(card.trim().endsWith('_(character)_')).toBe(true);
  });

  it('appends a "Mentioned in" line when backlinks are provided', () => {
    const backlinks: MentionBacklink[] = [
      { id: 'esu', kind: 'entity', name: 'Esu', filePath: '/world/esu.md' },
      { id: '1x01', kind: 'script', name: '1x01.fountain', filePath: '/scripts/1x01.fountain' },
    ];
    const card = renderEntityStoryCard(entityRecord(), backlinks);
    expect(card).toContain('Mentioned in: Esu, 1x01.fountain');
  });

  it('omits the "Mentioned in" line when there are no backlinks', () => {
    expect(renderEntityStoryCard(entityRecord(), [])).not.toContain('Mentioned in');
  });
});

describe('renderGlossaryStoryCard', () => {
  it('renders the term and gloss', () => {
    const card = renderGlossaryStoryCard(glossaryRecord({ gloss: 'The life force.' }));
    expect(card).toContain('**Ase**');
    expect(card).toContain('_(glossary)_');
    expect(card).toContain('The life force.');
  });

  it('falls back to the body snippet when there is no gloss', () => {
    const card = renderGlossaryStoryCard(glossaryRecord({}, 'A longer definition in the body.'));
    expect(card).toContain('A longer definition in the body.');
  });

  it('prefers the gloss over the body when both are present', () => {
    const card = renderGlossaryStoryCard(glossaryRecord({ gloss: 'Short gloss.' }, 'Longer body text.'));
    expect(card).toContain('Short gloss.');
    expect(card).not.toContain('Longer body text.');
  });

  it('appends a "Mentioned in" line when backlinks are provided', () => {
    const backlinks: MentionBacklink[] = [{ id: 'sango', kind: 'entity', name: 'Sango', filePath: '/world/sango.md' }];
    const card = renderGlossaryStoryCard(glossaryRecord({ gloss: 'The life force.' }), backlinks);
    expect(card).toContain('Mentioned in: Sango');
  });
});
