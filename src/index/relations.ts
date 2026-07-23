/**
 * Dangling-relation detection (Spec §4.5, §23).
 *
 * `relations` on entity frontmatter are deliberate, typed links (unlike the
 * automatic mentions in `mentions.ts`), and `target` is a plain string, not
 * validated against any known id at parse time (Spec §23 — never reject data,
 * flag it). A relation whose `target` doesn't resolve to a currently-indexed
 * entity is reported here so it can be surfaced, without ever blocking the
 * index build.
 */

import type { Relation } from '../model/entity';

/** A relation whose `target` does not resolve to any currently-known entity id. */
export interface DanglingRelation {
  target: string;
  relationType: string;
}

/**
 * Find every relation on an entity whose `target` isn't a known entity id.
 *
 * @param relations - The entity's `relations` field (absent treated as empty).
 * @param knownEntityIds - Every entity id currently in the index.
 * @returns The subset of relations that don't resolve, in original order.
 */
export function findDanglingRelations(
  relations: readonly Relation[] | undefined,
  knownEntityIds: ReadonlySet<string>,
): DanglingRelation[] {
  if (!relations || relations.length === 0) return [];
  return relations
    .filter((relation) => !knownEntityIds.has(relation.target))
    .map((relation) => ({ target: relation.target, relationType: relation.relation_type }));
}
