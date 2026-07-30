/**
 * Unit tests for the Timeline event schema and file parse/serialize.
 */

import { describe, it, expect } from 'vitest';
import { parseTimelineEventFile, serializeTimelineEvent } from '../../src/model/timeline';

function file(frontmatterLines: string[], body = ''): string {
  return ['---', ...frontmatterLines, '---', '', body].join('\n');
}

describe('parseTimelineEventFile', () => {
  it('accepts an event with only a name set', () => {
    const result = parseTimelineEventFile(file(['name: The Founding of the Pantheon']), {
      id: 'the-founding-of-the-pantheon',
      filePath: '/world/timeline/the-founding-of-the-pantheon.md',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.frontmatter.name).toBe('The Founding of the Pantheon');
  });

  it('requires a name', () => {
    const result = parseTimelineEventFile(file(['chronological_order: 1']), {
      id: 'x',
      filePath: '/world/timeline/x.md',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('invalid-schema');
    expect(result.issues?.some((i) => i.path === 'name')).toBe(true);
  });

  it('accepts both narrative-position fields and both chronological fields', () => {
    const result = parseTimelineEventFile(
      file([
        'name: Sango Ascends',
        'production_code: 1x01',
        'narrative_order: 3',
        'chronological_order: 12',
        'in_universe_date: Three years before the pilot',
        'participants:',
        '  - sango',
        '  - the-ark',
      ]),
      { id: 'sango-ascends', filePath: '/world/timeline/sango-ascends.md' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.frontmatter.production_code).toBe('1x01');
    expect(result.event.frontmatter.narrative_order).toBe(3);
    expect(result.event.frontmatter.chronological_order).toBe(12);
    expect(result.event.frontmatter.in_universe_date).toBe('Three years before the pilot');
    expect(result.event.frontmatter.participants).toEqual(['sango', 'the-ark']);
  });

  it('round-trips an event with a body description', () => {
    const result = parseTimelineEventFile(
      file(['name: The Long Silence'], 'Orunmila speaks to no one for a full cycle.'),
      { id: 'the-long-silence', filePath: '/world/timeline/the-long-silence.md' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const serialized = serializeTimelineEvent(result.event);
    const reparsed = parseTimelineEventFile(serialized, {
      id: 'the-long-silence',
      filePath: '/world/timeline/the-long-silence.md',
    });
    expect(reparsed.ok).toBe(true);
    if (!reparsed.ok) return;
    expect(reparsed.event.frontmatter.name).toBe('The Long Silence');
    expect(reparsed.event.body).toBe('Orunmila speaks to no one for a full cycle.');
  });
});
