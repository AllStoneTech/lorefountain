/**
 * A minimal, in-memory {@link IndexStore} with no native/WASM dependency —
 * used by the headless validator (`cli/validate.ts`), which must run as a
 * single portable script with no bundled binary to keep colocated (the
 * exact problem `sql.js`'s WASM file caused for the extension bundle
 * itself, per ADR-0001 — not worth re-solving for a script meant to be
 * copied anywhere inside an arbitrary project).
 *
 * Never used by the live extension, which keeps `sqlJsStore.ts` (backed by
 * sql.js/FTS3) for real querying. This store implements just enough of the
 * {@link IndexStore} contract for {@link buildIndexFromDisk} to run —
 * full-text search and backlinks are stubbed to empty results, since the
 * validator only needs parsing, schema validation, and dangling-relation
 * detection, not search.
 */

import type { Entity, EntityFrontmatter } from '../model/entity';
import type { GlossaryTerm, GlossaryTermFrontmatter } from '../model/glossary';
import type { Script } from '../model/script';
import type { MentionKind, MentionTarget } from './mentions';
import type {
  EntityRecord,
  EntitySearchHit,
  GlossaryRecord,
  GlossarySearchHit,
  IndexStats,
  IndexStore,
  ListEntitiesFilter,
  MentionBacklink,
  MentionEndpoint,
  MentionSource,
  ScriptRecord,
} from './store';

/** Create a fresh, empty in-memory {@link IndexStore}. */
export function createMemoryIndexStore(): IndexStore {
  const entitiesById = new Map<string, EntityRecord>();
  const glossaryById = new Map<string, GlossaryRecord>();
  const scriptsById = new Map<string, ScriptRecord>();
  const mentionsBySource = new Map<string, MentionTarget[]>();

  return {
    upsertEntity(entity: Entity): void {
      removeMatchingEntity(entitiesById, entity.filePath, entity.id);
      entitiesById.set(entity.id, toEntityRecord(entity));
    },

    removeEntityByPath(filePath: string): void {
      removeByFilePath(entitiesById, filePath);
    },

    getEntityById(id: string): EntityRecord | undefined {
      return entitiesById.get(id);
    },

    getEntityByPath(filePath: string): EntityRecord | undefined {
      return findByFilePath(entitiesById, filePath);
    },

    listEntities(filter?: ListEntitiesFilter): EntityRecord[] {
      const all = [...entitiesById.values()];
      return filter?.type ? all.filter((entity) => entity.type === filter.type) : all;
    },

    searchEntities(): EntitySearchHit[] {
      return [];
    },

    upsertGlossaryTerm(term: GlossaryTerm): void {
      removeMatchingEntity(glossaryById, term.filePath, term.id);
      glossaryById.set(term.id, toGlossaryRecord(term));
    },

    removeGlossaryTermByPath(filePath: string): void {
      removeByFilePath(glossaryById, filePath);
    },

    getGlossaryTermById(id: string): GlossaryRecord | undefined {
      return glossaryById.get(id);
    },

    listGlossaryTerms(): GlossaryRecord[] {
      return [...glossaryById.values()];
    },

    searchGlossary(): GlossarySearchHit[] {
      return [];
    },

    upsertScript(script: Script): void {
      removeMatchingEntity(scriptsById, script.filePath, script.id);
      scriptsById.set(script.id, toScriptRecord(script));
    },

    removeScriptByPath(filePath: string): void {
      removeByFilePath(scriptsById, filePath);
    },

    getScriptById(id: string): ScriptRecord | undefined {
      return scriptsById.get(id);
    },

    getScriptByPath(filePath: string): ScriptRecord | undefined {
      return findByFilePath(scriptsById, filePath);
    },

    listScripts(): ScriptRecord[] {
      return [...scriptsById.values()];
    },

    setMentionsForSource(source: MentionSource, targets: readonly MentionTarget[]): void {
      mentionsBySource.set(mentionKey(source.kind, source.id), [...targets]);
    },

    removeMentionsForSource(source: MentionEndpoint): void {
      mentionsBySource.delete(mentionKey(source.kind, source.id));
    },

    getBacklinks(): MentionBacklink[] {
      return [];
    },

    stats(): IndexStats {
      return { entityCount: entitiesById.size, glossaryCount: glossaryById.size };
    },

    clear(): void {
      entitiesById.clear();
      glossaryById.clear();
      scriptsById.clear();
      mentionsBySource.clear();
    },

    dispose(): void {
      // No underlying resource to release.
    },
  };
}

/** Matches `IndexStore.upsertEntity`/`upsertGlossaryTerm`'s documented contract: replace by either filePath or id. */
function removeMatchingEntity<T extends { id: string; filePath: string }>(
  byId: Map<string, T>,
  filePath: string,
  id: string,
): void {
  for (const [key, record] of byId) {
    if (record.filePath === filePath || key === id) {
      byId.delete(key);
    }
  }
}

function removeByFilePath<T extends { filePath: string }>(byId: Map<string, T>, filePath: string): void {
  for (const [key, record] of byId) {
    if (record.filePath === filePath) {
      byId.delete(key);
      return;
    }
  }
}

function findByFilePath<T extends { filePath: string }>(byId: Map<string, T>, filePath: string): T | undefined {
  for (const record of byId.values()) {
    if (record.filePath === filePath) return record;
  }
  return undefined;
}

function mentionKey(kind: MentionKind, id: string): string {
  return `${kind}:${id}`;
}

function toEntityRecord(entity: Entity): EntityRecord {
  const frontmatter: EntityFrontmatter = entity.frontmatter;
  return {
    id: entity.id,
    type: frontmatter.type,
    name: frontmatter.name,
    filePath: entity.filePath,
    tags: frontmatter.tags ?? [],
    schemaVersion: frontmatter.schema_version,
    data: frontmatter,
    body: entity.body,
  };
}

function toGlossaryRecord(term: GlossaryTerm): GlossaryRecord {
  const frontmatter: GlossaryTermFrontmatter = term.frontmatter;
  return {
    id: term.id,
    term: frontmatter.term,
    filePath: term.filePath,
    schemaVersion: frontmatter.schema_version,
    data: frontmatter,
    body: term.body,
  };
}

function toScriptRecord(script: Script): ScriptRecord {
  return {
    id: script.id,
    filePath: script.filePath,
    title: script.frontmatter.title,
    order: script.frontmatter.order,
    productionCode: script.frontmatter.productionCode,
  };
}
