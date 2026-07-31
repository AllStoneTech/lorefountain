/**
 * Unit tests for the Story Overview schema and file parse/serialize
 * (`src/model/storyOverview.ts`). Separate from `storyOverview.test.ts`,
 * which covers the scaffolding function in `config/storyOverview.ts`.
 */

import { describe, it, expect } from 'vitest';
import { parseStoryOverviewFile, serializeStoryOverview } from '../../src/model/storyOverview';

function file(frontmatterLines: string[], body = ''): string {
  return ['---', ...frontmatterLines, '---', '', body].join('\n');
}

describe('parseStoryOverviewFile', () => {
  it('accepts a fully-populated overview', () => {
    const result = parseStoryOverviewFile(
      file(['title: Orun', 'pitch: A grieving archivist uncovers a signal buried in folklore.', 'tone: elegiac', 'genre: speculative drama']),
      '/world/OVERVIEW.md',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.overview.frontmatter.title).toBe('Orun');
    expect(result.overview.frontmatter.tone).toBe('elegiac');
  });

  it('parses a file with no frontmatter at all, preserving the full body', () => {
    const legacyText = '# Loomwake\n\n## The pitch\n\nSomething something.\n';
    const result = parseStoryOverviewFile(legacyText, '/world/OVERVIEW.md');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.overview.frontmatter.title).toBeUndefined();
    expect(result.overview.frontmatter.pitch).toBeUndefined();
    expect(result.overview.body).toBe(legacyText);
  });

  it('reports malformed YAML rather than throwing', () => {
    const result = parseStoryOverviewFile('---\ntitle: [unterminated\n---\n\nbody', '/world/OVERVIEW.md');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('malformed-yaml');
  });

  it('reports invalid-schema when a field has the wrong type', () => {
    const result = parseStoryOverviewFile(file(['title:', '  - not a string']), '/world/OVERVIEW.md');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('invalid-schema');
    expect(result.issues?.some((i) => i.path === 'title')).toBe(true);
  });

  it('preserves unknown frontmatter fields via catchall', () => {
    const result = parseStoryOverviewFile(file(['title: Orun', 'custom_field: kept']), '/world/OVERVIEW.md');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.overview.frontmatter.custom_field).toBe('kept');
  });

  it('round-trips through serialize/parse', () => {
    const result = parseStoryOverviewFile(file(['title: Orun', 'pitch: A logline.']), '/world/OVERVIEW.md');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const serialized = serializeStoryOverview(result.overview);
    const reparsed = parseStoryOverviewFile(serialized, '/world/OVERVIEW.md');
    expect(reparsed.ok).toBe(true);
    if (!reparsed.ok) return;
    expect(reparsed.overview.frontmatter.title).toBe('Orun');
    expect(reparsed.overview.frontmatter.pitch).toBe('A logline.');
  });
});
