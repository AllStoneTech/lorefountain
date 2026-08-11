/**
 * Unit tests for the World tree's significance-grouping logic.
 *
 * `WorldTreeProvider` itself is `vscode`-facing glue and not covered here
 * (verify manually via the F5 Extension Development Host, per its own doc
 * comment) — this exercises `worldTreeGrouping.ts`, the pure module it was
 * split out of specifically so this logic could be unit-tested without a
 * `vscode` import.
 */

import { describe, it, expect } from 'vitest';
import { entityFrontmatterSchema } from '../../src/model/entity';
import type { EntityRecord } from '../../src/index/store';
import { groupEntitiesBySignificance } from '../../src/providers/worldTreeGrouping';

function entityRecord(overrides: Record<string, unknown> = {}): EntityRecord {
  const frontmatter = entityFrontmatterSchema.parse({ name: 'Sango', type: 'character', ...overrides });
  return {
    id: frontmatter.name.toLowerCase(),
    type: frontmatter.type,
    name: frontmatter.name,
    filePath: `/world/${frontmatter.name.toLowerCase()}.md`,
    tags: frontmatter.tags ?? [],
    schemaVersion: frontmatter.schema_version,
    data: frontmatter,
    body: '',
  };
}

describe('groupEntitiesBySignificance', () => {
  it('returns undefined when no entity has significance set', () => {
    const entities = [entityRecord({ name: 'Sango' }), entityRecord({ name: 'Esu' })];
    expect(groupEntitiesBySignificance(entities)).toBeUndefined();
  });

  it('returns undefined for an empty list', () => {
    expect(groupEntitiesBySignificance([])).toBeUndefined();
  });

  it('groups into Main/Supporting/Minor/Unset, in that order, omitting empty tiers', () => {
    const entities = [
      entityRecord({ name: 'Oya', significance: 'minor' }),
      entityRecord({ name: 'Sango', significance: 'main' }),
      entityRecord({ name: 'Esu' }),
    ];
    const groups = groupEntitiesBySignificance(entities);
    expect(groups).toBeDefined();
    expect(groups?.map((g) => g.significance)).toEqual(['main', 'minor', 'unset']);
    expect(groups?.map((g) => g.label)).toEqual(['Main', 'Minor', 'Unset']);
  });

  it('sorts entities alphabetically within a tier', () => {
    const entities = [
      entityRecord({ name: 'Xango', significance: 'main' }),
      entityRecord({ name: 'Esu', significance: 'main' }),
      entityRecord({ name: 'Oya', significance: 'main' }),
    ];
    const groups = groupEntitiesBySignificance(entities);
    expect(groups?.[0].entities.map((e) => e.name)).toEqual(['Esu', 'Oya', 'Xango']);
  });

  it('includes counts implicitly via entities.length for each tier', () => {
    const entities = [
      entityRecord({ name: 'Sango', significance: 'main' }),
      entityRecord({ name: 'Esu', significance: 'main' }),
      entityRecord({ name: 'Oya', significance: 'supporting' }),
    ];
    const groups = groupEntitiesBySignificance(entities);
    expect(groups?.find((g) => g.significance === 'main')?.entities).toHaveLength(2);
    expect(groups?.find((g) => g.significance === 'supporting')?.entities).toHaveLength(1);
  });

  it('sorts an entity with no significance into the Unset tier when at least one sibling has significance set', () => {
    const entities = [entityRecord({ name: 'Sango', significance: 'main' }), entityRecord({ name: 'Esu' })];
    const groups = groupEntitiesBySignificance(entities);
    const unset = groups?.find((g) => g.significance === 'unset');
    expect(unset?.entities.map((e) => e.name)).toEqual(['Esu']);
  });
});
