/**
 * Pure significance-grouping logic for the World tree (Spec §6), split out
 * from `worldTreeProvider.ts` so it stays unit-testable without a `vscode`
 * import — that file's tree-provider glue is verified manually instead (see
 * its own doc comment).
 */

import type { EntityRecord } from '../index/store';
import type { Significance } from '../model/entity';

/** One non-empty significance tier, in display order, for the World tree grouping. */
export interface SignificanceGroup {
  significance: Significance | 'unset';
  label: string;
  entities: readonly EntityRecord[];
}

const SIGNIFICANCE_TIERS: ReadonlyArray<{ significance: Significance | 'unset'; label: string }> = [
  { significance: 'main', label: 'Main' },
  { significance: 'supporting', label: 'Supporting' },
  { significance: 'minor', label: 'Minor' },
  { significance: 'unset', label: 'Unset' },
];

/**
 * Group entities into Main/Supporting/Minor/Unset tiers, alphabetical within
 * each tier, omitting empty tiers. Returns `undefined` — meaning "render
 * flat, like today" — when no entity in the list has `significance` set, so
 * a project that never uses the field sees no change to its World tree.
 *
 * @param entities - The entities in one World-tree category.
 * @returns Ordered, non-empty significance groups, or `undefined` if none apply.
 */
export function groupEntitiesBySignificance(entities: readonly EntityRecord[]): SignificanceGroup[] | undefined {
  if (!entities.some((entity) => entity.data.significance)) return undefined;

  return SIGNIFICANCE_TIERS.map((tier) => ({
    ...tier,
    entities: entities
      .filter((entity) => (entity.data.significance ?? 'unset') === tier.significance)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((group) => group.entities.length > 0);
}
