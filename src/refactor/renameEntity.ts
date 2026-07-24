/**
 * Pure text-rewrite logic for entity renaming (Spec §13.3): "a rename
 * command that updates the entity's own filename/id and rewrites known
 * references (mentions and typed relations) across the workspace, where
 * safely detectable."
 *
 * Split deliberately by reference kind:
 * - Typed relation targets ({@link renameRelationTargets}) are plain id
 *   strings (Spec §4.5) — an exact match is unambiguous, so always rewritten.
 * - Explicit `[[wikilink]]` occurrences ({@link renameInText}) are a
 *   deliberate, structural marker the writer chose specifically to mean "a
 *   link to this entity" — renaming the target and updating the visible text
 *   is a safe, in-kind edit.
 * - Bare plain-text mentions inside prose (dialogue, action lines, another
 *   entity's free-text body) are found using the exact same whole-word
 *   matcher the mention index already uses, but deliberately left
 *   untouched — a screenplay's own prose shouldn't be silently bulk-edited
 *   by a rename. Their locations are reported instead (the "broken
 *   reference" complement, Spec §13.3), and {@link addAliasIfMissing} keeps
 *   them functionally linked in the meantime by preserving the old name as
 *   an alias (see ADR-0013 for the full rationale).
 */

import { findMentionOccurrences, type MentionCandidate } from '../index/mentions';
import type { Relation } from '../model/entity';

/** Result of rewriting one file's text for a rename. */
export interface RenameTextResult {
  /** `text` with every `[[OldName]]`-style occurrence rewritten to the new name. Identical to the input if nothing changed. */
  text: string;
  /** How many wikilinked occurrences were rewritten. */
  wikilinksRewritten: number;
  /** 0-based line numbers (in the ORIGINAL text) of every plain-text (non-wikilinked) occurrence left as-is. */
  staleMentionLines: number[];
}

/**
 * Rewrite `[[OldName]]`-style occurrences of `oldName` to `newName` in
 * `text`, leaving bare prose occurrences untouched.
 *
 * @param text - The file's current text (an entity/glossary body, or raw script text).
 * @param oldName - The entity's previous display name.
 * @param newName - The entity's new display name.
 * @returns The rewritten text plus what was and wasn't touched.
 */
export function renameInText(text: string, oldName: string, newName: string): RenameTextResult {
  const candidate: MentionCandidate = { id: 'target', kind: 'entity', names: [oldName] };
  const occurrences = findMentionOccurrences(text, [candidate]);
  if (occurrences.length === 0) {
    return { text, wikilinksRewritten: 0, staleMentionLines: [] };
  }

  let result = text;
  let wikilinksRewritten = 0;
  const staleMentionLines: number[] = [];

  // Walk backwards so earlier offsets stay valid as later splices shift the string.
  for (let i = occurrences.length - 1; i >= 0; i--) {
    const occurrence = occurrences[i];
    const isWikilinked =
      text.slice(Math.max(0, occurrence.start - 2), occurrence.start) === '[[' &&
      text.slice(occurrence.end, occurrence.end + 2) === ']]';

    if (isWikilinked) {
      result = result.slice(0, occurrence.start) + newName + result.slice(occurrence.end);
      wikilinksRewritten += 1;
    } else {
      staleMentionLines.unshift(lineNumberAt(text, occurrence.start));
    }
  }

  return { text: result, wikilinksRewritten, staleMentionLines };
}

/**
 * Rewrite every relation whose `target` is `oldId` to point at `newId`.
 *
 * @param relations - An entity's `relations` field (may be absent).
 * @param oldId - The renamed entity's previous id.
 * @param newId - The renamed entity's new id.
 * @returns A new array if anything changed, otherwise the original reference unchanged (so callers can cheaply detect a no-op).
 */
export function renameRelationTargets(
  relations: Relation[] | undefined,
  oldId: string,
  newId: string,
): Relation[] | undefined {
  if (!relations || relations.length === 0) return relations;
  if (!relations.some((relation) => relation.target === oldId)) return relations;
  return relations.map((relation) => (relation.target === oldId ? { ...relation, target: newId } : relation));
}

/**
 * Add `oldName` to an entity's `aliases` if not already present (case-insensitive),
 * so plain-text mentions of the old name keep resolving after a rename.
 *
 * @param aliases - The entity's current `aliases` field (may be absent).
 * @param oldName - The entity's previous display name.
 * @returns The updated aliases array (always a new array).
 */
export function addAliasIfMissing(aliases: readonly string[] | undefined, oldName: string): string[] {
  const current = aliases ?? [];
  if (current.some((alias) => alias.toLowerCase() === oldName.toLowerCase())) return [...current];
  return [...current, oldName];
}

function lineNumberAt(text: string, offset: number): number {
  let line = 0;
  for (let i = 0; i < offset; i++) {
    if (text.charCodeAt(i) === 10 /* \n */) line += 1;
  }
  return line;
}
