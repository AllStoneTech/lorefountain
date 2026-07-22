/**
 * Unit tests for the glossary term schema and file parse/serialize.
 */

import { describe, it, expect } from 'vitest';
import { parseGlossaryFile, serializeGlossaryTerm } from '../../src/model/glossary';

function file(frontmatterLines: string[], body = ''): string {
  return ['---', ...frontmatterLines, '---', '', body].join('\n');
}

describe('parseGlossaryFile', () => {
  it('accepts a term with a gloss', () => {
    const result = parseGlossaryFile(file(['term: Ase', 'gloss: The life force / divine authority.']), {
      id: 'ase',
      filePath: '/world/glossary/ase.md',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.term.frontmatter.term).toBe('Ase');
    expect(result.term.frontmatter.gloss).toMatch(/life force/);
  });

  it('requires a term', () => {
    const result = parseGlossaryFile(file(['gloss: orphaned definition']), {
      id: 'x',
      filePath: '/world/glossary/x.md',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('invalid-schema');
    expect(result.issues?.some((i) => i.path === 'term')).toBe(true);
  });

  it('round-trips a term with a body definition', () => {
    const result = parseGlossaryFile(
      file(['term: Orunmila'], 'The orisha of wisdom and divination.'),
      { id: 'orunmila', filePath: '/world/glossary/orunmila.md' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const serialized = serializeGlossaryTerm(result.term);
    const reparsed = parseGlossaryFile(serialized, {
      id: 'orunmila',
      filePath: '/world/glossary/orunmila.md',
    });
    expect(reparsed.ok).toBe(true);
    if (!reparsed.ok) return;
    expect(reparsed.term.frontmatter.term).toBe('Orunmila');
    expect(reparsed.term.body).toBe('The orisha of wisdom and divination.');
  });
});
