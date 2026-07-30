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

/**
 * Find every code in an Arc entity's `episodes` field that doesn't resolve to
 * any currently-known script's Production Code. Unlike Timeline events'
 * `production_code` (which resolves silently to "unset" if unmatched, per
 * ADR-0026), an Arc's whole purpose is precise episode targeting — a
 * mistyped or stale code here is surfaced, not swallowed.
 *
 * @param episodes - The arc's `episodes` field (absent treated as empty).
 * @param knownProductionCodes - Every script Production Code currently in the index.
 * @returns The subset of codes that don't resolve, in original order.
 */
export function findDanglingEpisodeCodes(
  episodes: readonly string[] | undefined,
  knownProductionCodes: ReadonlySet<string>,
): string[] {
  if (!episodes || episodes.length === 0) return [];
  return episodes.filter((code) => !knownProductionCodes.has(code));
}
